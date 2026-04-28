import React from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { STEPS } from './ApplicationLayout';

function ReviewStep() {
  const { application, completedSteps } = useOutletContext();
  const navigate = useNavigate();
  const attrs = application?.attributes || {};

  const STEP_LABELS = {
    'student-info': 'Student Information',
    'health-info': 'Health Information',
    'guardian-info': 'Guardian Information',
    'additional-support': 'Additional Support',
    'questionnaire': 'Questionnaire',
    'commitment': 'Commitment',
  };

  const isSubmitted = attrs.field_application_status === 'submitted';

  return (
    <div className="card">
      <div className="card-header">
        <h2 className="card-title">Step 8: Review</h2>
      </div>

      {isSubmitted ? (
        <div className="alert alert-success" role="status" style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>Application Submitted!</h3>
          <p style={{ margin: 0 }}>
            Your application has been submitted successfully. We will be in touch regarding next steps.
          </p>
        </div>
      ) : (
        <div className="alert alert-info" style={{ marginBottom: '1.5rem' }}>
          Review your application below. You can go back to any section to make changes.
        </div>
      )}

      <div className="form-section">
        <h3 className="form-section-title">Completed Sections</h3>
        {STEPS.filter((s) => s.key !== 'review').map((step) => {
          const done = completedSteps.includes(step.key);
          return (
            <div
              key={step.key}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.625rem 0',
                borderBottom: '1px solid var(--color-border)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span
                  style={{
                    width: '1.25rem',
                    height: '1.25rem',
                    borderRadius: '50%',
                    background: done ? 'var(--color-success)' : 'var(--color-border)',
                    color: done ? 'white' : 'var(--color-text-muted)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    flexShrink: 0,
                  }}
                >
                  {done ? '✓' : step.number}
                </span>
                <span style={{ fontWeight: 500 }}>{step.label}</span>
              </div>
              {!isSubmitted && (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => navigate(`/apply/${step.key}`)}
                >
                  Edit
                </button>
              )}
            </div>
          );
        })}
      </div>

      <div className="form-section">
        <h3 className="form-section-title">Student</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
          <div>
            <span style={{ fontWeight: 500, fontSize: '0.875rem' }}>Name: </span>
            {[attrs.field_student_first_name, attrs.field_student_last_name].filter(Boolean).join(' ') || '—'}
          </div>
          <div>
            <span style={{ fontWeight: 500, fontSize: '0.875rem' }}>Grade applying for: </span>
            {attrs.field_student_applying_for_grade || '—'}
          </div>
          <div>
            <span style={{ fontWeight: 500, fontSize: '0.875rem' }}>Date of birth: </span>
            {attrs.field_student_birth_date || '—'}
          </div>
        </div>
      </div>

      {!isSubmitted && (
        <div className="step-nav">
          <button type="button" className="btn btn-ghost" onClick={() => navigate('/apply/documents')}>
            Back
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => navigate('/dashboard')}
          >
            Done — Go to Dashboard
          </button>
        </div>
      )}

      {isSubmitted && (
        <div className="step-nav">
          <button type="button" className="btn btn-primary" onClick={() => navigate('/dashboard')}>
            Go to Dashboard
          </button>
        </div>
      )}
    </div>
  );
}

export default ReviewStep;
