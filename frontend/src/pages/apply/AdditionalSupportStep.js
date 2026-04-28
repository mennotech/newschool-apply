import React, { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { updateApplication } from '../../store/slices/applicationSlice';

function AdditionalSupportStep() {
  const { application, markStepComplete, goToNextStep, goToPrevStep } = useOutletContext();
  const dispatch = useDispatch();
  const attrs = application?.attributes || {};

  const [form, setForm] = useState({
    academic_support_details: attrs.field_academic_support_details || '',
    diagnosis_assessments_details: attrs.field_diagnosis_assessments_details || '',
    psychological_support_details: attrs.field_psychological_support_details || '',
    support_declaration_reviewed: attrs.field_support_declaration_reviewed === 'yes',
  });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [apiError, setApiError] = useState(null);

  function handleChange(e) {
    const { name, value, type, checked } = e.target;
    setForm((f) => ({ ...f, [name]: type === 'checkbox' ? checked : value }));
    if (errors[name]) setErrors((prev) => { const next = { ...prev }; delete next[name]; return next; });
  }

  function validate() {
    const e = {};
    if (!form.support_declaration_reviewed) {
      e.support_declaration_reviewed = 'You must confirm that you have reviewed this section.';
    }
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
          field_academic_support_details: form.academic_support_details,
          field_diagnosis_assessments_details: form.diagnosis_assessments_details,
          field_psychological_support_details: form.psychological_support_details,
          field_support_declaration_reviewed: form.support_declaration_reviewed ? 'yes' : 'no',
          field_section_4_reviewed: 'yes',
        },
      }));
      if (updateApplication.fulfilled.match(result)) {
        markStepComplete('additional-support');
        goToNextStep('additional-support');
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
          <h2 className="card-title">Step 4: Additional Support Declaration</h2>
        </div>

        {apiError && <div className="alert alert-error" role="alert">{apiError}</div>}

        <div className="alert alert-info">
          Please describe any additional support needs your child has. Leave fields blank if not applicable.
        </div>

        <div className="form-section">
          <div className="form-group">
            <label htmlFor="academic_support_details">Academic Support</label>
            <textarea
              id="academic_support_details"
              name="academic_support_details"
              className="form-control"
              rows={4}
              value={form.academic_support_details}
              onChange={handleChange}
              placeholder="Describe any academic support needs..."
            />
          </div>
          <div className="form-group">
            <label htmlFor="diagnosis_assessments_details">Diagnosis / Assessments</label>
            <textarea
              id="diagnosis_assessments_details"
              name="diagnosis_assessments_details"
              className="form-control"
              rows={4}
              value={form.diagnosis_assessments_details}
              onChange={handleChange}
              placeholder="List any diagnoses or assessment results..."
            />
          </div>
          <div className="form-group">
            <label htmlFor="psychological_support_details">Psychological Support</label>
            <textarea
              id="psychological_support_details"
              name="psychological_support_details"
              className="form-control"
              rows={4}
              value={form.psychological_support_details}
              onChange={handleChange}
              placeholder="Describe any psychological support needs..."
            />
          </div>
        </div>

        <div className="form-group">
          <label className="checkbox-option">
            <input
              type="checkbox"
              name="support_declaration_reviewed"
              checked={form.support_declaration_reviewed}
              onChange={handleChange}
              aria-required="true"
              aria-invalid={errors.support_declaration_reviewed ? 'true' : 'false'}
              aria-describedby={errors.support_declaration_reviewed ? 'sdr-error' : undefined}
            />
            I confirm that I have reviewed this section. If no additional support is required, I understand that leaving the fields above blank is acceptable.
          </label>
          {errors.support_declaration_reviewed && (
            <span id="sdr-error" className="field-error" role="alert">{errors.support_declaration_reviewed}</span>
          )}
        </div>

        {Object.keys(errors).length > 0 && (
          <div className="validation-summary" role="alert">Please correct the errors above before proceeding.</div>
        )}

        <div className="step-nav">
          <button type="button" className="btn btn-ghost" onClick={() => goToPrevStep('additional-support')}>Back</button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? <><span className="loading-spinner" aria-hidden="true" /> Saving…</> : 'Next: Questionnaire'}
          </button>
        </div>
      </div>
    </form>
  );
}

export default AdditionalSupportStep;
