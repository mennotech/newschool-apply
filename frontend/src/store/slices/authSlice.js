import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { post, get, logout, getLoginStatus, getLogoutToken } from '../../api/drupalClient';

/**
 * Fetches the authenticated user's email via JSON:API.
 * /user/{uid}?_format=json is a rendered HTML route and does not support JSON.
 * JSON:API is the correct way to retrieve user entity data.
 */
async function fetchUserMail(uid) {
  const resp = await get(`/jsonapi/user/user?filter[drupal_internal__uid]=${uid}`);
  return resp?.data?.[0]?.attributes?.mail || null;
}

async function attemptLogin(name, pass) {
  const loginData = await post('/user/login?_format=json', { name, pass }, 'application/json');
  const uid = loginData.current_user?.uid;
  let fullUser = loginData.current_user;
  if (uid) {
    try {
      const mail = await fetchUserMail(uid);
      fullUser = { ...loginData.current_user, mail };
    } catch (_) {
      // If we can't fetch the email, proceed without it
    }
  }
  return { user: fullUser, logoutToken: loginData.logout_token };
}

export const loginWithPassword = createAsyncThunk(
  'auth/loginWithPassword',
  async ({ name, pass }, { rejectWithValue }) => {
    try {
      return await attemptLogin(name, pass);
    } catch (err) {
      // Drupal rejects login with 403 when a stale session cookie is still active.
      // Clear that session and retry once.
      if (err.status === 403) {
        try {
          let recoveredToken = null;
          try {
            recoveredToken = await getLogoutToken();
          } catch (_) {
            // Fall through and attempt logout without a recovered token.
          }
          await logout(recoveredToken);
        } catch (_) {
          // Ignore logout errors; the session may already be invalid
        }
        sessionStorage.removeItem('auth_user');
        try {
          return await attemptLogin(name, pass);
        } catch (retryErr) {
          return rejectWithValue(retryErr.message || 'Login failed');
        }
      }
      return rejectWithValue(err.message || 'Login failed');
    }
  }
);

export const fetchCurrentUser = createAsyncThunk(
  'auth/fetchCurrentUser',
  async (_, { rejectWithValue }) => {
    try {
      const raw = sessionStorage.getItem('auth_user');
      if (!raw) {
        // If Drupal session exists (e.g. user logged in from Drupal UI),
        // bootstrap a lightweight frontend auth user from backend session state.
        const isLoggedIn = await getLoginStatus();
        if (!isLoggedIn) return rejectWithValue('No session');

        const backendSessionUser = {
          uid: 'session',
          name: 'Authenticated User',
        };
        sessionStorage.setItem('auth_user', JSON.stringify(backendSessionUser));
        return backendSessionUser;
      }

      const storedUser = JSON.parse(raw);
      if (!storedUser || !storedUser.uid) {
        sessionStorage.removeItem('auth_user');
        return rejectWithValue('No session');
      }

      // Verify session state via Drupal's auth status route.
      try {
        const isLoggedIn = await getLoginStatus();
        if (!isLoggedIn) {
          sessionStorage.removeItem('auth_user');
          return rejectWithValue('Session expired');
        }

        // Session is active; enrich user data when possible.
        const mail = await fetchUserMail(storedUser.uid);
        const updatedUser = { ...storedUser, mail };
        sessionStorage.setItem('auth_user', JSON.stringify(updatedUser));
        return updatedUser;
      } catch (verifyErr) {
        if (verifyErr.status === 401) {
          sessionStorage.removeItem('auth_user');
          return rejectWithValue('Session expired');
        }
        // Network or other error — fall back to stored user rather than forcing logout
        return storedUser;
      }
    } catch (err) {
      return rejectWithValue('No session');
    }
  }
);

export const registerUser = createAsyncThunk(
  'auth/registerUser',
  async ({ mail, pass }, { rejectWithValue }) => {
    try {
      await post(
        '/jsonapi/user/user',
        {
          data: {
            type: 'user--user',
            attributes: {
              name: mail,
              mail,
              pass: { value: pass },
            },
          },
        },
        'application/vnd.api+json'
      );
    } catch (err) {
      return rejectWithValue(err.message || 'Registration failed');
    }
  }
);

export const logoutUser = createAsyncThunk(
  'auth/logoutUser',
  async (_, { getState, rejectWithValue }) => {
    try {
      const { logoutToken } = getState().auth;
      let effectiveLogoutToken = logoutToken || null;
      if (!effectiveLogoutToken) {
        try {
          effectiveLogoutToken = await getLogoutToken();
        } catch (_) {
          // If we cannot recover a logout token, attempt logout anyway.
        }
      }
      await logout(effectiveLogoutToken);
    } catch (err) {
      console.error('Logout request failed', {
        status: err?.status || null,
        message: err?.message || 'Unknown logout error',
      });
      return rejectWithValue(err.message || 'Logout failed');
    }
  }
);

const authSlice = createSlice({
  name: 'auth',
  initialState: {
    user: null,
    logoutToken: null,
    csrfToken: null,
    status: 'idle',
    error: null,
  },
  reducers: {
    clearAuth(state) {
      state.user = null;
      state.logoutToken = null;
      state.csrfToken = null;
      state.status = 'idle';
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loginWithPassword.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(loginWithPassword.fulfilled, (state, action) => {
        state.status = 'idle';
        state.user = action.payload.user;
        state.logoutToken = action.payload.logoutToken || null;
        sessionStorage.setItem('auth_user', JSON.stringify(action.payload.user));
      })
      .addCase(loginWithPassword.rejected, (state, action) => {
        state.status = 'error';
        state.error = action.payload;
      })
      .addCase(registerUser.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(registerUser.fulfilled, (state) => {
        state.status = 'idle';
        state.error = null;
      })
      .addCase(registerUser.rejected, (state, action) => {
        state.status = 'error';
        state.error = action.payload;
      })
      .addCase(fetchCurrentUser.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(fetchCurrentUser.fulfilled, (state, action) => {
        state.status = 'idle';
        state.user = action.payload;
      })
      .addCase(fetchCurrentUser.rejected, (state) => {
        state.status = 'idle';
        state.user = null;
      })
      .addCase(logoutUser.fulfilled, (state) => {
        state.user = null;
        state.logoutToken = null;
        state.csrfToken = null;
        state.status = 'idle';
        state.error = null;
        sessionStorage.removeItem('auth_user');
      })
      .addCase(logoutUser.rejected, (state, action) => {
        // Preserve local auth state when server-side logout fails.
        // This avoids presenting a logged-out UI while the Drupal session cookie still exists.
        state.status = 'error';
        state.error = action.payload || 'Logout failed';
      });
  },
});

export const { clearAuth } = authSlice.actions;
export default authSlice.reducer;
