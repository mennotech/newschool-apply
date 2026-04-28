import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { Stepper } from './apply/ApplicationLayout';

describe('Stepper', () => {
  it('renders all 8 steps', () => {
    render(
      <Stepper
        currentStep="student-info"
        completedSteps={[]}
        onStepClick={() => {}}
      />
    );
    expect(screen.getByLabelText(/step 1/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/step 8/i)).toBeInTheDocument();
  });

  it('marks current step with aria-current="step"', () => {
    render(
      <Stepper
        currentStep="health-info"
        completedSteps={[]}
        onStepClick={() => {}}
      />
    );
    const currentBtn = screen.getByLabelText(/step 2.*health info/i);
    expect(currentBtn).toHaveAttribute('aria-current', 'step');
  });

  it('marks completed steps', () => {
    render(
      <Stepper
        currentStep="health-info"
        completedSteps={['student-info']}
        onStepClick={() => {}}
      />
    );
    const completedBtn = screen.getByLabelText(/step 1.*completed/i);
    expect(completedBtn).toBeInTheDocument();
  });

  it('only allows navigation when step 1 is complete', () => {
    const onStepClick = jest.fn();
    render(
      <Stepper
        currentStep="student-info"
        completedSteps={[]}
        onStepClick={onStepClick}
      />
    );
    const step2Btn = screen.getByLabelText(/step 2/i);
    expect(step2Btn).toBeDisabled();
  });

  it('enables navigation after step 1 is complete', () => {
    const onStepClick = jest.fn();
    render(
      <Stepper
        currentStep="health-info"
        completedSteps={['student-info']}
        onStepClick={onStepClick}
      />
    );
    const step2Btn = screen.getByLabelText(/step 2/i);
    expect(step2Btn).not.toBeDisabled();
    fireEvent.click(step2Btn);
    expect(onStepClick).toHaveBeenCalledWith('health-info');
  });

  it('always allows step 1 navigation', () => {
    const onStepClick = jest.fn();
    render(
      <Stepper
        currentStep="health-info"
        completedSteps={[]}
        onStepClick={onStepClick}
      />
    );
    const step1Btn = screen.getByLabelText(/step 1/i);
    expect(step1Btn).not.toBeDisabled();
  });
});
