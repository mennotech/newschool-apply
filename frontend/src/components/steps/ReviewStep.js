import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { submitApplication } from '../../store/slices/applicationSlice';

function ReviewStep({ studentInfo, documents }) {
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
    }
  }

  if (submitted) {
    return (
      <section aria-labelledby="review-heading">
        <h2 id="review-heading">Application Submitted</h2>
        <p>Your application has been submitted successfully. We will be in touch.</p>
      </section>
    );
  }

  return (
    <section aria-labelledby="review-heading">
      <h2 id="review-heading">Review &amp; Submit</h2>

      <h3>Student Information</h3>
      <dl>
        <dt>First name</dt>
        <dd>{attrs.field_first_name || '—'}</dd>
        <dt>Last name</dt>
        <dd>{attrs.field_last_name || '—'}</dd>
        <dt>Date of birth</dt>
        <dd>{attrs.field_date_of_birth || '—'}</dd>
        <dt>Grade applying for</dt>
        <dd>{attrs.field_grade_applying_for || '—'}</dd>
      </dl>

      <h3>Documents</h3>
      {documents && documents.length > 0 ? (
        <ul>
          {documents.map((doc) => (
            <li key={doc.id || doc.name}>{doc.name}</li>
          ))}
        </ul>
      ) : (
        <p>No documents uploaded.</p>
      )}

      {error && (
        <p role="alert" aria-live="assertive">
          {error}
        </p>
      )}

      <button type="button" onClick={handleSubmit} disabled={status === 'loading'}>
        {status === 'loading' ? 'Submitting…' : 'Submit Application'}
      </button>
    </section>
  );
}

export default ReviewStep;
