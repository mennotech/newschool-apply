import React, { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { updateApplication } from '../../store/slices/applicationSlice';

function GuardianInfoStep() {
  const { application, markStepComplete, goToNextStep, goToPrevStep } = useOutletContext();
  const dispatch = useDispatch();
  const attrs = application?.attributes || {};

  const [form, setForm] = useState({
    household_relationship_status: attrs.field_household_relationship_status || '',
    student_lives_with: attrs.field_student_lives_with || '',
    custody_description: attrs.field_custody_description || '',
    primary_guardian_relationship_notes: attrs.field_primary_guardian_relationship_notes || '',
    secondary_guardian_relationship_notes: attrs.field_secondary_guardian_relationship_notes || '',
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
    if (!form.household_relationship_status) e.household_relationship_status = "Parents' relationship status is required.";
    if (!form.student_lives_with) e.student_lives_with = 'Student lives with is required.';
    if (!form.custody_description) e.custody_description = 'Custody description is required.';
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
          field_household_relationship_status: form.household_relationship_status,
          field_student_lives_with: form.student_lives_with,
          field_custody_description: form.custody_description,
          field_primary_guardian_relationship_notes: form.primary_guardian_relationship_notes,
          field_secondary_guardian_relationship_notes: form.secondary_guardian_relationship_notes,
          field_section_3_reviewed: 'yes',
        },
      }));
      if (updateApplication.fulfilled.match(result)) {
        markStepComplete('guardian-info');
        goToNextStep('guardian-info');
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
          <h2 className="card-title">Step 3: Parent / Guardian Information</h2>
        </div>

        {apiError && <div className="alert alert-error" role="alert">{apiError}</div>}

        <div className="alert alert-info">
          Guardian records are managed through reusable Person records. Add or edit guardians from your
          People library, then select them for primary and secondary guardian roles.
        </div>

        <div className="form-section">
          <h3 className="form-section-title">Household Details</h3>

          <div className="form-group">
            <fieldset>
              <legend style={{ fontWeight: 500, fontSize: '0.875rem', marginBottom: '0.375rem' }}>
                Student's Parents Are <span className="required" aria-hidden="true">*</span>
              </legend>
              <div className="radio-group inline">
                {['married', 'divorced', 'separated', 'other'].map((opt) => (
                  <label key={opt} className="radio-option">
                    <input
                      type="radio"
                      name="household_relationship_status"
                      value={opt}
                      checked={form.household_relationship_status === opt}
                      onChange={handleChange}
                    />
                    {opt.charAt(0).toUpperCase() + opt.slice(1)}
                  </label>
                ))}
              </div>
              {errors.household_relationship_status && <span className="field-error" role="alert">{errors.household_relationship_status}</span>}
            </fieldset>
          </div>

          <div className="form-group">
            <fieldset>
              <legend style={{ fontWeight: 500, fontSize: '0.875rem', marginBottom: '0.375rem' }}>
                Student Lives With <span className="required" aria-hidden="true">*</span>
              </legend>
              <div className="radio-group inline">
                {[
                  { value: 'both_parents', label: 'Both Parents' },
                  { value: 'mother', label: 'Mother' },
                  { value: 'father', label: 'Father' },
                  { value: 'shared_custody', label: 'Shared Custody' },
                  { value: 'other', label: 'Other' },
                ].map((opt) => (
                  <label key={opt.value} className="radio-option">
                    <input
                      type="radio"
                      name="student_lives_with"
                      value={opt.value}
                      checked={form.student_lives_with === opt.value}
                      onChange={handleChange}
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
              {errors.student_lives_with && <span className="field-error" role="alert">{errors.student_lives_with}</span>}
            </fieldset>
          </div>

          <div className="form-group">
            <fieldset>
              <legend style={{ fontWeight: 500, fontSize: '0.875rem', marginBottom: '0.375rem' }}>
                Custody Description <span className="required" aria-hidden="true">*</span>
              </legend>
              <div className="radio-group inline">
                {['joint', 'mother', 'father', 'other'].map((opt) => (
                  <label key={opt} className="radio-option">
                    <input
                      type="radio"
                      name="custody_description"
                      value={opt}
                      checked={form.custody_description === opt}
                      onChange={handleChange}
                    />
                    {opt.charAt(0).toUpperCase() + opt.slice(1)}
                  </label>
                ))}
              </div>
              {errors.custody_description && <span className="field-error" role="alert">{errors.custody_description}</span>}
            </fieldset>
          </div>

          <div className="form-group">
            <label htmlFor="primary_guardian_relationship_notes">Primary Guardian Notes</label>
            <textarea
              id="primary_guardian_relationship_notes"
              name="primary_guardian_relationship_notes"
              className="form-control"
              value={form.primary_guardian_relationship_notes}
              onChange={handleChange}
            />
          </div>

          <div className="form-group">
            <label htmlFor="secondary_guardian_relationship_notes">Secondary Guardian Notes</label>
            <textarea
              id="secondary_guardian_relationship_notes"
              name="secondary_guardian_relationship_notes"
              className="form-control"
              value={form.secondary_guardian_relationship_notes}
              onChange={handleChange}
            />
          </div>
        </div>

        {Object.keys(errors).length > 0 && (
          <div className="validation-summary" role="alert">Please correct the errors above before proceeding.</div>
        )}

        <div className="step-nav">
          <button type="button" className="btn btn-ghost" onClick={() => goToPrevStep('guardian-info')}>Back</button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? <><span className="loading-spinner" aria-hidden="true" /> Saving…</> : 'Next: Additional Support'}
          </button>
        </div>
      </div>
    </form>
  );
}

export default GuardianInfoStep;
