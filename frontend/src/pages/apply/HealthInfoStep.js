import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { setCurrentApplication } from '../../store/slices/applicationSlice';
import * as drupalClient from '../../api/drupalClient';
import AlertBanner from '../../components/AlertBanner';

function HealthInfoStep() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const currentApplication = useSelector((s) => s.application.currentApplication);
  const attrs = currentApplication?.attributes || {};

  const [form, setForm] = useState({
    healthNumber9: attrs.field_mb_health_number_9_digit || '',
    healthNumber6: attrs.field_mb_health_number_6_digit || '',
    emergencyContactName: attrs.field_emergency_contact_name || '',
    emergencyContactPhone: attrs.field_emergency_contact_phone || '',
    allergies: attrs.field_allergies || '',
    medications: attrs.field_medications_used_fr_2b9881 || '',
    medicalRestrictions: attrs.field_medical_restrictions || '',
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
    if (!form.healthNumber9.trim()) errs.healthNumber9 = 'MB Health # (9 digit) is required';
    if (!form.healthNumber6.trim()) errs.healthNumber6 = 'MB Health # (6 digit) is required';
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
          type: 'node--application_partial_programming',
          id: appId,
          attributes: {
            field_mb_health_number_9_digit: form.healthNumber9,
            field_mb_health_number_6_digit: form.healthNumber6,
            field_allergies: form.allergies,
            field_medications_used_fr_2b9881: form.medications,
            field_medical_restrictions: form.medicalRestrictions,
          },
        },
      };
      const updated = await drupalClient.patch(`/jsonapi/node/application_partial_programming/${appId}`, payload);
      dispatch(setCurrentApplication(updated.data));
      navigate('/apply/guardian-info');
    } catch (err) {
      setSaveError(err.message || 'Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  const hasErrors = Object.values(errors).some(Boolean);

  return (
    <div className="step-content">
      <h1 className="step-title">Health Information</h1>
      <p className="step-description">
        Please provide health and emergency contact information for the student.
      </p>

      {saveError && <AlertBanner type="error" message={saveError} />}

      <form onSubmit={handleNext} noValidate>
        <div className="form-group">
          <label htmlFor="hi-healthNumber9">
            MB Health # (9 Digit)<span className="required-mark" aria-hidden="true">*</span>
          </label>
          <input
            id="hi-healthNumber9"
            type="text"
            value={form.healthNumber9}
            onChange={(e) => handleChange('healthNumber9', e.target.value)}
            aria-required="true"
            aria-invalid={errors.healthNumber9 ? 'true' : 'false'}
            aria-describedby={errors.healthNumber9 ? 'hi-healthNumber9-err' : undefined}
            placeholder="e.g. 123456789"
          />
          {errors.healthNumber9 && <span id="hi-healthNumber9-err" className="field-error" role="alert">{errors.healthNumber9}</span>}
        </div>

        <div className="form-group">
          <label htmlFor="hi-healthNumber6">
            MB Health # (6 Digit)<span className="required-mark" aria-hidden="true">*</span>
          </label>
          <input
            id="hi-healthNumber6"
            type="text"
            value={form.healthNumber6}
            onChange={(e) => handleChange('healthNumber6', e.target.value)}
            aria-required="true"
            aria-invalid={errors.healthNumber6 ? 'true' : 'false'}
            aria-describedby={errors.healthNumber6 ? 'hi-healthNumber6-err' : undefined}
            placeholder="e.g. 123456"
          />
          {errors.healthNumber6 && <span id="hi-healthNumber6-err" className="field-error" role="alert">{errors.healthNumber6}</span>}
        </div>

        <fieldset style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '1rem', marginBottom: '1rem' }}>
          <legend style={{ fontWeight: 600, padding: '0 0.5rem' }}>Emergency Contact</legend>

          <div className="form-group">
            <label htmlFor="hi-emergencyName">
              Emergency Contact Name<span className="required-mark" aria-hidden="true">*</span>
            </label>
            <input
              id="hi-emergencyName"
              type="text"
              value={form.emergencyContactName}
              onChange={(e) => handleChange('emergencyContactName', e.target.value)}
              aria-required="true"
              aria-invalid={errors.emergencyContactName ? 'true' : 'false'}
              aria-describedby={errors.emergencyContactName ? 'hi-emergencyName-err' : undefined}
            />
            {errors.emergencyContactName && <span id="hi-emergencyName-err" className="field-error" role="alert">{errors.emergencyContactName}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="hi-emergencyPhone">
              Emergency Contact Phone<span className="required-mark" aria-hidden="true">*</span>
            </label>
            <input
              id="hi-emergencyPhone"
              type="tel"
              value={form.emergencyContactPhone}
              onChange={(e) => handleChange('emergencyContactPhone', e.target.value)}
              aria-required="true"
              aria-invalid={errors.emergencyContactPhone ? 'true' : 'false'}
              aria-describedby={errors.emergencyContactPhone ? 'hi-emergencyPhone-err' : undefined}
              placeholder="e.g. mobile:2045551234"
            />
            {errors.emergencyContactPhone && <span id="hi-emergencyPhone-err" className="field-error" role="alert">{errors.emergencyContactPhone}</span>}
            <span className="form-hint">Format: type:number (e.g. mobile:2045551234)</span>
          </div>
        </fieldset>

        <div className="form-group">
          <label htmlFor="hi-allergies">Allergies</label>
          <textarea
            id="hi-allergies"
            value={form.allergies}
            onChange={(e) => handleChange('allergies', e.target.value)}
            placeholder="List any known allergies…"
          />
        </div>

        <div className="form-group">
          <label htmlFor="hi-medications">Frequently Used Medications</label>
          <textarea
            id="hi-medications"
            value={form.medications}
            onChange={(e) => handleChange('medications', e.target.value)}
            placeholder="List any regularly used medications…"
          />
        </div>

        <div className="form-group">
          <label htmlFor="hi-medicalRestrictions">Medical Restrictions</label>
          <textarea
            id="hi-medicalRestrictions"
            value={form.medicalRestrictions}
            onChange={(e) => handleChange('medicalRestrictions', e.target.value)}
            placeholder="Describe any medical restrictions or special considerations…"
          />
        </div>

        <div className="form-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => navigate('/apply/student-info')}
          >
            ← Back
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={saving}
          >
            {saving ? 'Saving…' : 'Next: Guardian Info →'}
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

export default HealthInfoStep;
