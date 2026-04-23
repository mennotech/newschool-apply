import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { rest } from 'msw';
import { server } from '../../mocks/server';
import DocumentsStep from './DocumentsStep';
import applicationReducer from '../../store/slices/applicationSlice';
import authReducer from '../../store/slices/authSlice';

const BASE_URL = 'http://localhost:8080';
process.env.REACT_APP_DRUPAL_BASE_URL = BASE_URL;

// Creates a fresh store with an existing application already in state
function makeStore(applicationId = 'app-uuid-1') {
  return configureStore({
    reducer: { auth: authReducer, application: applicationReducer },
    preloadedState: {
      application: {
        currentApplication: { id: applicationId },
        steps: [],
        status: 'idle',
        error: null,
      },
    },
  });
}

function renderWithStore(ui, store) {
  return render(<Provider store={store}>{ui}</Provider>);
}

function makeFile(name, sizeBytes, type = 'application/pdf') {
  const file = new File(['x'.repeat(sizeBytes > 0 ? sizeBytes : 1)], name, { type });
  Object.defineProperty(file, 'size', { value: sizeBytes });
  return file;
}

describe('DocumentsStep', () => {
  it('shows error for files over 5 MB without uploading', async () => {
    const onComplete = jest.fn();
    renderWithStore(<DocumentsStep onComplete={onComplete} />, makeStore());

    const input = screen.getByLabelText(/select file/i);
    const bigFile = makeFile('big.pdf', 6 * 1024 * 1024);
    await userEvent.upload(input, bigFile);

    expect(await screen.findByText(/too large/i)).toBeInTheDocument();
  });

  it('uploads file and creates document node, then shows the file name', async () => {
    server.use(
      rest.get(`${BASE_URL}/session/token`, (req, res, ctx) => res(ctx.text('t'))),
      rest.post(`${BASE_URL}/jsonapi/node/document/field_file`, (req, res, ctx) =>
        res(ctx.status(201), ctx.json({ data: { id: 'f1', type: 'file--file', attributes: {} } })),
      ),
      rest.post(`${BASE_URL}/jsonapi/node/document`, (req, res, ctx) =>
        res(
          ctx.status(201),
          ctx.json({
            data: {
              id: 'doc-uuid-1',
              type: 'node--document',
              attributes: { field_document_type: 'transcript' },
              relationships: {
                field_application: { data: { type: 'node--application', id: 'app-uuid-1' } },
                field_file: { data: { type: 'file--file', id: 'f1' } },
              },
            },
          }),
        ),
      ),
    );

    const onComplete = jest.fn();
    renderWithStore(<DocumentsStep onComplete={onComplete} />, makeStore());

    const input = screen.getByLabelText(/select file/i);
    const validFile = makeFile('transcript.pdf', 1024);
    await userEvent.upload(input, validFile);

    await waitFor(() =>
      expect(screen.getByText(/transcript\.pdf/i)).toBeInTheDocument(),
    );
  });

  it('shows server error message when file upload fails', async () => {
    server.use(
      rest.get(`${BASE_URL}/session/token`, (req, res, ctx) => res(ctx.text('t'))),
      rest.post(`${BASE_URL}/jsonapi/node/document/field_file`, (req, res, ctx) =>
        res(ctx.status(422), ctx.json({ errors: [{ detail: 'Virus detected in file.' }] })),
      ),
    );

    renderWithStore(<DocumentsStep onComplete={jest.fn()} />, makeStore());
    const input = screen.getByLabelText(/select file/i);
    await userEvent.upload(input, makeFile('test.pdf', 1024));

    await waitFor(() =>
      expect(screen.getByText(/virus detected/i)).toBeInTheDocument(),
    );
  });

  it('shows server error when document node creation fails', async () => {
    server.use(
      rest.get(`${BASE_URL}/session/token`, (req, res, ctx) => res(ctx.text('t'))),
      rest.post(`${BASE_URL}/jsonapi/node/document/field_file`, (req, res, ctx) =>
        res(ctx.status(201), ctx.json({ data: { id: 'f1', type: 'file--file', attributes: {} } })),
      ),
      rest.post(`${BASE_URL}/jsonapi/node/document`, (req, res, ctx) =>
        res(ctx.status(422), ctx.json({ errors: [{ detail: 'field_application: This value should not be null.' }] })),
      ),
    );

    renderWithStore(<DocumentsStep onComplete={jest.fn()} />, makeStore());
    const input = screen.getByLabelText(/select file/i);
    await userEvent.upload(input, makeFile('test.pdf', 1024));

    await waitFor(() =>
      expect(screen.getByText(/field_application/i)).toBeInTheDocument(),
    );
  });
});
