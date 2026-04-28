import React, { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { updateApplication } from '../../store/slices/applicationSlice';

function QuestionnaireStep() {
  const { application, markStepComplete, goToNextStep, goToPrevStep } = useOutletContext();
  const dispatch = useDispatch();
  const attrs = application?.attributes || {};

  const [form, setForm] = useState({
    christian_testimony: attrs.field_christian_testimony || '',
    school_interest_reason: attrs.field_school_interest_reason || '',
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
    if (!form.christian_testimony.trim()) e.christian_testimony = 'Christian testimony is required.';
    if (!form.school_interest_reason.trim()) e.school_interest_reason = 'Reason for interest is required.';
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
          field_christian_testimony: form.christian_testimony,
          field_school_interest_reason: form.school_interest_reason,
          field_section_5_reviewed: 'yes',
        },
      }));
      if (updateApplication.fulfilled.match(result)) {
        markStepComplete('questionnaire');
        goToNextStep('questionnaire');
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
          <h2 className="card-title">Step 5: Parent Questionnaire</h2>
        </div>

        {apiError && <div className="alert alert-error" role="alert">{apiError}</div>}

        <div className="form-group">
          <label htmlFor="christian_testimony">
            Christian Testimony <span className="required" aria-hidden="true">*</span>
          </label>
          <span id="christian_testimony-hint" className="form-hint">
            Please share your family's Christian testimony and faith background.
          </span>
          <textarea
            id="christian_testimony"
            name="christian_testimony"
            className="form-control"
            rows={6}
            value={form.christian_testimony}
            onChange={handleChange}
            aria-required="true"
            aria-invalid={errors.christian_testimony ? 'true' : 'false'}
            aria-describedby={errors.christian_testimony ? 'ct-error' : 'christian_testimony-hint'}
          />
          {errors.christian_testimony && <span id="ct-error" className="field-error" role="alert">{errors.christian_testimony}</span>}
        </div>

        <div className="form-group">
          <label htmlFor="school_interest_reason">
            Reason for Interest in the School <span className="required" aria-hidden="true">*</span>
          </label>
          <span id="school_interest_reason-hint" className="form-hint">
            Why would you like your child to attend this school?
          </span>
          <textarea
            id="school_interest_reason"
            name="school_interest_reason"
            className="form-control"
            rows={6}
            value={form.school_interest_reason}
            onChange={handleChange}
            aria-required="true"
            aria-invalid={errors.school_interest_reason ? 'true' : 'false'}
            aria-describedby={errors.school_interest_reason ? 'sir-error' : 'school_interest_reason-hint'}
          />
          {errors.school_interest_reason && <span id="sir-error" className="field-error" role="alert">{errors.school_interest_reason}</span>}
        </div>

        {Object.keys(errors).length > 0 && (
          <div className="validation-summary" role="alert">Please correct the errors above before proceeding.</div>
        )}

        <div className="step-nav">
          <button type="button" className="btn btn-ghost" onClick={() => goToPrevStep('questionnaire')}>Back</button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? <><span className="loading-spinner" aria-hidden="true" /> Saving…</> : 'Next: Commitment'}
          </button>
        </div>
      </div>
    </form>
  );
}

export default QuestionnaireStep;
