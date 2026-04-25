import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { configureStore } from '@reduxjs/toolkit';
import { rest } from 'msw';
import { server } from '../mocks/server';
import authReducer from '../store/slices/authSlice';
import applicationReducer from '../store/slices/applicationSlice';
import DashboardPage from './DashboardPage';

process.env.REACT_APP_DRUPAL_BASE_URL = 'http://localhost:8080';

function renderPage() {
  const store = configureStore({
    reducer: { auth: authReducer, application: applicationReducer },
    preloadedState: {
      auth: { user: { uid: '1', name: 'testuser' }, status: 'idle', error: null },
      application: {
        currentApplication: null,
        applications: [],
        fetchStatus: 'idle',
        steps: [],
        status: 'idle',
        error: null,
      },
    },
  });

  render(
    <Provider store={store}>
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    </Provider>
  );
}

describe('DashboardPage', () => {
  it('shows a receipt link for submitted applications when payment has a receipt URL', async () => {
    server.use(
      rest.get('http://localhost:8080/jsonapi/node/application', (req, res, ctx) => {
        return res(
          ctx.status(200),
          ctx.json({
            data: [
              {
                id: 'app-3',
                type: 'node--application',
                attributes: {
                  created: 1700000000,
                  field_status: 'submitted',
                  field_student_first_name: 'Alex',
                  field_student_last_name: 'Morgan',
                },
                relationships: {
                  field_payment: {
                    data: { type: 'node--payment', id: 'pay-3' },
                  },
                },
              },
            ],
            included: [
              {
                id: 'pay-3',
                type: 'node--payment',
                attributes: {
                  field_receipt_url: 'https://pay.stripe.test/receipts/pi_123',
                },
              },
            ],
          })
        );
      })
    );

    renderPage();

    const receiptLink = await screen.findByRole('link', { name: /view receipt/i });
    expect(receiptLink).toHaveAttribute('href', 'https://pay.stripe.test/receipts/pi_123');
  });

  it('shows student name and applying grade for each application card', async () => {
    server.use(
      rest.get('http://localhost:8080/jsonapi/node/application', (req, res, ctx) => {
        return res(
          ctx.status(200),
          ctx.json({
            data: [
              {
                id: 'app-1',
                type: 'node--application',
                attributes: {
                  created: 1700000000,
                  field_status: 'pending',
                  field_student_first_name: 'Jane',
                  field_student_last_name: 'Doe',
                  field_student_applying_for_grade: '5',
                },
              },
            ],
          })
        );
      })
    );

    renderPage();

    expect(await screen.findByText(/jane doe/i)).toBeInTheDocument();
    expect(screen.getByText(/student/i)).toBeInTheDocument();
    expect(screen.getByText(/applying for/i)).toBeInTheDocument();
    expect(screen.getByText(/^5$/)).toBeInTheDocument();
  });

  it('confirms draft deletion, shows a notice, and removes the card after deletion', async () => {
    server.use(
      rest.get('http://localhost:8080/jsonapi/node/application', (req, res, ctx) => {
        return res(
          ctx.status(200),
          ctx.json({
            data: [
              {
                id: 'app-2',
                type: 'node--application',
                attributes: {
                  created: 1700000000,
                  field_status: 'pending',
                  field_student_first_name: 'Sam',
                  field_student_last_name: 'Taylor',
                  field_student_applying_for_grade: '7',
                },
              },
            ],
          })
        );
      }),
      rest.delete('http://localhost:8080/jsonapi/node/application/:id', (req, res, ctx) => {
        return res(ctx.status(204));
      })
    );

    renderPage();

    const deleteButton = await screen.findByRole('button', { name: /delete/i });
    await waitFor(() => expect(deleteButton).toBeEnabled());
    await userEvent.click(deleteButton);

    const dialog = screen.getByRole('dialog', { name: /delete draft application/i });
    expect(dialog).toBeInTheDocument();

    await userEvent.click(within(dialog).getByRole('button', { name: /^delete$/i }));

    await waitFor(() => {
      expect(screen.queryByText(/sam taylor/i)).not.toBeInTheDocument();
    });

    expect(await screen.findByText(/draft application deleted/i)).toBeInTheDocument();
  });
});
