import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import applicationReducer from './slices/applicationSlice';

const store = configureStore({
  reducer: {
    auth: authReducer,
    application: applicationReducer,
  },
});

export default store;
