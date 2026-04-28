import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { configureStore } from '@reduxjs/toolkit';
import authReducer from '../store/slices/authSlice';
import applicationReducer from '../store/slices/applicationSlice';
import LoginPage from './LoginPage';
import { server } from '../mocks/server';
import { http, HttpResponse } from 'msw';

const BASE_URL = process.env.REACT_APP_DRUPAL_BASE_URL || 'http://localhost:8080';

function makeStore(preloadedState = {}) {
  return configureStore({
    reducer: { auth: authReducer, application: applicationReducer },
    preloadedState,
  });
}

function renderLoginPage(store, initialPath = '/login') {
  return render(
    <Provider store={store}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/dashboard" element={<div>Dashboard</div>} />
        </Routes>
      </MemoryRouter>
    </Provider>
  );
}

describe('LoginPage', () => {
  it('renders email and password form fields', () => {
    renderLoginPage(makeStore());
    expect(screen.getByLabelText(/email or username/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('renders Google and Microsoft social login links', () => {
    renderLoginPage(makeStore());
    expect(screen.getByRole('link', { name: /sign in with google/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /sign in with microsoft/i })).toBeInTheDocument();
  });

  it('shows validation errors when form is submitted empty', async () => {
    renderLoginPage(makeStore());
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
    await waitFor(() => {
      expect(screen.getByText(/email is required/i)).toBeInTheDocument();
      expect(screen.getByText(/password is required/i)).toBeInTheDocument();
    });
  });

  it('shows error on failed login', async () => {
    server.use(
      http.post(`${BASE_URL}/user/login`, () =>
        HttpResponse.json({ message: 'Invalid credentials' }, { status: 400 })
      )
    );
    renderLoginPage(makeStore());
    fireEvent.change(screen.getByLabelText(/email or username/i), { target: { value: 'bad@test.com' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'wrongpass' } });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });

  it('redirects to dashboard on successful login', async () => {
    renderLoginPage(makeStore());
    fireEvent.change(screen.getByLabelText(/email or username/i), { target: { value: 'testuser' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
    await waitFor(() => {
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
    });
  });

  it('redirects away if already authenticated', () => {
    const store = makeStore({
      auth: { user: { uid: 1, name: 'testuser', email: 'test@test.com', roles: ['authenticated'] }, status: 'idle', error: null, logoutToken: null },
    });
    renderLoginPage(store);
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });
});
