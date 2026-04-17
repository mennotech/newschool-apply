import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { configureStore } from '@reduxjs/toolkit';
import { rest } from 'msw';
import { server } from '../mocks/server';
import authReducer from '../store/slices/authSlice';
import applicationReducer from '../store/slices/applicationSlice';
import LoginPage from './LoginPage';

const BASE_URL = 'http://localhost:8080';
process.env.REACT_APP_DRUPAL_BASE_URL = BASE_URL;

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

function renderLoginPage() {
  const store = configureStore({
    reducer: { auth: authReducer, application: applicationReducer },
  });
  return render(
    <Provider store={store}>
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    </Provider>
  );
}

describe('LoginPage', () => {
  beforeEach(() => mockNavigate.mockClear());

  it('renders the email/password form', () => {
    renderLoginPage();
    expect(screen.getByLabelText(/username or email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /log in/i })).toBeInTheDocument();
  });

  it('renders Google and Microsoft login links', () => {
    renderLoginPage();
    expect(screen.getByRole('link', { name: /continue with google/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /continue with microsoft/i })).toBeInTheDocument();
  });

  it('redirects to /dashboard after successful login', async () => {
    renderLoginPage();
    await userEvent.type(screen.getByLabelText(/username or email/i), 'validuser');
    await userEvent.type(screen.getByLabelText(/password/i), 'validpass');
    await userEvent.click(screen.getByRole('button', { name: /log in/i }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
    });
  });

  it('shows an error message on 403', async () => {
    renderLoginPage();
    await userEvent.type(screen.getByLabelText(/username or email/i), 'wronguser');
    await userEvent.type(screen.getByLabelText(/password/i), 'wrongpass');
    await userEvent.click(screen.getByRole('button', { name: /log in/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });
});
