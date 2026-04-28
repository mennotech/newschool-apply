import { configureStore } from '@reduxjs/toolkit';
import { rest } from 'msw';
import { server } from '../../mocks/server';
import authReducer, {
  loginUser,
  logoutUser,
  registerUser,
  checkLoginStatus,
  clearAuth,
  selectUser,
  selectAuthStatus,
  selectAuthError,
} from './authSlice';

const BASE = 'http://localhost:8080';
const SESSION_STORAGE_KEY = 'auth_user';

function createStore(preloadedState = {}) {
  return configureStore({
    reducer: { auth: authReducer },
    preloadedState,
  });
}

describe('authSlice', () => {
  beforeEach(() => {
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
  });

  afterEach(() => {
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
  });
  describe('initial state', () => {
    it('has null user and idle status', () => {
      const store = createStore();
      const state = store.getState();
      expect(selectUser(state)).toBeNull();
      expect(selectAuthStatus(state)).toBe('idle');
      expect(selectAuthError(state)).toBeNull();
    });
  });

  describe('loginUser thunk', () => {
    it('sets user on successful login', async () => {
      server.use(
        rest.post(`${BASE}/user/login`, async (req, res, ctx) => {
          return res(ctx.status(200), ctx.json({
            current_user: { uid: '1', name: 'testuser', mail: 'test@example.com', roles: ['authenticated'] },
            logout_token: 'logout-123',
            csrf_token: 'csrf-123',
          }));
        })
      );

      const store = createStore();
      await store.dispatch(loginUser({ name: 'testuser', pass: 'password' }));
      const state = store.getState();
      expect(selectUser(state)).toEqual({
        uid: '1',
        name: 'testuser',
        email: 'test@example.com',
        roles: ['authenticated'],
      });
    });

    it('sets error on failed login', async () => {
      const store = createStore();
      await store.dispatch(loginUser({ name: 'bad', pass: 'wrong' }));
      const state = store.getState();
      expect(selectUser(state)).toBeNull();
      expect(selectAuthError(state)).toBeTruthy();
    });

    it('sets loading status during login', () => {
      const store = createStore();
      store.dispatch(loginUser({ name: 'testuser', pass: 'password' }));
      expect(selectAuthStatus(store.getState())).toBe('loading');
    });
  });

  describe('logoutUser thunk', () => {
    it('clears user on successful logout', async () => {
      const store = createStore({
        auth: {
          user: { uid: '1', name: 'testuser', email: 'test@example.com', roles: [] },
          logoutToken: 'mock-logout-token',
          status: 'idle',
          error: null,
        },
      });

      await store.dispatch(logoutUser());
      const state = store.getState();
      expect(selectUser(state)).toBeNull();
    });
  });

  describe('registerUser thunk', () => {
    it('returns idle status after successful registration', async () => {
      const store = createStore();
      await store.dispatch(registerUser({ mail: 'new@example.com', pass: 'password123', name: 'newuser' }));
      expect(selectAuthStatus(store.getState())).toBe('idle');
    });
  });

  describe('clearAuth action', () => {
    it('clears user and token', () => {
      const store = createStore({
        auth: {
          user: { uid: '1', name: 'test', email: 'test@example.com', roles: [] },
          logoutToken: 'token',
          status: 'idle',
          error: null,
        },
      });
      store.dispatch(clearAuth());
      expect(selectUser(store.getState())).toBeNull();
    });
  });

  describe('checkLoginStatus thunk', () => {
    it('clears user when not authenticated', async () => {
      const store = createStore({
        auth: {
          user: { uid: '1', name: 'test', email: 'test@example.com', roles: [] },
          logoutToken: 'token',
          status: 'idle',
          error: null,
        },
      });

      await store.dispatch(checkLoginStatus());
      expect(selectUser(store.getState())).toBeNull();
    });

    it('keeps existing user when authenticated', async () => {
      server.use(
        rest.get(`${BASE}/user/login_status`, (req, res, ctx) =>
          res(ctx.status(200), ctx.text('1'))
        )
      );

      const existingUser = { uid: '1', name: 'testuser', email: 'test@example.com', roles: [] };
      const store = createStore({
        auth: { user: existingUser, logoutToken: 'token', status: 'idle', error: null },
      });

      await store.dispatch(checkLoginStatus());
      expect(selectUser(store.getState())).toEqual(existingUser);
    });
  });
});
