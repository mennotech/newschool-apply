import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { submitApplication } from '../../store/slices/applicationSlice';

function ReviewStep({ studentInfo, documents, onSubmitComplete }) {
  const dispatch = useDispatch();
  const { currentApplication, status, error } = useSelector((state) => state.application);
  const [submitted, setSubmitted] = useState(false);

  const attrs = studentInfo?.attributes || {};
  const applicationId = currentApplication?.id;

  async function handleSubmit() {
    if (!applicationId) return;
    const result = await dispatch(submitApplication(applicationId));
    if (submitApplication.fulfilled.match(result)) {
      setSubmitted(true);
      if (onSubmitComplete) onSubmitComplete();
    }
  }

  if (submitted) {
    return (
      <section aria-labelledby="review-heading" style={{ textAlign: 'center', padding: '2rem 0' }}>
        <span style={{ fontSize: '3rem', display: 'block', marginBottom: '1rem' }} aria-hidden="true">🎉</span>
        <h2 id="review-heading" style={{ marginBottom: '0.5rem' }}>Application Submitted!</h2>
        <p style={{ color: 'var(--color-text-muted)' }}>
          Your application has been submitted successfully. We will be in touch.
        </p>
      </section>
    );
  }

  return (
    <section aria-labelledby="review-heading">
      <h2 id="review-heading" style={{ marginBottom: '1.5rem' }}>Review &amp; Submit</h2>

      <h3 style={{ fontSize: '1rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>Student Information</h3>
      <dl className="profile-dl" style={{ marginBottom: '2rem' }}>
        <dt>First name</dt>
        <dd>{attrs.field_first_name || '—'}</dd>
        <dt>Last name</dt>
        <dd>{attrs.field_last_name || '—'}</dd>
        <dt>Date of birth</dt>
        <dd>{attrs.field_date_of_birth || '—'}</dd>
        <dt>Grade applying for</dt>
        <dd>{attrs.field_grade_applying_for || '—'}</dd>
      </dl>

      <h3 style={{ fontSize: '1rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>Documents</h3>
      {documents && documents.length > 0 ? (
        <ul style={{ listStyle: 'none', padding: 0, marginBottom: '2rem' }}>
          {documents.map((doc) => (
            <li
              key={doc.id || doc.name}
              style={{
                padding: '0.5rem 0.875rem',
                background: 'var(--color-bg)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius)',
                marginBottom: '0.5rem',
                fontSize: '0.9375rem',
              }}
            >
              {doc.name}
            </li>
          ))}
        </ul>
      ) : (
        <p style={{ color: 'var(--color-text-muted)', marginBottom: '2rem' }}>No documents uploaded.</p>
      )}

      {error && (
        <div className="form-alert form-alert--error" role="alert" aria-live="assertive">
          {error}
        </div>
      )}

      <button
        type="button"
        className="btn btn--primary btn--lg"
        onClick={handleSubmit}
        disabled={status === 'loading'}
      >
        {status === 'loading' ? (
          <><span className="spinner" aria-hidden="true" /> Submitting…</>
        ) : (
          'Submit Application'
        )}
      </button>
    </section>
  );
}

export default ReviewStep;
