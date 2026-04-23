import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { del, get, post, patch, uploadFile } from '../../api/drupalClient';

export const fetchApplications = createAsyncThunk(
  'application/fetchApplications',
  async (_, { rejectWithValue }) => {
    try {
      const result = await get('/jsonapi/node/application?sort=-created');
      return result.data;
    } catch (err) {
      return rejectWithValue(err.message || 'Failed to fetch applications');
    }
  }
);

export const createApplication = createAsyncThunk(
  'application/createApplication',
  async (studentProfileId, { rejectWithValue }) => {
    try {
      const relationships = studentProfileId
        ? {
          field_student_profile: {
            data: { type: 'node--student_profile', id: studentProfileId },
          },
        }
        : undefined;

      const data = {
        data: {
          type: 'node--application',
          attributes: {
            title: 'Application',
            field_status: 'pending',
          },
          ...(relationships ? { relationships } : {}),
        },
      };
      const result = await post('/jsonapi/node/application', data);
      return result.data;
    } catch (err) {
      return rejectWithValue(err.message || 'Failed to create application');
    }
  }
);

export const submitApplication = createAsyncThunk(
  'application/submitApplication',
  async (applicationId, { rejectWithValue }) => {
    try {
      const data = {
        data: {
          type: 'node--application',
          id: applicationId,
          attributes: {
            field_status: 'submitted',
            field_submitted_at: new Date().toISOString().replace(/\.\d{3}Z$/, '+00:00'),
          },
        },
      };
      const result = await patch(`/jsonapi/node/application/${applicationId}`, data);
      return result.data;
    } catch (err) {
      return rejectWithValue(err.message || 'Failed to submit application');
    }
  }
);

/**
 * Upload a file to field_file and then create the node--document entity
 * that links the file to the given application.
 * Argument: { applicationId, documentType, file }
 */
export const uploadAndCreateDocument = createAsyncThunk(
  'application/uploadAndCreateDocument',
  async ({ applicationId, documentType, file }, { rejectWithValue }) => {
    try {
      // Step 1: upload raw binary to get a file entity UUID
      const fileResult = await uploadFile('/jsonapi/node/document/field_file', file);
      const fileId = fileResult.data?.id;

      // Step 2: create the node--document referencing both the application and the file
      const result = await post('/jsonapi/node/document', {
        data: {
          type: 'node--document',
          attributes: {
            title: file.name,
            field_document_type: documentType,
          },
          relationships: {
            field_application: {
              data: { type: 'node--application', id: applicationId },
            },
            field_file: {
              data: { type: 'file--file', id: fileId },
            },
          },
        },
      });
      return result.data;
    } catch (err) {
      return rejectWithValue(err.message || 'Failed to upload document');
    }
  }
);

export const fetchApplicationById = createAsyncThunk(
  'application/fetchApplicationById',
  async (applicationId, { rejectWithValue }) => {
    try {
      const result = await get(`/jsonapi/node/application/${applicationId}`);
      return result.data;
    } catch (err) {
      return rejectWithValue(err.message || 'Failed to fetch application');
    }
  }
);

export const deleteApplication = createAsyncThunk(
  'application/deleteApplication',
  async (applicationId, { rejectWithValue }) => {
    try {
      await del(`/jsonapi/node/application/${applicationId}`);
      return applicationId;
    } catch (err) {
      return rejectWithValue(err.message || 'Failed to delete application');
    }
  }
);

export const patchDraftApplication = createAsyncThunk(
  'application/patchDraftApplication',
  async ({ applicationId, attributes, relationships }, { rejectWithValue }) => {
    try {
      const data = {
        data: {
          type: 'node--application',
          id: applicationId,
          ...(attributes ? { attributes } : {}),
          ...(relationships ? { relationships } : {}),
        },
      };
      const result = await patch(`/jsonapi/node/application/${applicationId}`, data);
      return result.data;
    } catch (err) {
      return rejectWithValue(err.message || 'Failed to autosave');
    }
  }
);

/**
 * Patch all application form fields and mark the application as submitted in one request.
 * Argument: { applicationId, attributes } where attributes is the full field map.
 */
export const patchAndSubmitApplication = createAsyncThunk(
  'application/patchAndSubmitApplication',
  async ({ applicationId, attributes }, { rejectWithValue }) => {
    try {
      const data = {
        data: {
          type: 'node--application',
          id: applicationId,
          attributes: {
            ...attributes,
            field_status: 'submitted',
            field_submitted_at: new Date().toISOString().replace(/\.\d{3}Z$/, '+00:00'),
          },
        },
      };
      const result = await patch(`/jsonapi/node/application/${applicationId}`, data);
      return result.data;
    } catch (err) {
      return rejectWithValue(err.message || 'Failed to submit application');
    }
  }
);

const applicationSlice = createSlice({
  name: 'application',
  initialState: {
    currentApplication: null,
    applications: [],
    fetchStatus: 'idle',
    steps: [],
    status: 'idle',
    error: null,
  },
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
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchApplications.pending, (state) => {
        state.fetchStatus = 'loading';
      })
      .addCase(fetchApplications.fulfilled, (state, action) => {
        state.fetchStatus = 'idle';
        state.applications = action.payload;
      })
      .addCase(fetchApplications.rejected, (state) => {
        state.fetchStatus = 'error';
      })
      .addCase(createApplication.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(createApplication.fulfilled, (state, action) => {
        state.status = 'idle';
        state.currentApplication = action.payload;
      })
      .addCase(createApplication.rejected, (state, action) => {
        state.status = 'error';
        state.error = action.payload;
      })
      .addCase(submitApplication.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(submitApplication.fulfilled, (state, action) => {
        state.status = 'idle';
        state.currentApplication = action.payload;
      })
      .addCase(submitApplication.rejected, (state, action) => {
        state.status = 'error';
        state.error = action.payload;
      })
      .addCase(uploadAndCreateDocument.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(uploadAndCreateDocument.fulfilled, (state) => {
        state.status = 'idle';
      })
      .addCase(uploadAndCreateDocument.rejected, (state, action) => {
        state.status = 'error';
        state.error = action.payload;
      })
      .addCase(fetchApplicationById.pending, (state) => {
        state.fetchStatus = 'loading';
      })
      .addCase(fetchApplicationById.fulfilled, (state, action) => {
        state.fetchStatus = 'idle';
        state.currentApplication = action.payload;
      })
      .addCase(fetchApplicationById.rejected, (state) => {
        state.fetchStatus = 'error';
      })
      .addCase(patchDraftApplication.rejected, (state, action) => {
        state.error = action.payload;
      })
      .addCase(deleteApplication.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(deleteApplication.fulfilled, (state, action) => {
        state.status = 'idle';
        state.applications = state.applications.filter((app) => app.id !== action.payload);
        if (state.currentApplication?.id === action.payload) {
          state.currentApplication = null;
        }
      })
      .addCase(deleteApplication.rejected, (state, action) => {
        state.status = 'error';
        state.error = action.payload;
      })
      .addCase(patchAndSubmitApplication.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(patchAndSubmitApplication.fulfilled, (state, action) => {
        state.status = 'idle';
        state.currentApplication = action.payload;
      })
      .addCase(patchAndSubmitApplication.rejected, (state, action) => {
        state.status = 'error';
        state.error = action.payload;
      });
  },
});

export const { setCurrentApplication, clearApplication } = applicationSlice.actions;
export default applicationSlice.reducer;
