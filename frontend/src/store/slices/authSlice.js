import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import * as drupalClient from '../../api/drupalClient';

const SESSION_KEY = 'nsa_auth_user';

function saveUserToSession(user) {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(user));
  } catch {
    // sessionStorage may be unavailable
  }
}

function loadUserFromSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function clearUserFromSession() {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // ignore
  }
}

export const loginUser = createAsyncThunk(
  'auth/loginUser',
  async ({ name, pass }, { rejectWithValue }) => {
    try {
      const data = await drupalClient.login(name, pass);
      return data;
    } catch (err) {
      return rejectWithValue(err.message || 'Login failed');
    }
  }
);

export const logoutUser = createAsyncThunk(
  'auth/logoutUser',
  async (_, { getState, rejectWithValue }) => {
    try {
      let { logoutToken } = getState().auth;
      if (!logoutToken) {
        logoutToken = await drupalClient.getLogoutToken();
      }
      await drupalClient.logout(logoutToken);
      return true;
    } catch (err) {
      return rejectWithValue(err.message || 'Logout failed');
    }
  }
);

export const checkLoginStatus = createAsyncThunk(
  'auth/checkLoginStatus',
  async (_, { getState, dispatch, rejectWithValue }) => {
    try {
      const isLoggedIn = await drupalClient.getLoginStatus();
      if (!isLoggedIn) {
        clearUserFromSession();
        return null;
      }
      const { user } = getState().auth;
      if (user) {
        return user;
      }
      // Bootstrap from session (e.g., logged in via Drupal admin)
      const result = await dispatch(bootstrapSession());
      if (bootstrapSession.fulfilled.match(result)) {
        return result.payload;
      }
      return null;
    } catch (err) {
      return rejectWithValue(err.message || 'Session check failed');
    }
  }
);

export const bootstrapSession = createAsyncThunk(
  'auth/bootstrapSession',
  async (_, { rejectWithValue }) => {
    try {
      const sessionInfo = await drupalClient.getLogoutToken();
      return sessionInfo;
    } catch (err) {
      return rejectWithValue(err.message || 'Bootstrap failed');
    }
  }
);

const initialState = {
  user: loadUserFromSession(),
  logoutToken: null,
  status: 'idle',
  error: null,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setUser(state, action) {
      state.user = action.payload;
      saveUserToSession(action.payload);
    },
    setLogoutToken(state, action) {
      state.logoutToken = action.payload;
    },
    clearAuth(state) {
      state.user = null;
      state.logoutToken = null;
      state.status = 'idle';
      state.error = null;
      clearUserFromSession();
    },
    setStatus(state, action) {
      state.status = action.payload;
    },
    setError(state, action) {
      state.error = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      // loginUser
      .addCase(loginUser.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.status = 'idle';
        const { current_user, logout_token } = action.payload;
        state.user = {
          uid: current_user.uid,
          name: current_user.name,
          email: current_user.mail,
          roles: current_user.roles || ['authenticated'],
        };
        state.logoutToken = logout_token;
        saveUserToSession(state.user);
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.status = 'error';
        state.error = action.payload || 'Login failed';
      })
      // logoutUser
      .addCase(logoutUser.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(logoutUser.fulfilled, (state) => {
        state.user = null;
        state.logoutToken = null;
        state.status = 'idle';
        state.error = null;
        clearUserFromSession();
      })
      .addCase(logoutUser.rejected, (state, action) => {
        // Do NOT clear local state on failed logout
        state.status = 'error';
        state.error = action.payload || 'Logout failed';
      })
      // checkLoginStatus
      .addCase(checkLoginStatus.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(checkLoginStatus.fulfilled, (state, action) => {
        state.status = 'idle';
        if (action.payload === null) {
          state.user = null;
          state.logoutToken = null;
          clearUserFromSession();
        }
      })
      .addCase(checkLoginStatus.rejected, (state) => {
        state.status = 'idle';
      })
      // bootstrapSession
      .addCase(bootstrapSession.fulfilled, (state, action) => {
        if (action.payload) {
          const { current_user, logout_token } = action.payload;
          if (current_user) {
            state.user = {
              uid: current_user.uid,
              name: current_user.name,
              email: current_user.mail,
              roles: current_user.roles || ['authenticated'],
            };
            saveUserToSession(state.user);
          }
          if (logout_token) {
            state.logoutToken = logout_token;
          }
        }
      });
  },
});

export const { setUser, setLogoutToken, clearAuth, setStatus, setError } =
  authSlice.actions;

export default authSlice.reducer;
