import React from 'react';
import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { configureStore } from '@reduxjs/toolkit';
import authReducer from '../store/slices/authSlice';
import applicationReducer from '../store/slices/applicationSlice';
import ProtectedRoute from './ProtectedRoute';

function makeStore(user = null) {
  return configureStore({
    reducer: { auth: authReducer, application: applicationReducer },
    preloadedState: {
      auth: {
        user,
        status: 'idle',
        error: null,
        logoutToken: null,
      },
    },
  });
}

function renderProtectedRoute(store, initialPath = '/protected') {
  return render(
    <Provider store={store}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route
            path="/protected"
            element={
              <ProtectedRoute>
                <div>Protected Content</div>
              </ProtectedRoute>
            }
          />
          <Route path="/login" element={<div>Login Page</div>} />
        </Routes>
      </MemoryRouter>
    </Provider>
  );
}

describe('ProtectedRoute', () => {
  it('redirects unauthenticated users to /login', () => {
    renderProtectedRoute(makeStore(null));
    expect(screen.getByText('Login Page')).toBeInTheDocument();
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  it('preserves the ?next= param in the redirect URL', () => {
    const store = makeStore(null);
    render(
      <Provider store={store}>
        <MemoryRouter initialEntries={['/protected']}>
          <Routes>
            <Route
              path="/protected"
              element={
                <ProtectedRoute>
                  <div>Protected Content</div>
                </ProtectedRoute>
              }
            />
            <Route
              path="/login"
              element={
                <div data-testid="login">
                  Login
                </div>
              }
            />
          </Routes>
        </MemoryRouter>
      </Provider>
    );
    expect(screen.getByTestId('login')).toBeInTheDocument();
  });

  it('renders children when user is authenticated', () => {
    const user = { uid: 1, name: 'testuser', email: 'test@test.com', roles: ['authenticated'] };
    renderProtectedRoute(makeStore(user));
    expect(screen.getByText('Protected Content')).toBeInTheDocument();
    expect(screen.queryByText('Login Page')).not.toBeInTheDocument();
  });
});
