import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  currentApplication: null,
  steps: [],
  status: 'idle',
  error: null,
  paymentByApplication: {},
};

const applicationSlice = createSlice({
  name: 'application',
  initialState,
  reducers: {
    setCurrentApplication(state, action) {
      state.currentApplication = action.payload;
    },
    clearApplication(state) {
      state.currentApplication = null;
      state.steps = [];
      state.status = 'idle';
      state.error = null;
    },
    setSteps(state, action) {
      state.steps = action.payload;
    },
    setApplicationStatus(state, action) {
      state.status = action.payload;
    },
    setApplicationError(state, action) {
      state.error = action.payload;
    },
    setPaymentConfirmation(state, action) {
      const { applicationId, receiptUrl, paymentStatus } = action.payload;
      state.paymentByApplication[applicationId] = { receiptUrl, paymentStatus };
    },
  },
});

export const {
  setCurrentApplication,
  clearApplication,
  setSteps,
  setApplicationStatus,
  setApplicationError,
  setPaymentConfirmation,
} = applicationSlice.actions;

export default applicationSlice.reducer;
