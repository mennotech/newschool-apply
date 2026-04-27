import React, { useState } from 'react';

const INITIAL_FIELDS = {
  mb_health_number_9_digit: '',
  mb_health_number_6_digit: '',
  emergency_contact_name: '',
  emergency_contact_phone: '',
  allergies: '',
  medications_used_frequently: '',
  medical_restrictions: '',
};

function HealthInfoStep({ onComplete, onBack, initialData = {}, onFieldBlur }) {
  const [fields, setFields] = useState(() => ({ ...INITIAL_FIELDS, ...initialData }));
  const [errors, setErrors] = useState({});

  function handleChange(e) {
    setFields((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    if (e.target.type === 'radio' || e.target.tagName === 'SELECT') {
      onFieldBlur && onFieldBlur(e.target.name, e.target.value);
    }
  }

  function handleBlur(e) {
    onFieldBlur && onFieldBlur(e.target.name, e.target.value);
  }

  function validate() {
    const errs = {};
    if (!fields.mb_health_number_9_digit.trim()) errs.mb_health_number_9_digit = 'MB Health # (9 digit) is required.';
    if (!fields.mb_health_number_6_digit.trim()) errs.mb_health_number_6_digit = 'MB Health # (6 digit) is required.';
    if (!fields.emergency_contact_name.trim()) errs.emergency_contact_name = 'Emergency contact name is required.';
    if (!fields.emergency_contact_phone.trim()) errs.emergency_contact_phone = 'Emergency contact phone is required.';
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

  function textField(key, label, inputProps = {}) {
    return (
      <div className="form-group">
        <label className="form-label" htmlFor={key}>{label}</label>
        <input
          id={key}
          name={key}
          type="text"
          className="form-input"
          value={fields[key]}
          onChange={handleChange}
          onBlur={handleBlur}
          aria-describedby={errors[key] ? `${key}-error` : undefined}
          aria-invalid={errors[key] ? 'true' : undefined}
          {...inputProps}
        />
        {errors[key] && (
          <span id={`${key}-error`} className="form-error" role="alert">{errors[key]}</span>
        )}
      </div>
    );
  }

  function textareaField(key, label, placeholder = '') {
    return (
      <div className="form-group">
        <label className="form-label" htmlFor={key}>{label}</label>
        <textarea
          id={key}
          name={key}
          className="form-input"
          rows={4}
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
    <section aria-labelledby="health-info-heading">
      <h2 id="health-info-heading" style={{ marginBottom: '1.5rem' }}>Health Information</h2>

      <form onSubmit={handleSubmit} noValidate>
        <div className="form-row">
          <div className="form-row__item">
            {textField('mb_health_number_9_digit', 'MB Health # – 9 Digit')}
          </div>
          <div className="form-row__item">
            {textField('mb_health_number_6_digit', 'MB Health # – 6 Digit')}
          </div>
        </div>

        <div className="form-row">
          <div className="form-row__item">
            {textField('emergency_contact_name', 'Emergency Contact Name:')}
          </div>
          <div className="form-row__item">
            {textField('emergency_contact_phone', 'Emergency Contact Phone:', { type: 'tel', placeholder: '(000) 000-0000' })}
          </div>
        </div>

        {textareaField('allergies', 'Allergies:')}
        {textareaField('medications_used_frequently', 'Medications used frequently:')}
        {textareaField(
          'medical_restrictions',
          'Medical Restrictions:',
          'i.e. asthma, heart condition, diabetes, sight or hearing impairment, physical limitations, etc. Please mark "None" if applicable.'
        )}

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

export default HealthInfoStep;
