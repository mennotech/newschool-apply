import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { setCurrentApplication } from '../../store/slices/applicationSlice';
import * as drupalClient from '../../api/drupalClient';
import AlertBanner from '../../components/AlertBanner';

function AdditionalSupportStep() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const currentApplication = useSelector((s) => s.application.currentApplication);
  const attrs = currentApplication?.attributes || {};

  const [form, setForm] = useState({
    academicSupport: attrs.field_academic_support || '',
    diagnosisAssessments: attrs.field_diagnosis_assessments || '',
    psychologicalSupport: attrs.field_psychological_support || '',
    reviewed: attrs.field_additional_support_reviewed || false,
  });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  function handleChange(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
    if (errors[field]) setErrors((e) => ({ ...e, [field]: '' }));
  }

  function validate() {
    const errs = {};
    if (!form.reviewed) {
      errs.reviewed = 'Please confirm you have reviewed this page before continuing';
    }
    return errs;
  }

  async function handleNext(e) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    setSaving(true);
    setSaveError('');
    try {
      const appId = currentApplication?.id;
      const payload = {
        data: {
          type: 'node--application',
          id: appId,
          attributes: {
            field_academic_support: form.academicSupport,
            field_diagnosis_assessments: form.diagnosisAssessments,
            field_psychological_support: form.psychologicalSupport,
            field_additional_support_reviewed: form.reviewed,
          },
        },
      };
      const updated = await drupalClient.patch(`/jsonapi/node/application/${appId}`, payload);
      dispatch(setCurrentApplication(updated.data));
      navigate('/apply/questionnaire');
    } catch (err) {
      setSaveError(err.message || 'Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  const hasErrors = Object.values(errors).some(Boolean);

  return (
    <div className="step-content">
      <h1 className="step-title">Additional Support</h1>
      <p className="step-description">
        Please share any information about learning, health, or psychological support the student may need.
        Leave fields blank if they do not apply.
      </p>

      {saveError && <AlertBanner type="error" message={saveError} />}

      <form onSubmit={handleNext} noValidate>
        <div className="form-group">
          <label htmlFor="as-academicSupport">Academic Support</label>
          <textarea
            id="as-academicSupport"
            value={form.academicSupport}
            onChange={(e) => handleChange('academicSupport', e.target.value)}
            placeholder="Describe any academic support needs, learning accommodations, or special education history…"
          />
        </div>

        <div className="form-group">
          <label htmlFor="as-diagnosisAssessments">Diagnoses / Assessments</label>
          <textarea
            id="as-diagnosisAssessments"
            value={form.diagnosisAssessments}
            onChange={(e) => handleChange('diagnosisAssessments', e.target.value)}
            placeholder="List any formal diagnoses or assessments (e.g. ADHD, dyslexia, autism spectrum)…"
          />
        </div>

        <div className="form-group">
          <label htmlFor="as-psychologicalSupport">Psychological / Emotional Support</label>
          <textarea
            id="as-psychologicalSupport"
            value={form.psychologicalSupport}
            onChange={(e) => handleChange('psychologicalSupport', e.target.value)}
            placeholder="Describe any counseling, therapy, or psychological support the student currently receives…"
          />
        </div>

        <div
          style={{
            background: 'var(--color-warning-light)',
            border: '1px solid var(--color-warning)',
            borderRadius: 'var(--radius-md)',
            padding: '1rem',
            marginBottom: '1.5rem',
          }}
        >
          <div
            className="form-check"
            style={{ margin: 0 }}
          >
            <input
              id="as-reviewed"
              type="checkbox"
              checked={form.reviewed}
              onChange={(e) => handleChange('reviewed', e.target.checked)}
              aria-required="true"
              aria-invalid={errors.reviewed ? 'true' : 'false'}
              aria-describedby={errors.reviewed ? 'as-reviewed-err' : undefined}
            />
            <label htmlFor="as-reviewed">
              <strong>I confirm that I have reviewed this page.</strong> The information above is accurate,
              even if no additional support details apply to our student.
            </label>
          </div>
          {errors.reviewed && (
            <span id="as-reviewed-err" className="field-error" role="alert" style={{ marginTop: '0.5rem', display: 'block' }}>
              {errors.reviewed}
            </span>
          )}
        </div>

        <div className="form-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => navigate('/apply/guardian-info')}
          >
            ← Back
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={saving}
          >
            {saving ? 'Saving…' : 'Next: Questionnaire →'}
          </button>
          {hasErrors && (
            <span className="validation-summary" role="alert">
              Please correct the errors above before continuing.
            </span>
          )}
        </div>
      </form>
    </div>
  );
}

export default AdditionalSupportStep;
