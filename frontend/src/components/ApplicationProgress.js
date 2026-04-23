import React from 'react';

const STEP_LABELS = {
  'student-info': 'Student Info',
  'health-info': 'Health',
  'parent-info': 'Parent Info',
  'additional-support': 'Support',
  questionnaire: 'Questionnaire',
  commitment: 'Commitment',
  // kept for backward compat with any legacy routes
  documents: 'Documents',
  review: 'Review & Submit',
};

function ApplicationProgress({
  steps,
  activeStep,
  completedSteps = {},
  onStepClick,
  canJumpAround = false,
}) {
  return (
    <nav aria-label="Application steps">
      <ol className="stepper">
        {steps.map((step, index) => {
          const isCompleted = !!completedSteps[step];
          const isCurrent = index === activeStep;
          const isEnabled = index === 0 || canJumpAround;
          const stepClass = [
            'stepper__item',
            isCompleted ? 'stepper__item--completed' : '',
            isCurrent ? 'stepper__item--current' : '',
          ]
            .filter(Boolean)
            .join(' ');

          return (
            <li
              key={step}
              className={stepClass}
              aria-current={isCurrent ? 'step' : undefined}
            >
              <button
                type="button"
                className="stepper__button"
                onClick={() => onStepClick && onStepClick(index)}
                disabled={!isEnabled}
                aria-label={
                  isCompleted
                    ? `${STEP_LABELS[step]} - completed`
                    : isCurrent
                    ? `${STEP_LABELS[step]} - current step`
                    : STEP_LABELS[step]
                }
              >
                <div className="stepper__dot" aria-hidden="true">
                  {isCompleted ? '✓' : index + 1}
                </div>
                <span className="stepper__label">{STEP_LABELS[step]}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export default ApplicationProgress;

