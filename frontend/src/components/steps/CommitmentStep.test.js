import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import authReducer from '../../store/slices/authSlice';
import applicationReducer from '../../store/slices/applicationSlice';
import CommitmentStep from './CommitmentStep';

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
});

function renderCommitmentStep({ incompleteSections = [] } = {}) {
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
      />
    </Provider>
  );
}

describe('CommitmentStep', () => {
  it('shows an in-app warning modal when required sections are incomplete', async () => {
    renderCommitmentStep({ incompleteSections: ['Health Information', 'Questionnaire'] });

    await userEvent.click(screen.getByRole('button', { name: /submit application/i }));

    expect(screen.getByRole('dialog', { name: /finish required sections/i })).toBeInTheDocument();
    expect(screen.getByText(/please complete the following sections before submitting your application/i)).toBeInTheDocument();
    expect(screen.getByText('Health Information')).toBeInTheDocument();
    expect(screen.getByText('Questionnaire')).toBeInTheDocument();
  });

  it('shows signature validation when all required sections are complete but signature is missing', async () => {
    renderCommitmentStep();

    await userEvent.click(screen.getByRole('button', { name: /submit application/i }));

    expect(await screen.findByText(/a signature is required to submit/i)).toBeInTheDocument();
  });
});
