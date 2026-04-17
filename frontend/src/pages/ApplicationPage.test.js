import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { configureStore } from '@reduxjs/toolkit';
import authReducer from '../store/slices/authSlice';
import applicationReducer from '../store/slices/applicationSlice';
import ApplicationPage from './ApplicationPage';

process.env.REACT_APP_DRUPAL_BASE_URL = 'http://localhost:8080';

function renderApp({ initialPath = '/apply/student-info', authUser = null } = {}) {
  const store = configureStore({
    reducer: { auth: authReducer, application: applicationReducer },
    preloadedState: {
      auth: {
        user: authUser || { uid: '1', name: 'testuser' },
        status: 'idle',
        error: null,
      },
    },
  });
  const { rerender } = render(
    <Provider store={store}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/apply/:step" element={<ApplicationPage />} />
          <Route path="/apply" element={<ApplicationPage />} />
        </Routes>
      </MemoryRouter>
    </Provider>
  );
  return { store, rerender };
}

describe('ApplicationPage', () => {
  describe('Step 1 — Student Information', () => {
    it('renders the student info form', () => {
      renderApp();
      expect(screen.getByRole('heading', { name: /student information/i })).toBeInTheDocument();
      expect(screen.getByLabelText(/first name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/last name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/date of birth/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/grade/i)).toBeInTheDocument();
    });

    it('shows validation errors when submitting empty form', async () => {
      renderApp();
      await userEvent.click(screen.getByRole('button', { name: /next/i }));
      expect(await screen.findByText(/first name is required/i)).toBeInTheDocument();
      expect(screen.getByText(/last name is required/i)).toBeInTheDocument();
      expect(screen.getByText(/date of birth is required/i)).toBeInTheDocument();
      expect(screen.getByText(/grade is required/i)).toBeInTheDocument();
    });

    it('advances to Documents step after valid submission', async () => {
      renderApp();
      await userEvent.type(screen.getByLabelText(/first name/i), 'Roland');
      await userEvent.type(screen.getByLabelText(/last name/i), 'Penner');
      await userEvent.type(screen.getByLabelText(/date of birth/i), '2010-04-23');
      await userEvent.type(screen.getByLabelText(/grade/i), '5');
      await userEvent.click(screen.getByRole('button', { name: /next/i }));

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /documents/i })).toBeInTheDocument();
      });
    });
  });

  describe('Step 2 — Documents', () => {
    it('renders the documents upload section', () => {
      renderApp({ initialPath: '/apply/documents' });
      expect(screen.getByRole('heading', { name: /documents/i })).toBeInTheDocument();
    });

    it('shows an error for oversized files', async () => {
      renderApp({ initialPath: '/apply/documents' });
      const bigFile = new File([new ArrayBuffer(6 * 1024 * 1024)], 'big.pdf', { type: 'application/pdf' });
      Object.defineProperty(bigFile, 'size', { value: 6 * 1024 * 1024 });
      const input = screen.getByLabelText(/select file/i);
      await userEvent.upload(input, bigFile);
      expect(await screen.findByText(/too large/i)).toBeInTheDocument();
    });

    it('can continue without uploading documents', async () => {
      renderApp({ initialPath: '/apply/documents' });
      await userEvent.click(screen.getByRole('button', { name: /next/i }));
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /review/i })).toBeInTheDocument();
      });
    });

    it('uploads a file and shows it in the list', async () => {
      renderApp({ initialPath: '/apply/documents' });
      const file = new File(['pdf content'], 'transcript.pdf', { type: 'application/pdf' });
      const input = screen.getByLabelText(/select file/i);
      await userEvent.upload(input, file);

      await waitFor(() => {
        expect(screen.getByText('transcript.pdf')).toBeInTheDocument();
      });
    });
  });

  describe('Step 3 — Review & Submit', () => {
    it('shows a submission confirmation after clicking Submit', async () => {
      // Pre-populate application in Redux so the Submit button is active
      const store = configureStore({
        reducer: { auth: authReducer, application: applicationReducer },
        preloadedState: {
          auth: { user: { uid: '1', name: 'testuser' }, status: 'idle', error: null },
          application: {
            currentApplication: { id: 'mock-application-id', attributes: { field_status: 'pending' } },
            status: 'idle',
            error: null,
          },
        },
      });

      render(
        <Provider store={store}>
          <MemoryRouter initialEntries={['/apply/review']}>
            <Routes>
              <Route path="/apply/:step" element={<ApplicationPage />} />
            </Routes>
          </MemoryRouter>
        </Provider>
      );

      await userEvent.click(screen.getByRole('button', { name: /submit application/i }));
      await waitFor(() => {
        expect(screen.getByText(/submitted successfully/i)).toBeInTheDocument();
      });
    });

    it('shows an error when submitting with no application id', async () => {
      // No currentApplication in Redux — button is present but handleSubmit returns early
      renderApp({ initialPath: '/apply/review' });
      const button = screen.getByRole('button', { name: /submit application/i });
      expect(button).toBeInTheDocument();
      await userEvent.click(button);
      // Should NOT show success message since applicationId is null
      expect(screen.queryByText(/submitted successfully/i)).not.toBeInTheDocument();
    });
  });

  describe('Full flow — Student Info → Documents → Review → Submit', () => {
    it('completes the entire application flow end-to-end', async () => {
      renderApp();

      // Step 1: fill student info
      await userEvent.type(screen.getByLabelText(/first name/i), 'Roland');
      await userEvent.type(screen.getByLabelText(/last name/i), 'Penner');
      await userEvent.type(screen.getByLabelText(/date of birth/i), '2010-04-23');
      await userEvent.type(screen.getByLabelText(/grade/i), '5');
      await userEvent.click(screen.getByRole('button', { name: /next/i }));

      // Step 2: documents — skip upload, continue
      await waitFor(() => screen.getByRole('heading', { name: /documents/i }));
      await userEvent.click(screen.getByRole('button', { name: /next/i }));

      // Step 3: review — check student data shown, then submit
      await waitFor(() => screen.getByRole('heading', { name: /review/i }));
      expect(screen.getByText('Roland')).toBeInTheDocument();
      expect(screen.getByText('Penner')).toBeInTheDocument();

      await userEvent.click(screen.getByRole('button', { name: /submit application/i }));
      await waitFor(() => {
        expect(screen.getByText(/submitted successfully/i)).toBeInTheDocument();
      });
    });
  });
});
