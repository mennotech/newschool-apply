import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import * as client from '../../api/drupalClient';

export const loginUser = createAsyncThunk(
  'auth/login',
  async ({ name, pass }, { rejectWithValue }) => {
    try {
      const data = await client.login(name, pass);
      return {
        user: {
          uid: data.current_user.uid,
          name: data.current_user.name,
          email: data.current_user.mail || '',
          roles: data.current_user.roles || [],
        },
        logoutToken: data.logout_token,
      };
    } catch (err) {
      return rejectWithValue(err.message);
    }
  }
);

export const logoutUser = createAsyncThunk(
  'auth/logout',
  async (_, { getState, rejectWithValue }) => {
    try {
      let token = getState().auth.logoutToken;
      if (!token) {
        token = await client.getLogoutToken();
      }
      await client.logout(token);
      return null;
    } catch (err) {
      return rejectWithValue(err.message);
    }
  }
);

export const checkLoginStatus = createAsyncThunk(
  'auth/checkLoginStatus',
  async (_, { getState, rejectWithValue }) => {
    try {
      const authenticated = await client.getLoginStatus();
      if (!authenticated) return null;

      const existingUser = getState().auth.user;
      if (existingUser) return existingUser;

      const sessionInfo = await fetch(
        `${process.env.REACT_APP_DRUPAL_BASE_URL || ''}/api/session/info?_format=json`,
        { credentials: 'include' }
      );
      if (!sessionInfo.ok) return null;
      const data = await sessionInfo.json();
      return {
        user: {
          uid: data.current_user.uid,
          name: data.current_user.name,
          email: data.current_user.mail || '',
          roles: data.current_user.roles || [],
        },
        logoutToken: data.logout_token,
      };
    } catch (err) {
      return rejectWithValue(err.message);
    }
  }
);

export const registerUser = createAsyncThunk(
  'auth/register',
  async ({ mail, pass, name }, { rejectWithValue }) => {
    try {
      const csrfToken = await client.getCsrfToken();
      const res = await fetch(
        `${process.env.REACT_APP_DRUPAL_BASE_URL || ''}/user/register?_format=json`,
        {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': csrfToken,
          },
          body: JSON.stringify({ mail: [{ value: mail }], pass: [{ value: pass }], name: [{ value: name }] }),
        }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        return rejectWithValue(body.message || 'Registration failed');
      }
      return await res.json();
    } catch (err) {
      return rejectWithValue(err.message);
    }
  }
);

const SESSION_STORAGE_KEY = 'auth_user';

function loadFromSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}

function saveToSession(user) {
  try {
    if (user) sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(user));
    else sessionStorage.removeItem(SESSION_STORAGE_KEY);
  } catch {}
}

const cachedUser = loadFromSession();

const authSlice = createSlice({
  name: 'auth',
  initialState: {
    user: cachedUser,
    logoutToken: null,
    status: 'idle',
    error: null,
  },
  reducers: {
    clearAuth(state) {
      state.user = null;
      state.logoutToken = null;
      state.status = 'idle';
      state.error = null;
      saveToSession(null);
    },
    setUser(state, action) {
      state.user = action.payload;
      saveToSession(action.payload);
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loginUser.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.status = 'idle';
        state.user = action.payload.user;
        state.logoutToken = action.payload.logoutToken;
        saveToSession(action.payload.user);
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.status = 'error';
        state.error = action.payload;
      })
      .addCase(logoutUser.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(logoutUser.fulfilled, (state) => {
        state.status = 'idle';
        state.user = null;
        state.logoutToken = null;
        saveToSession(null);
      })
      .addCase(logoutUser.rejected, (state, action) => {
        state.status = 'error';
        state.error = action.payload;
      })
      .addCase(checkLoginStatus.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(checkLoginStatus.fulfilled, (state, action) => {
        state.status = 'idle';
        if (action.payload) {
          if (action.payload.user) {
            state.user = action.payload.user;
            state.logoutToken = action.payload.logoutToken;
            saveToSession(action.payload.user);
          }
        } else {
          state.user = null;
          state.logoutToken = null;
          saveToSession(null);
        }
      })
      .addCase(checkLoginStatus.rejected, (state) => {
        state.status = 'idle';
      })
      .addCase(registerUser.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(registerUser.fulfilled, (state) => {
        state.status = 'idle';
      })
      .addCase(registerUser.rejected, (state, action) => {
        state.status = 'error';
        state.error = action.payload;
      });
  },
});

export const { clearAuth, setUser } = authSlice.actions;

export const selectUser = (state) => state.auth.user;
export const selectLogoutToken = (state) => state.auth.logoutToken;
export const selectAuthStatus = (state) => state.auth.status;
export const selectAuthError = (state) => state.auth.error;

export default authSlice.reducer;
