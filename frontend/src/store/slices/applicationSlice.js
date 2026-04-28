import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import * as client from '../../api/drupalClient';

const BASE = process.env.REACT_APP_DRUPAL_BASE_URL || '';

export const fetchApplications = createAsyncThunk(
  'application/fetchAll',
  async (_, { getState, rejectWithValue }) => {
    try {
      const bundle = getState().application.selectedBundle;
      const data = await client.get(`/jsonapi/node/${bundle}?include=field_student_profile&sort=-created`);
      return data;
    } catch (err) {
      return rejectWithValue(err.message);
    }
  }
);

export const createApplication = createAsyncThunk(
  'application/create',
  async ({ bundle, title }, { rejectWithValue }) => {
    try {
      const bundleType = bundle || 'application_partial_programming';
      const data = await client.post(`/jsonapi/node/${bundleType}`, {
        data: {
          type: `node--${bundleType}`,
          attributes: {
            title: title || 'New Application',
            field_application_status: 'draft',
          },
        },
      });
      return data.data;
    } catch (err) {
      return rejectWithValue(err.message);
    }
  }
);

export const fetchApplication = createAsyncThunk(
  'application/fetchOne',
  async (arg, { getState, rejectWithValue }) => {
    try {
      const id = typeof arg === 'string' ? arg : arg.id;
      const bundle = (typeof arg === 'object' && arg.bundle)
        ? arg.bundle
        : getState().application.selectedBundle;
      const data = await client.get(`/jsonapi/node/${bundle}/${id}?include=field_student_profile`);
      return data.data;
    } catch (err) {
      return rejectWithValue(err.message);
    }
  }
);

export const updateApplication = createAsyncThunk(
  'application/update',
  async ({ id, bundle, attributes, relationships }, { getState, rejectWithValue }) => {
    try {
      const currentApp = getState().application.currentApplication;
      const bundleType = bundle
        || (currentApp?.type ? currentApp.type.replace('node--', '') : null)
        || 'application_partial_programming';
      const body = {
        data: {
          type: `node--${bundleType}`,
          id,
          attributes: attributes || {},
        },
      };
      if (relationships) body.data.relationships = relationships;
      const data = await client.patch(`/jsonapi/node/${bundleType}/${id}`, body);
      return data.data;
    } catch (err) {
      return rejectWithValue(err.message);
    }
  }
);

export const deleteApplication = createAsyncThunk(
  'application/delete',
  async ({ id, bundle }, { rejectWithValue }) => {
    try {
      const bundleType = bundle || 'application_partial_programming';
      await client.delete_(`/jsonapi/node/${bundleType}/${id}`);
      return id;
    } catch (err) {
      return rejectWithValue(err.message);
    }
  }
);

export const uploadDocument = createAsyncThunk(
  'application/uploadDocument',
  async ({ applicationId, file, documentType }, { getState, rejectWithValue }) => {
    try {
      const currentApp = getState().application.currentApplication;
      const applicationType = currentApp?.type || 'node--application_partial_programming';
      const fileData = await client.uploadFile(
        `/jsonapi/node/document/field_file`,
        file
      );
      const csrfToken = await client.getCsrfToken();
      const res = await fetch(`${BASE}/jsonapi/node/document`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/vnd.api+json',
          Accept: 'application/vnd.api+json',
          'X-CSRF-Token': csrfToken,
        },
        body: JSON.stringify({
          data: {
            type: 'node--document',
            attributes: {
              title: file.name,
              field_document_type: documentType || 'other',
            },
            relationships: {
              field_application: {
                data: { type: applicationType, id: applicationId },
              },
              field_file: {
                data: { type: 'file--file', id: fileData.data.id },
              },
            },
          },
        }),
      });
      if (!res.ok) throw new Error('Document creation failed');
      return await res.json();
    } catch (err) {
      return rejectWithValue(err.message);
    }
  }
);

const applicationSlice = createSlice({
  name: 'application',
  initialState: {
    list: [],
    currentApplication: null,
    selectedBundle: 'application_partial_programming',
    status: 'idle',
    error: null,
    paymentByApplication: {},
  },
  reducers: {
    setCurrentApplication(state, action) {
      state.currentApplication = action.payload;
    },
    clearCurrentApplication(state) {
      state.currentApplication = null;
    },
    setSelectedBundle(state, action) {
      state.selectedBundle = action.payload;
    },
    setPaymentConfirmation(state, action) {
      const { applicationId, receiptUrl } = action.payload;
      state.paymentByApplication[applicationId] = receiptUrl;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchApplications.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(fetchApplications.fulfilled, (state, action) => {
        state.status = 'idle';
        state.list = action.payload.data || [];
      })
      .addCase(fetchApplications.rejected, (state, action) => {
        state.status = 'error';
        state.error = action.payload;
      })
      .addCase(createApplication.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(createApplication.fulfilled, (state, action) => {
        state.status = 'idle';
        state.currentApplication = action.payload;
        state.list = [...state.list, action.payload];
      })
      .addCase(createApplication.rejected, (state, action) => {
        state.status = 'error';
        state.error = action.payload;
      })
      .addCase(fetchApplication.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(fetchApplication.fulfilled, (state, action) => {
        state.status = 'idle';
        state.currentApplication = action.payload;
      })
      .addCase(fetchApplication.rejected, (state, action) => {
        state.status = 'error';
        state.error = action.payload;
      })
      .addCase(updateApplication.fulfilled, (state, action) => {
        state.currentApplication = action.payload;
        const idx = state.list.findIndex((a) => a.id === action.payload.id);
        if (idx !== -1) state.list[idx] = action.payload;
      })
      .addCase(deleteApplication.fulfilled, (state, action) => {
        state.list = state.list.filter((a) => a.id !== action.payload);
        if (state.currentApplication && state.currentApplication.id === action.payload) {
          state.currentApplication = null;
        }
      });
  },
});

export const {
  setCurrentApplication,
  clearCurrentApplication,
  setSelectedBundle,
  setPaymentConfirmation,
} = applicationSlice.actions;

export const selectApplicationList = (state) => state.application.list;
export const selectCurrentApplication = (state) => state.application.currentApplication;
export const selectApplicationStatus = (state) => state.application.status;
export const selectApplicationError = (state) => state.application.error;
export const selectSelectedBundle = (state) => state.application.selectedBundle;
export const selectPaymentByApplication = (state) => state.application.paymentByApplication;

export default applicationSlice.reducer;
