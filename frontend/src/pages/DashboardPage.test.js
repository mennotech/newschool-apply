import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { rest } from 'msw';
import { server } from '../mocks/server';
import authReducer from '../store/slices/authSlice';
import applicationReducer from '../store/slices/applicationSlice';
import DashboardPage from './DashboardPage';

const BASE = 'http://localhost:8080';

const mockUser = { uid: '1', name: 'testuser', email: 'test@example.com', roles: ['authenticated'] };

function createStore(authState = {}) {
  return configureStore({
    reducer: { auth: authReducer, application: applicationReducer },
    preloadedState: {
      auth: { user: mockUser, logoutToken: 'token', status: 'idle', error: null, ...authState },
    },
  });
}

function renderDashboard(store) {
  return render(
    <Provider store={store || createStore()}>
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    </Provider>
  );
}

describe('DashboardPage', () => {
  it('shows welcome message with user name', async () => {
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByText(/welcome.*testuser/i)).toBeInTheDocument();
    });
  });

  it('shows loading state initially', () => {
    renderDashboard();
    expect(screen.getByText(/loading applications/i)).toBeInTheDocument();
  });

  it('displays application cards after loading', async () => {
    renderDashboard();
    await waitFor(() => {
      expect(screen.queryByText(/loading applications/i)).not.toBeInTheDocument();
    });
    expect(screen.getByText(/application #1/i)).toBeInTheDocument();
  });

  it('shows draft status badge', async () => {
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByText(/draft/i)).toBeInTheDocument();
    });
  });

  it('shows Continue action for draft applications', async () => {
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /continue/i })).toBeInTheDocument();
    });
  });

  it('shows Delete action for draft applications', async () => {
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument();
    });
  });

  it('shows View action for submitted applications', async () => {
    server.use(
      rest.get(`${BASE}/jsonapi/node/application_partial_programming`, (req, res, ctx) =>
        res(ctx.status(200), ctx.json({
          data: [{
            id: 'app-submitted',
            type: 'node--application_partial_programming',
            attributes: {
              title: 'Submitted Application',
              field_application_status: 'submitted',
              created: '2024-01-01T00:00:00+00:00',
              field_student_first_name: 'Jane',
              field_student_last_name: 'Doe',
              field_student_applying_for_grade: '3',
            },
          }],
        }))
      )
    );
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /view/i })).toBeInTheDocument();
    });
  });

  it('shows empty state when no applications', async () => {
    server.use(
      rest.get(`${BASE}/jsonapi/node/application_partial_programming`, (req, res, ctx) =>
        res(ctx.status(200), ctx.json({ data: [] }))
      )
    );
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByText(/no applications yet/i)).toBeInTheDocument();
    });
  });

  it('shows confirmation dialog when deleting', async () => {
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /delete/i }));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/confirm deletion/i)).toBeInTheDocument();
  });

  it('removes deleted application after confirmation', async () => {
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /delete/i }));
    await screen.findByRole('dialog');
    fireEvent.click(screen.getByRole('button', { name: /delete application/i }));
    await waitFor(() => {
      expect(screen.getByText(/deleted successfully/i)).toBeInTheDocument();
    });
  });
});
