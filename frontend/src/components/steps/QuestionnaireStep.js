import React, { useState } from 'react';

const INITIAL_FIELDS = {
  parent_name: '',
  christian_testimony: '',
  school_interest_reason: '',
};

function QuestionnaireStep({ onComplete, onBack, initialData = {}, onFieldBlur }) {
  const [fields, setFields] = useState(() => ({ ...INITIAL_FIELDS, ...initialData }));
  const [errors, setErrors] = useState({});

  function handleChange(e) {
    setFields((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  function handleBlur(e) {
    onFieldBlur && onFieldBlur(e.target.name, e.target.value);
  }

  function validate() {
    const errs = {};
    if (!fields.parent_name.trim()) errs.parent_name = 'Name of parent is required.';
    if (!fields.christian_testimony.trim()) errs.christian_testimony = 'Please provide a description of your Christian testimony.';
    if (!fields.school_interest_reason.trim()) errs.school_interest_reason = 'Please explain why you want your child to attend SCS.';
    return errs;
  }

  function handleSubmit(e) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    setErrors({});
    onComplete(fields);
  }

  return (
    <section aria-labelledby="questionnaire-heading">
      <h2 id="questionnaire-heading" style={{ marginBottom: '1.5rem' }}>Parent Questionnaire</h2>

      <form onSubmit={handleSubmit} noValidate>
        <div className="form-group">
          <label className="form-label" htmlFor="parent_name">Name of Parent</label>
          <input
            id="parent_name"
            name="parent_name"
            type="text"
            className="form-input"
            value={fields.parent_name}
            onChange={handleChange}
            onBlur={handleBlur}
            aria-describedby={errors.parent_name ? 'parent_name-error' : undefined}
            aria-invalid={errors.parent_name ? 'true' : undefined}
          />
          {errors.parent_name && (
            <span id="parent_name-error" className="form-error" role="alert">{errors.parent_name}</span>
          )}
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="christian_testimony">
            Please provide a short description of your Christian testimony below:
          </label>
          <textarea
            id="christian_testimony"
            name="christian_testimony"
            className="form-input"
            rows={6}
            value={fields.christian_testimony}
            onChange={handleChange}
            onBlur={handleBlur}
            aria-describedby={errors.christian_testimony ? 'christian_testimony-error' : undefined}
            aria-invalid={errors.christian_testimony ? 'true' : undefined}
            style={{ resize: 'vertical' }}
          />
          {errors.christian_testimony && (
            <span id="christian_testimony-error" className="form-error" role="alert">{errors.christian_testimony}</span>
          )}
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="school_interest_reason">
            Why do you want your child to attend Steinbach Christian School?
          </label>
          <textarea
            id="school_interest_reason"
            name="school_interest_reason"
            className="form-input"
            rows={6}
            value={fields.school_interest_reason}
            onChange={handleChange}
            onBlur={handleBlur}
            aria-describedby={errors.school_interest_reason ? 'school_interest_reason-error' : undefined}
            aria-invalid={errors.school_interest_reason ? 'true' : undefined}
            style={{ resize: 'vertical' }}
          />
          {errors.school_interest_reason && (
            <span id="school_interest_reason-error" className="form-error" role="alert">{errors.school_interest_reason}</span>
          )}
        </div>

        <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'space-between' }}>
          <button type="button" className="btn" onClick={onBack}>← Back</button>
          <button type="submit" className="btn btn--primary">Next →</button>
        </div>

        {Object.keys(errors).length > 0 && (
          <div className="form-alert form-alert--warning form-validation-note" role="alert" aria-live="polite">
            Please correct the highlighted fields before continuing.
          </div>
        )}
      </form>
    </section>
  );
}

export default QuestionnaireStep;
