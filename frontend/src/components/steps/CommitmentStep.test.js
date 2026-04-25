import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { rest } from 'msw';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import authReducer from '../../store/slices/authSlice';
import applicationReducer from '../../store/slices/applicationSlice';
import CommitmentStep from './CommitmentStep';
import { server } from '../../mocks/server';

const BASE_URL = 'http://localhost:8080';
process.env.REACT_APP_DRUPAL_BASE_URL = BASE_URL;

beforeEach(() => {
  HTMLCanvasElement.prototype.getContext = () => ({
    fillStyle: '',
    fillRect: () => {},
    strokeStyle: '',
    lineWidth: 0,
    lineCap: 'round',
    lineJoin: 'round',
    beginPath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    stroke: () => {},
    clearRect: () => {},
  });
  HTMLCanvasElement.prototype.toDataURL = () => 'data:image/png;base64,signature';
});

function renderCommitmentStep({ incompleteSections = [], onCheckoutRedirect } = {}) {
  const store = configureStore({
    reducer: { auth: authReducer, application: applicationReducer },
    preloadedState: {
      auth: { user: { uid: '1', name: 'testuser' }, status: 'idle', error: null },
      application: {
        currentApplication: { id: 'app-1', type: 'node--application', attributes: { field_status: 'pending' } },
        applications: [],
        fetchStatus: 'idle',
        steps: [],
        status: 'idle',
        error: null,
      },
    },
  });

  return render(
    <Provider store={store}>
      <CommitmentStep
        allStepData={{}}
        incompleteSections={incompleteSections}
        onBack={jest.fn()}
        onCheckoutRedirect={onCheckoutRedirect}
      />
    </Provider>
  );
}

describe('CommitmentStep', () => {
  it('shows an in-app warning modal when required sections are incomplete', async () => {
    renderCommitmentStep({ incompleteSections: ['Health Information', 'Questionnaire'] });

    await userEvent.click(screen.getByRole('button', { name: /continue to payment/i }));

    expect(screen.getByRole('dialog', { name: /finish required sections/i })).toBeInTheDocument();
    expect(screen.getByText(/please complete the following sections before submitting your application/i)).toBeInTheDocument();
    expect(screen.getByText('Health Information')).toBeInTheDocument();
    expect(screen.getByText('Questionnaire')).toBeInTheDocument();
  });

  it('shows signature validation when all required sections are complete but signature is missing', async () => {
    renderCommitmentStep();

    await userEvent.click(screen.getByRole('button', { name: /continue to payment/i }));

    expect(await screen.findByText(/a signature is required to submit/i)).toBeInTheDocument();
  });

  it('submits and redirects to Stripe checkout URL on success', async () => {
    let patched = false;
    let checkoutCalled = false;
    const redirectSpy = jest.fn();

    server.use(
      rest.get(`${BASE_URL}/session/token`, (req, res, ctx) => res(ctx.text('token'))),
      rest.patch(`${BASE_URL}/jsonapi/node/application/app-1`, (req, res, ctx) => {
        patched = true;
        return res(ctx.status(200), ctx.json({ data: { id: 'app-1', attributes: { field_status: 'submitted' } } }));
      }),
      rest.post(`${BASE_URL}/api/payments/checkout-session`, (req, res, ctx) => {
        checkoutCalled = true;
        return res(
          ctx.status(200),
          ctx.json({
            url: 'https://checkout.stripe.com/c/pay_test_123',
            payment_id: 42,
            session_id: 'cs_test_123',
          })
        );
      })
    );

    renderCommitmentStep({ onCheckoutRedirect: redirectSpy });

    const signatureCanvas = screen.getByLabelText(/signature pad/i);
    await userEvent.pointer([
      { target: signatureCanvas, keys: '[MouseLeft>]' },
      { target: signatureCanvas, keys: '[/MouseLeft]' },
    ]);

    await userEvent.click(screen.getByRole('button', { name: /continue to payment/i }));

    await waitFor(() => {
      expect(patched).toBe(true);
      expect(checkoutCalled).toBe(true);
      expect(redirectSpy).toHaveBeenCalledWith('https://checkout.stripe.com/c/pay_test_123');
    });
  });
});
