import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import authReducer from '../store/slices/authSlice';
import applicationReducer from '../store/slices/applicationSlice';
import ProtectedRoute from './ProtectedRoute';

function LocationSearch() {
  const { search } = useLocation();
  return <span data-testid="search">{search}</span>;
}

function createTestStore(authState = {}) {
  return configureStore({
    reducer: { auth: authReducer, application: applicationReducer },
    preloadedState: {
      auth: { user: null, logoutToken: null, status: 'idle', error: null, ...authState },
    },
  });
}

function renderWithRouter(ui, { initialEntries = ['/protected'], store } = {}) {
  return render(
    <Provider store={store || createTestStore()}>
      <MemoryRouter initialEntries={initialEntries}>
        <Routes>
          <Route
            path="/protected"
            element={<ProtectedRoute><div>Protected Content</div></ProtectedRoute>}
          />
          <Route path="/login" element={<div>Login Page</div>} />
        </Routes>
      </MemoryRouter>
    </Provider>
  );
}

describe('ProtectedRoute', () => {
  it('redirects unauthenticated users to /login', () => {
    renderWithRouter(<div />, { store: createTestStore({ user: null }) });
    expect(screen.getByText('Login Page')).toBeInTheDocument();
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  it('renders children when user is authenticated', () => {
    const store = createTestStore({
      user: { uid: '1', name: 'testuser', email: 'test@example.com', roles: ['authenticated'] },
    });
    renderWithRouter(<div />, { store });
    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });

  it('preserves ?next= query param when redirecting', () => {
    render(
      <Provider store={createTestStore({ user: null })}>
        <MemoryRouter initialEntries={['/protected']}>
          <Routes>
            <Route
              path="/protected"
              element={<ProtectedRoute><div>Protected Content</div></ProtectedRoute>}
            />
            <Route
              path="/login"
              element={
                <div>
                  Login Page
                  <LocationSearch />
                </div>
              }
            />
          </Routes>
        </MemoryRouter>
      </Provider>
    );
    expect(screen.getByText('Login Page')).toBeInTheDocument();
    expect(screen.getByTestId('search').textContent).toBe(`?next=${encodeURIComponent('/protected')}`);
  });
});
