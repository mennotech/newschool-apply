import authReducer, { logoutUser } from './authSlice';

describe('authSlice logout handling', () => {
  const baseState = {
    user: { uid: '1', name: 'tester' },
    logoutToken: 'token-123',
    csrfToken: null,
    status: 'idle',
    error: null,
  };

  beforeEach(() => {
    sessionStorage.clear();
    sessionStorage.setItem('auth_user', JSON.stringify(baseState.user));
  });

  it('clears local auth state only when logout succeeds', () => {
    const nextState = authReducer(baseState, logoutUser.fulfilled());

    expect(nextState.user).toBeNull();
    expect(nextState.logoutToken).toBeNull();
    expect(nextState.status).toBe('idle');
    expect(nextState.error).toBeNull();
    expect(sessionStorage.getItem('auth_user')).toBeNull();
  });

  it('preserves local auth state when logout fails', () => {
    const nextState = authReducer(
      baseState,
      logoutUser.rejected(new Error('request failed'), '', undefined, 'Server logout failed')
    );

    expect(nextState.user).toEqual(baseState.user);
    expect(nextState.logoutToken).toBe(baseState.logoutToken);
    expect(nextState.status).toBe('error');
    expect(nextState.error).toBe('Server logout failed');
    expect(sessionStorage.getItem('auth_user')).toBe(JSON.stringify(baseState.user));
  });
});
