import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { rest } from 'msw';
import { server } from '../mocks/server';
import authReducer from '../store/slices/authSlice';
import applicationReducer from '../store/slices/applicationSlice';
import LoginPage from './LoginPage';

const BASE = 'http://localhost:8080';

function createStore(authState = {}) {
  return configureStore({
    reducer: { auth: authReducer, application: applicationReducer },
    preloadedState: {
      auth: { user: null, logoutToken: null, status: 'idle', error: null, ...authState },
    },
  });
}

function renderLogin(store) {
  return render(
    <Provider store={store || createStore()}>
      <MemoryRouter initialEntries={['/login']}>
        <LoginPage />
      </MemoryRouter>
    </Provider>
  );
}

describe('LoginPage', () => {
  it('renders email/password form', () => {
    renderLogin();
    expect(screen.getByLabelText(/username or email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('shows Google and Microsoft login links', () => {
    renderLogin();
    expect(screen.getByRole('link', { name: /sign in with google/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /sign in with microsoft/i })).toBeInTheDocument();
  });

  it('shows validation errors for empty submission', async () => {
    renderLogin();
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
    expect(await screen.findByText(/username or email is required/i)).toBeInTheDocument();
    expect(await screen.findByText(/password is required/i)).toBeInTheDocument();
  });

  it('shows error message on failed login', async () => {
    renderLogin();
    fireEvent.change(screen.getByLabelText(/username or email/i), { target: { value: 'baduser' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'wrongpass' } });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });

  it('calls login API with credentials on submit', async () => {
    let capturedBody = null;
    server.use(
      rest.post(`${BASE}/user/login`, async (req, res, ctx) => {
        capturedBody = await req.json();
        return res(
          ctx.status(200),
          ctx.json({
            current_user: { uid: '1', name: 'testuser', mail: 'test@example.com', roles: [] },
            logout_token: 'token-123',
            csrf_token: 'csrf-123',
          })
        );
      })
    );

    renderLogin();
    fireEvent.change(screen.getByLabelText(/username or email/i), { target: { value: 'testuser' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'password' } });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(capturedBody).toEqual({ name: 'testuser', pass: 'password' });
    });
  });
});
