import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, Outlet, useLocation } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import {
  selectCurrentApplication,
  createApplication,
  fetchApplication,
  selectApplicationStatus,
} from '../../store/slices/applicationSlice';
import { selectSelectedBundle } from '../../store/slices/applicationSlice';

export const STEPS = [
  { key: 'student-info', label: 'Student Info', number: 1 },
  { key: 'health-info', label: 'Health Info', number: 2 },
  { key: 'guardian-info', label: 'Guardians', number: 3 },
  { key: 'additional-support', label: 'Support', number: 4 },
  { key: 'questionnaire', label: 'Questionnaire', number: 5 },
  { key: 'commitment', label: 'Commitment', number: 6 },
  { key: 'documents', label: 'Documents', number: 7 },
  { key: 'review', label: 'Review', number: 8 },
];

function Stepper({ currentStep, completedSteps, onStepClick }) {
  return (
    <nav className="stepper" aria-label="Application steps">
      {STEPS.map((step, idx) => {
        const isCurrent = step.key === currentStep;
        const isCompleted = completedSteps.includes(step.key);
        const isFirst = idx === 0;
        const isAccessible = isFirst || completedSteps.includes(STEPS[0].key);

        return (
          <React.Fragment key={step.key}>
            {idx > 0 && (
              <div
                className={`step-connector${isCompleted ? ' completed' : ''}`}
                aria-hidden="true"
              />
            )}
            <div className="step-item">
              <button
                className="step-button"
                onClick={() => isAccessible && onStepClick(step.key)}
                disabled={!isAccessible}
                aria-label={`Step ${step.number}: ${step.label}${isCurrent ? ' (current)' : ''}${isCompleted ? ' (completed)' : ''}`}
                aria-current={isCurrent ? 'step' : undefined}
              >
                <div className={`step-circle${isCurrent ? ' current' : ''}${isCompleted ? ' completed' : ''}`}>
                  {isCompleted ? '✓' : step.number}
                </div>
                <span className={`step-label${isCurrent ? ' current' : ''}${isCompleted ? ' completed' : ''}`}>
                  {step.label}
                </span>
              </button>
            </div>
          </React.Fragment>
        );
      })}
    </nav>
  );
}

function ApplicationLayout() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { step } = useParams();
  const location = useLocation();
  const currentApplication = useSelector(selectCurrentApplication);
  const selectedBundle = useSelector(selectSelectedBundle);
  const appStatus = useSelector(selectApplicationStatus);

  const [completedSteps, setCompletedSteps] = useState([]);
  const [initialized, setInitialized] = useState(false);

  const currentStep = step || 'student-info';

  useEffect(() => {
    const initApp = async () => {
      const params = new URLSearchParams(location.search);
      const bundle = params.get('bundle') || selectedBundle || 'application_partial_programming';

      if (!currentApplication) {
        const result = await dispatch(createApplication({ bundle, title: 'New Application' }));
        if (createApplication.fulfilled.match(result)) {
          setInitialized(true);
          navigate('/apply/student-info', { replace: true });
        }
      } else {
        setInitialized(true);
        if (!step) navigate('/apply/student-info', { replace: true });

        const attrs = currentApplication.attributes || {};
        const completed = [];
        if (attrs.field_section_1_reviewed === 'yes') completed.push('student-info');
        if (attrs.field_section_2_reviewed === 'yes') completed.push('health-info');
        if (attrs.field_section_3_reviewed === 'yes') completed.push('guardian-info');
        if (attrs.field_section_4_reviewed === 'yes') completed.push('additional-support');
        if (attrs.field_section_5_reviewed === 'yes') completed.push('questionnaire');
        if (attrs.field_section_6_reviewed === 'yes') completed.push('commitment');
        setCompletedSteps(completed);
      }
    };

    initApp();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function handleStepClick(stepKey) {
    navigate(`/apply/${stepKey}`);
  }

  function markStepComplete(stepKey) {
    setCompletedSteps((prev) => {
      if (prev.includes(stepKey)) return prev;
      return [...prev, stepKey];
    });
  }

  function goToNextStep(stepKey) {
    const idx = STEPS.findIndex((s) => s.key === stepKey);
    if (idx < STEPS.length - 1) {
      navigate(`/apply/${STEPS[idx + 1].key}`);
    }
  }

  function goToPrevStep(stepKey) {
    const idx = STEPS.findIndex((s) => s.key === stepKey);
    if (idx > 0) {
      navigate(`/apply/${STEPS[idx - 1].key}`);
    }
  }

  if (appStatus === 'loading' && !initialized) {
    return (
      <main className="page-content container">
        <div className="loading-container" aria-live="polite">
          <span className="loading-spinner" aria-hidden="true" />
          Setting up your application…
        </div>
      </main>
    );
  }

  return (
    <main className="page-content container" style={{ maxWidth: 800 }}>
      <h1 style={{ marginBottom: '1.5rem' }}>Application</h1>

      <Stepper
        currentStep={currentStep}
        completedSteps={completedSteps}
        onStepClick={handleStepClick}
      />

      <div>
        <Outlet
          context={{
            application: currentApplication,
            completedSteps,
            markStepComplete,
            goToNextStep,
            goToPrevStep,
            currentStep,
          }}
        />
      </div>
    </main>
  );
}

export { Stepper };
export default ApplicationLayout;
