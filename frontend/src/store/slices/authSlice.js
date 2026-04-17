import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { post } from '../../api/drupalClient';

export const loginWithPassword = createAsyncThunk(
  'auth/loginWithPassword',
  async ({ name, pass }, { rejectWithValue }) => {
    try {
      const loginData = await post('/user/login?_format=json', { name, pass }, 'application/json');
      return loginData.current_user;
    } catch (err) {
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
      return JSON.parse(raw);
    } catch (err) {
      return rejectWithValue('No session');
    }
  }
);

export const logoutUser = createAsyncThunk(
  'auth/logoutUser',
  async (_, { rejectWithValue }) => {
    try {
      await post('/user/logout?_format=json', {}, 'application/json');
    } catch (err) {
      return rejectWithValue(err.message || 'Logout failed');
    }
  }
);

const authSlice = createSlice({
  name: 'auth',
  initialState: {
    user: null,
    csrfToken: null,
    status: 'idle',
    error: null,
  },
  reducers: {
    clearAuth(state) {
      state.user = null;
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
        state.user = action.payload;
        sessionStorage.setItem('auth_user', JSON.stringify(action.payload));
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
        state.csrfToken = null;
        state.status = 'idle';
        state.error = null;
        sessionStorage.removeItem('auth_user');
      });
  },
});

export const { clearAuth } = authSlice.actions;
export default authSlice.reducer;
