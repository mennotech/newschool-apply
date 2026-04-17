import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import applicationReducer from './slices/applicationSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    application: applicationReducer,
  },
});
