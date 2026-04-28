import React, { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { updateApplication } from '../../store/slices/applicationSlice';

function HealthInfoStep() {
  const { application, markStepComplete, goToNextStep, goToPrevStep } = useOutletContext();
  const dispatch = useDispatch();
  const attrs = application?.attributes || {};

  const [form, setForm] = useState({
    mb_health_number_9_digit: attrs.field_mb_health_number_9_digit || '',
    mb_health_number_6_digit: attrs.field_mb_health_number_6_digit || '',
    allergies: attrs.field_allergies || '',
    medications_used_frequently: attrs.field_medications_used_frequently || '',
    medical_restrictions: attrs.field_medical_restrictions || '',
  });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [apiError, setApiError] = useState(null);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
    if (errors[name]) setErrors((prev) => { const next = { ...prev }; delete next[name]; return next; });
  }

  function validate() {
    const e = {};
    if (!form.mb_health_number_9_digit.trim()) e.mb_health_number_9_digit = 'MB Health # (9 digit) is required.';
    if (!form.mb_health_number_6_digit.trim()) e.mb_health_number_6_digit = 'MB Health # (6 digit) is required.';
    return e;
  }

  async function handleNext(e) {
    e.preventDefault();
    const validationErrors = validate();
    if (Object.keys(validationErrors).length) { setErrors(validationErrors); return; }
    setSaving(true); setApiError(null);
    try {
      const result = await dispatch(updateApplication({
        id: application.id,
        attributes: {
          field_mb_health_number_9_digit: form.mb_health_number_9_digit,
          field_mb_health_number_6_digit: form.mb_health_number_6_digit,
          field_allergies: form.allergies,
          field_medications_used_frequently: form.medications_used_frequently,
          field_medical_restrictions: form.medical_restrictions,
          field_section_2_reviewed: 'yes',
        },
      }));
      if (updateApplication.fulfilled.match(result)) {
        markStepComplete('health-info');
        goToNextStep('health-info');
      } else {
        setApiError('Failed to save. Please try again.');
      }
    } catch (err) {
      setApiError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleNext} noValidate>
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Step 2: Health Information</h2>
        </div>

        {apiError && <div className="alert alert-error" role="alert">{apiError}</div>}

        <div className="form-section">
          <h3 className="form-section-title">Manitoba Health Card</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 1rem' }}>
            <div className="form-group">
              <label htmlFor="mb_health_number_9_digit">
                MB Health # (9 Digit) <span className="required" aria-hidden="true">*</span>
              </label>
              <input
                id="mb_health_number_9_digit"
                name="mb_health_number_9_digit"
                type="text"
                className="form-control"
                value={form.mb_health_number_9_digit}
                onChange={handleChange}
                maxLength={9}
                aria-required="true"
                aria-invalid={errors.mb_health_number_9_digit ? 'true' : 'false'}
                aria-describedby={errors.mb_health_number_9_digit ? 'mh9-error' : undefined}
              />
              {errors.mb_health_number_9_digit && <span id="mh9-error" className="field-error" role="alert">{errors.mb_health_number_9_digit}</span>}
            </div>
            <div className="form-group">
              <label htmlFor="mb_health_number_6_digit">
                MB Health # (6 Digit) <span className="required" aria-hidden="true">*</span>
              </label>
              <input
                id="mb_health_number_6_digit"
                name="mb_health_number_6_digit"
                type="text"
                className="form-control"
                value={form.mb_health_number_6_digit}
                onChange={handleChange}
                maxLength={6}
                aria-required="true"
                aria-invalid={errors.mb_health_number_6_digit ? 'true' : 'false'}
                aria-describedby={errors.mb_health_number_6_digit ? 'mh6-error' : undefined}
              />
              {errors.mb_health_number_6_digit && <span id="mh6-error" className="field-error" role="alert">{errors.mb_health_number_6_digit}</span>}
            </div>
          </div>
        </div>

        <div className="form-section">
          <h3 className="form-section-title">Medical Information</h3>
          <div className="form-group">
            <label htmlFor="allergies">Allergies</label>
            <textarea id="allergies" name="allergies" className="form-control" value={form.allergies} onChange={handleChange} />
          </div>
          <div className="form-group">
            <label htmlFor="medications_used_frequently">Medications Used Frequently</label>
            <textarea id="medications_used_frequently" name="medications_used_frequently" className="form-control" value={form.medications_used_frequently} onChange={handleChange} />
          </div>
          <div className="form-group">
            <label htmlFor="medical_restrictions">Medical Restrictions</label>
            <textarea id="medical_restrictions" name="medical_restrictions" className="form-control" value={form.medical_restrictions} onChange={handleChange} />
          </div>
        </div>

        {Object.keys(errors).length > 0 && (
          <div className="validation-summary" role="alert">Please correct the errors above before proceeding.</div>
        )}

        <div className="step-nav">
          <button type="button" className="btn btn-ghost" onClick={() => goToPrevStep('health-info')}>Back</button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? <><span className="loading-spinner" aria-hidden="true" /> Saving…</> : 'Next: Guardian Information'}
          </button>
        </div>
      </div>
    </form>
  );
}

export default HealthInfoStep;
