import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { get, post, patch, uploadFile } from '../../api/drupalClient';

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
      const data = {
        data: {
          type: 'node--application',
          attributes: {
            title: 'Application',
            field_status: 'pending',
          },
          relationships: {
            field_student_profile: {
              data: { type: 'node--student_profile', id: studentProfileId },
            },
          },
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
      });
  },
});

export const { setCurrentApplication, clearApplication } = applicationSlice.actions;
export default applicationSlice.reducer;
