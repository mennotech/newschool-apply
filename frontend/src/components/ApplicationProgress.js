import React from 'react';

const STEP_LABELS = {
  'student-info': 'Student Info',
  documents: 'Documents',
  review: 'Review & Submit',
};

function ApplicationProgress({ steps, activeStep }) {
  return (
    <nav aria-label="Application steps">
      <ol>
        {steps.map((step, index) => {
          const isCompleted = index < activeStep;
          const isCurrent = index === activeStep;
          return (
            <li
              key={step}
              aria-current={isCurrent ? 'step' : undefined}
            >
              <span
                aria-label={
                  isCompleted
                    ? `${STEP_LABELS[step]} — completed`
                    : isCurrent
                    ? `${STEP_LABELS[step]} — current`
                    : STEP_LABELS[step]
                }
              >
                {isCompleted ? '✓ ' : ''}
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
