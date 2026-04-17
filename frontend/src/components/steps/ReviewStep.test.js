import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { rest } from 'msw';
import { server } from '../../mocks/server';
import authReducer from '../../store/slices/authSlice';
import applicationReducer from '../../store/slices/applicationSlice';
import ReviewStep from './ReviewStep';

const BASE_URL = 'http://localhost:8080';
process.env.REACT_APP_DRUPAL_BASE_URL = BASE_URL;

const studentInfo = {
  id: 'sp-1',
  type: 'node--student_profile',
  attributes: {
    field_first_name: 'Alice',
    field_last_name: 'Smith',
    field_date_of_birth: '2010-01-15',
    field_grade_applying_for: '5',
  },
};
const documents = [{ id: 'f1', name: 'transcript.pdf' }];

function buildStore(applicationId = 'app-1') {
  return configureStore({
    reducer: { auth: authReducer, application: applicationReducer },
    preloadedState: {
      auth: { user: { uid: 1 }, csrfToken: null, status: 'idle', error: null },
      application: {
        currentApplication: { id: applicationId, type: 'node--application', attributes: { field_status: 'pending' } },
        steps: [],
        status: 'idle',
        error: null,
      },
    },
  });
}

function renderReviewStep() {
  return render(
    <Provider store={buildStore()}>
      <ReviewStep studentInfo={studentInfo} documents={documents} />
    </Provider>
  );
}

describe('ReviewStep', () => {
  it('displays summary of entered data', () => {
    renderReviewStep();
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Smith')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('transcript.pdf')).toBeInTheDocument();
  });

  it('calls PATCH on Submit Application click', async () => {
    let patched = false;
    server.use(
      rest.get(`${BASE_URL}/session/token`, (req, res, ctx) => res(ctx.text('t'))),
      rest.patch(`${BASE_URL}/jsonapi/node/application/app-1`, (req, res, ctx) => {
        patched = true;
        return res(ctx.status(200), ctx.json({ data: { id: 'app-1', attributes: { field_status: 'submitted' } } }));
      })
    );

    renderReviewStep();
    await userEvent.click(screen.getByRole('button', { name: /submit application/i }));

    await waitFor(() => expect(patched).toBe(true));
  });

  it('shows success state after submission', async () => {
    server.use(
      rest.get(`${BASE_URL}/session/token`, (req, res, ctx) => res(ctx.text('t'))),
      rest.patch(`${BASE_URL}/jsonapi/node/application/:id`, (req, res, ctx) =>
        res(ctx.status(200), ctx.json({ data: { id: 'app-1', attributes: { field_status: 'submitted' } } }))
      )
    );

    renderReviewStep();
    await userEvent.click(screen.getByRole('button', { name: /submit application/i }));

    await waitFor(() =>
      expect(screen.getByText(/submitted successfully/i)).toBeInTheDocument()
    );
  });
});
