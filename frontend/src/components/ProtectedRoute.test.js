import React from 'react';
import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { configureStore } from '@reduxjs/toolkit';
import authReducer from '../store/slices/authSlice';
import applicationReducer from '../store/slices/applicationSlice';
import ProtectedRoute from './ProtectedRoute';

function buildStore(user = null) {
  return configureStore({
    reducer: { auth: authReducer, application: applicationReducer },
    preloadedState: { auth: { user, csrfToken: null, status: 'idle', error: null } },
  });
}

function renderWithAuth(user) {
  const store = buildStore(user);
  return render(
    <Provider store={store}>
      <MemoryRouter initialEntries={['/protected']}>
        <Routes>
          <Route path="/login" element={<div>Login Page</div>} />
          <Route
            path="/protected"
            element={
              <ProtectedRoute>
                <div>Protected Content</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    </Provider>
  );
}

describe('ProtectedRoute', () => {
  it('redirects unauthenticated user to /login', () => {
    renderWithAuth(null);
    expect(screen.getByText('Login Page')).toBeInTheDocument();
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  it('renders children when user is authenticated', () => {
    renderWithAuth({ uid: 1, name: 'testuser' });
    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });
});
