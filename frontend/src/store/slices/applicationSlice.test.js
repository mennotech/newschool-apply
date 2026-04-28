import { configureStore } from '@reduxjs/toolkit';
import { rest } from 'msw';
import { server } from '../../mocks/server';
import applicationReducer, {
  fetchApplications,
  createApplication,
  fetchApplication,
  updateApplication,
  deleteApplication,
  setCurrentApplication,
  clearCurrentApplication,
  selectApplicationList,
  selectCurrentApplication,
  selectApplicationStatus,
} from './applicationSlice';

const BASE = 'http://localhost:8080';

function createStore(preloadedState = {}) {
  return configureStore({
    reducer: { application: applicationReducer },
    preloadedState,
  });
}

describe('applicationSlice', () => {
  describe('initial state', () => {
    it('has empty list and idle status', () => {
      const store = createStore();
      const state = store.getState();
      expect(selectApplicationList(state)).toEqual([]);
      expect(selectCurrentApplication(state)).toBeNull();
      expect(selectApplicationStatus(state)).toBe('idle');
    });
  });

  describe('setCurrentApplication', () => {
    it('sets current application', () => {
      const store = createStore();
      const app = { id: 'test-id', type: 'node--application_partial_programming', attributes: {} };
      store.dispatch(setCurrentApplication(app));
      expect(selectCurrentApplication(store.getState())).toEqual(app);
    });
  });

  describe('clearCurrentApplication', () => {
    it('clears current application', () => {
      const store = createStore({
        application: {
          list: [],
          currentApplication: { id: 'test', type: 'node--application_partial_programming', attributes: {} },
          selectedBundle: 'application_partial_programming',
          status: 'idle',
          error: null,
          paymentByApplication: {},
        },
      });
      store.dispatch(clearCurrentApplication());
      expect(selectCurrentApplication(store.getState())).toBeNull();
    });
  });

  describe('fetchApplications thunk', () => {
    it('populates application list on success', async () => {
      const store = createStore();
      await store.dispatch(fetchApplications());
      const list = selectApplicationList(store.getState());
      expect(list.length).toBeGreaterThan(0);
      expect(list[0].id).toBe('app-uuid-1');
    });

    it('sets error state on failure', async () => {
      server.use(
        rest.get(`${BASE}/jsonapi/node/application_partial_programming`, (req, res, ctx) =>
          res(ctx.status(500), ctx.json({ message: 'Server error' }))
        )
      );
      const store = createStore();
      await store.dispatch(fetchApplications());
      expect(selectApplicationStatus(store.getState())).toBe('error');
    });
  });

  describe('createApplication thunk', () => {
    it('adds new application to list', async () => {
      const store = createStore();
      await store.dispatch(createApplication({ bundle: 'application_partial_programming', title: 'Test App' }));
      const list = selectApplicationList(store.getState());
      expect(list.length).toBeGreaterThan(0);
    });
  });

  describe('deleteApplication thunk', () => {
    it('removes application from list', async () => {
      const store = createStore({
        application: {
          list: [
            {
              id: 'app-uuid-1',
              type: 'node--application_partial_programming',
              attributes: { field_application_status: 'draft' },
            },
          ],
          currentApplication: null,
          selectedBundle: 'application_partial_programming',
          status: 'idle',
          error: null,
          paymentByApplication: {},
        },
      });
      await store.dispatch(deleteApplication({ id: 'app-uuid-1', bundle: 'application_partial_programming' }));
      expect(selectApplicationList(store.getState())).toHaveLength(0);
    });
  });

  describe('updateApplication thunk', () => {
    it('updates current application attributes', async () => {
      const store = createStore({
        application: {
          list: [{ id: 'app-uuid-1', type: 'node--application_partial_programming', attributes: { field_application_status: 'draft' } }],
          currentApplication: { id: 'app-uuid-1', type: 'node--application_partial_programming', attributes: { field_application_status: 'draft' } },
          selectedBundle: 'application_partial_programming',
          status: 'idle',
          error: null,
          paymentByApplication: {},
        },
      });
      await store.dispatch(updateApplication({
        id: 'app-uuid-1',
        attributes: { field_student_first_name: 'John' },
      }));
      const current = selectCurrentApplication(store.getState());
      expect(current).not.toBeNull();
    });
  });
});
