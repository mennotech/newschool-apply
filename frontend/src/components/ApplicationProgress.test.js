import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ApplicationProgress from './ApplicationProgress';

const STEPS = ['student-info', 'health-info', 'parent-info', 'additional-support', 'questionnaire', 'commitment'];

describe('ApplicationProgress', () => {
  it('renders all step labels', () => {
    render(<ApplicationProgress steps={STEPS} activeStep={0} />);
    expect(screen.getByText(/student info/i)).toBeInTheDocument();
    expect(screen.getByText(/health/i)).toBeInTheDocument();
    expect(screen.getByText(/parent info/i)).toBeInTheDocument();
    expect(screen.getByText(/support/i)).toBeInTheDocument();
    expect(screen.getByText(/questionnaire/i)).toBeInTheDocument();
    expect(screen.getByText(/commitment/i)).toBeInTheDocument();
  });

  it('marks the active step with aria-current="step"', () => {
    render(<ApplicationProgress steps={STEPS} activeStep={1} />);
    const items = screen.getAllByRole('listitem');
    expect(items[1]).toHaveAttribute('aria-current', 'step');
  });

  it('marks completed steps with a check indicator', () => {
    render(
      <ApplicationProgress
        steps={STEPS}
        activeStep={2}
        completedSteps={{ 'student-info': true, 'health-info': true }}
      />
    );
    const items = screen.getAllByRole('listitem');
    expect(items[0].textContent).toMatch(/✓/);
    expect(items[1].textContent).toMatch(/✓/);
    expect(items[2].textContent).not.toMatch(/✓/);
  });

  it('allows clicking steps when jump-around is enabled', async () => {
    const onStepClick = jest.fn();
    render(
      <ApplicationProgress
        steps={STEPS}
        activeStep={1}
        canJumpAround
        onStepClick={onStepClick}
      />
    );
    await userEvent.click(screen.getByRole('button', { name: /commitment/i }));
    expect(onStepClick).toHaveBeenCalledWith(5);
  });

  it('disables later steps when jump-around is not enabled', () => {
    render(
      <ApplicationProgress
        steps={STEPS}
        activeStep={0}
        canJumpAround={false}
      />
    );
    expect(screen.getByRole('button', { name: /student info/i })).not.toBeDisabled();
    expect(screen.getByRole('button', { name: /health/i })).toBeDisabled();
  });
});
