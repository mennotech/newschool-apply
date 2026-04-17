import React from 'react';

const STEP_LABELS = {
  'student-info': 'Student Info',
  documents: 'Documents',
  review: 'Review & Submit',
};

function ApplicationProgress({ steps, activeStep }) {
  return (
    <nav aria-label="Application steps">
      <ol className="stepper">
        {steps.map((step, index) => {
          const isCompleted = index < activeStep;
          const isCurrent = index === activeStep;
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
              <div className="stepper__dot" aria-hidden="true">
                {isCompleted ? '✓' : index + 1}
              </div>
              <span
                className="stepper__label"
                aria-label={
                  isCompleted
                    ? `${STEP_LABELS[step]} — completed`
                    : isCurrent
                    ? `${STEP_LABELS[step]} — current step`
                    : STEP_LABELS[step]
                }
              >
                {STEP_LABELS[step]}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export default ApplicationProgress;

