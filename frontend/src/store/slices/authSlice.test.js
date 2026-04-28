import { configureStore } from '@reduxjs/toolkit';
import authReducer, {
  setUser,
  clearAuth,
  setLogoutToken,
  setStatus,
  setError,
  loginUser,
} from './authSlice';
import { server } from '../../mocks/server';
import { http, HttpResponse } from 'msw';

const BASE_URL = process.env.REACT_APP_DRUPAL_BASE_URL || 'http://localhost:8080';

function makeStore(preloadedState = {}) {
  return configureStore({
    reducer: { auth: authReducer },
    preloadedState,
  });
}

describe('authSlice reducers', () => {
  it('setUser stores user in state', () => {
    const store = makeStore();
    const user = { uid: 1, name: 'alice', email: 'alice@test.com', roles: ['authenticated'] };
    store.dispatch(setUser(user));
    expect(store.getState().auth.user).toEqual(user);
  });

  it('clearAuth resets all auth state', () => {
    const store = makeStore({
      auth: {
        user: { uid: 1, name: 'alice', email: 'a@a.com', roles: [] },
        logoutToken: 'tok',
        status: 'idle',
        error: 'some error',
      },
    });
    store.dispatch(clearAuth());
    expect(store.getState().auth.user).toBeNull();
    expect(store.getState().auth.logoutToken).toBeNull();
    expect(store.getState().auth.error).toBeNull();
  });

  it('setLogoutToken stores token', () => {
    const store = makeStore();
    store.dispatch(setLogoutToken('my-token'));
    expect(store.getState().auth.logoutToken).toBe('my-token');
  });

  it('setStatus updates status', () => {
    const store = makeStore();
    store.dispatch(setStatus('loading'));
    expect(store.getState().auth.status).toBe('loading');
  });

  it('setError updates error', () => {
    const store = makeStore();
    store.dispatch(setError('Something went wrong'));
    expect(store.getState().auth.error).toBe('Something went wrong');
  });
});

describe('loginUser thunk', () => {
  it('sets user and logoutToken on success', async () => {
    const store = makeStore();
    await store.dispatch(loginUser({ name: 'testuser', pass: 'password' }));
    const state = store.getState().auth;
    expect(state.user).toBeDefined();
    expect(state.user.name).toBe('testuser');
    expect(state.logoutToken).toBe('test-logout-token');
    expect(state.status).toBe('idle');
    expect(state.error).toBeNull();
  });

  it('sets error state on failure', async () => {
    server.use(
      http.post(`${BASE_URL}/user/login`, () =>
        HttpResponse.json({ message: 'Invalid credentials' }, { status: 400 })
      )
    );
    const store = makeStore();
    await store.dispatch(loginUser({ name: 'bad', pass: 'bad' }));
    const state = store.getState().auth;
    expect(state.status).toBe('error');
    expect(state.error).toBeTruthy();
    expect(state.user).toBeNull();
  });

  it('sets status to loading while pending', () => {
    const store = makeStore();
    store.dispatch(loginUser({ name: 'test', pass: 'test' }));
    expect(store.getState().auth.status).toBe('loading');
  });
});
