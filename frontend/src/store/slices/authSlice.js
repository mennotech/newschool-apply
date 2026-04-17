import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { post, get } from '../../api/drupalClient';

async function attemptLogin(name, pass) {
  const loginData = await post('/user/login?_format=json', { name, pass }, 'application/json');
  const uid = loginData.current_user?.uid;
  let fullUser = loginData.current_user;
  if (uid) {
    try {
      const userEntity = await get(`/user/${uid}?_format=json`);
      fullUser = { ...loginData.current_user, mail: userEntity.mail?.[0]?.value };
    } catch (_) {
      // If we can't fetch the full user, proceed without email
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
          await post('/user/logout?_format=json', {}, 'application/json');
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
      if (!raw) return rejectWithValue('No session');
      const storedUser = JSON.parse(raw);
      if (!storedUser || !storedUser.uid) return rejectWithValue('No session');

      // Verify the Drupal session is still active and fetch email if missing.
      // A 403 here means the session has been invalidated (e.g. logged out in Drupal).
      try {
        const userEntity = await get(`/user/${storedUser.uid}?_format=json`);
        const updatedUser = { ...storedUser, mail: userEntity.mail?.[0]?.value };
        sessionStorage.setItem('auth_user', JSON.stringify(updatedUser));
        return updatedUser;
      } catch (verifyErr) {
        if (verifyErr.status === 403 || verifyErr.status === 401) {
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

export const logoutUser = createAsyncThunk(
  'auth/logoutUser',
  async (_, { getState, rejectWithValue }) => {
    try {
      const { logoutToken } = getState().auth;
      const path = logoutToken
        ? `/user/logout?_format=json&token=${encodeURIComponent(logoutToken)}`
        : '/user/logout?_format=json';
      await post(path, {}, 'application/json');
    } catch (err) {
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
      .addCase(logoutUser.rejected, (state) => {
        // Clear local auth state even if the server-side logout call failed
        state.user = null;
        state.logoutToken = null;
        state.csrfToken = null;
        state.status = 'idle';
        state.error = null;
        sessionStorage.removeItem('auth_user');
      });
  },
});

export const { clearAuth } = authSlice.actions;
export default authSlice.reducer;
