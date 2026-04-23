import React, { useState } from 'react';

const INITIAL_FIELDS = {
  academic_support_details: '',
  diagnosis_assessments_details: '',
  psychological_support_details: '',
  support_declaration_reviewed: false,
};

function AdditionalSupportStep({ onComplete, onBack, initialData = {}, onFieldBlur }) {
  const [fields, setFields] = useState(() => ({ ...INITIAL_FIELDS, ...initialData }));
  const [errors, setErrors] = useState({});

  function handleChange(e) {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setFields((prev) => ({ ...prev, [e.target.name]: value }));

    if (e.target.type === 'checkbox') {
      onFieldBlur && onFieldBlur(e.target.name, value ? 'yes' : 'no');
    }
  }

  function handleBlur(e) {
    const value = e.target.type === 'checkbox' ? (e.target.checked ? 'yes' : 'no') : e.target.value;
    onFieldBlur && onFieldBlur(e.target.name, value);
  }

  function validate() {
    const nextErrors = {};
    if (!fields.support_declaration_reviewed) {
      nextErrors.support_declaration_reviewed = 'Please confirm that you reviewed the support declaration fields.';
    }
    return nextErrors;
  }

  function handleSubmit(e) {
    e.preventDefault();
    const nextErrors = validate();
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }
    setErrors({});
    onComplete(fields);
  }

  function textareaField(key, label, placeholder) {
    return (
      <div className="form-group">
        <label className="form-label" htmlFor={key}>{label}</label>
        <textarea
          id={key}
          name={key}
          className="form-input"
          rows={5}
          value={fields[key]}
          onChange={handleChange}
          onBlur={handleBlur}
          placeholder={placeholder}
          style={{ resize: 'vertical' }}
        />
      </div>
    );
  }

  return (
    <section aria-labelledby="additional-support-heading">
      <h2 id="additional-support-heading" style={{ marginBottom: '0.5rem' }}>Additional Support Declaration</h2>
      <p style={{ color: 'var(--color-text-muted)', marginBottom: '1.5rem', fontSize: '0.9375rem' }}>
        Is your child receiving any additional supports in the following areas either in or out of school?
      </p>

      <form onSubmit={handleSubmit} noValidate>
        {textareaField(
          'academic_support_details',
          'Academic Support',
          'Please provide an explanation of any academic support your child has received including EA support, adapted or modified curriculum, etc.'
        )}
        {textareaField(
          'diagnosis_assessments_details',
          'Diagnosis/Assessments',
          "Please provide an explanation of any diagnosis or assessments your child has had such as ADHD, Autism, Asperger's, FAS, Dyslexia, Red Ladder, etc."
        )}
        {textareaField(
          'psychological_support_details',
          'Psychological Support',
          'Please provide an explanation of any psychological support your child has received including counselling, and medications for anxiety, depression, etc.'
        )}

        <div className="form-group">
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.625rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              name="support_declaration_reviewed"
              checked={fields.support_declaration_reviewed}
              onChange={handleChange}
              aria-describedby={errors.support_declaration_reviewed ? 'support-reviewed-error' : undefined}
              aria-invalid={errors.support_declaration_reviewed ? 'true' : undefined}
              style={{ marginTop: '0.25rem' }}
            />
            <span>
              I have reviewed the Additional Support Declaration fields and confirm they are complete, even if no additional support details apply.
            </span>
          </label>
          {errors.support_declaration_reviewed && (
            <span id="support-reviewed-error" className="form-error" role="alert">
              {errors.support_declaration_reviewed}
            </span>
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

export default AdditionalSupportStep;
