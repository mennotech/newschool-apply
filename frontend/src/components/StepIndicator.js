import React from 'react';

const STEP_DEFS = [
  { key: 'student-info', label: 'Student Info' },
  { key: 'health-info', label: 'Health Info' },
  { key: 'guardian-info', label: 'Guardians' },
  { key: 'additional-support', label: 'Support' },
  { key: 'questionnaire', label: 'Questionnaire' },
  { key: 'commitment', label: 'Commitment' },
  { key: 'documents', label: 'Documents' },
  { key: 'review', label: 'Review' },
];

function StepIndicator({ currentStep, completedSteps = [], onStepClick, step1Complete }) {
  const currentStepIndex = STEP_DEFS.findIndex(s => s.key === currentStep);
  return (
    <div className="step-indicator" aria-label="Application progress">
      <div className="step-indicator-inner">
        <ol className="steps-list" aria-label="Steps">
          {STEP_DEFS.map((step, index) => {
            const isActive = step.key === currentStep;
            const isCompleted = completedSteps.includes(step.key);
            const isLocked = index > 0 && !step1Complete && !isCompleted;

            const circleClass = `step-circle${isActive ? ' active' : ''}${isCompleted ? ' completed' : ''}`;
            const labelClass = `step-label${isActive ? ' active' : ''}${isCompleted ? ' completed' : ''}`;

            const canNavigate = onStepClick && (index === 0 || step1Complete || isCompleted);

            return (
              <li key={step.key} className="step-item">
                {index > 0 && (
                  <div
                    className={`step-connector${isCompleted || (index <= currentStepIndex) ? ' completed' : ''}`}
                    aria-hidden="true"
                  />
                )}
                <button
                  className="step-button"
                  onClick={() => canNavigate && onStepClick(step.key)}
                  disabled={isLocked || !canNavigate}
                  aria-current={isActive ? 'step' : undefined}
                  aria-label={`Step ${index + 1}: ${step.label}${isCompleted ? ' (completed)' : ''}${isActive ? ' (current)' : ''}${isLocked ? ' (locked)' : ''}`}
                >
                  <div className={circleClass} aria-hidden="true">
                    {isCompleted ? '✓' : index + 1}
                  </div>
                  <span className={labelClass}>{step.label}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}

export { STEP_DEFS };
export default StepIndicator;
