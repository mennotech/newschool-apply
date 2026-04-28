import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { setCurrentApplication } from '../../store/slices/applicationSlice';
import * as drupalClient from '../../api/drupalClient';
import AlertBanner from '../../components/AlertBanner';

function GuardianInfoStep() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const currentApplication = useSelector((s) => s.application.currentApplication);
  const attrs = currentApplication?.attributes || {};

  const [form, setForm] = useState({
    primaryGuardianName: attrs.field_primary_guardian_name || '',
    primaryGuardianPhone: attrs.field_primary_guardian_phone || '',
    primaryGuardianEmail: attrs.field_primary_guardian_email || '',
    secondaryGuardianName: attrs.field_secondary_guardian_name || '',
    secondaryGuardianPhone: attrs.field_secondary_guardian_phone || '',
    secondaryGuardianEmail: attrs.field_secondary_guardian_email || '',
    householdStatus: attrs.field_household_status || '',
    studentLivesWith: attrs.field_student_lives_with || '',
    custodyDescription: attrs.field_custody_description || '',
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
    if (!form.primaryGuardianName.trim()) errs.primaryGuardianName = 'Primary guardian name is required';
    if (!form.primaryGuardianPhone.trim()) errs.primaryGuardianPhone = 'Primary guardian phone is required';
    if (!form.householdStatus) errs.householdStatus = 'Household status is required';
    if (!form.studentLivesWith.trim()) errs.studentLivesWith = 'Please indicate who the student lives with';
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
            field_primary_guardian_name: form.primaryGuardianName,
            field_primary_guardian_phone: form.primaryGuardianPhone,
            field_primary_guardian_email: form.primaryGuardianEmail,
            field_secondary_guardian_name: form.secondaryGuardianName,
            field_secondary_guardian_phone: form.secondaryGuardianPhone,
            field_secondary_guardian_email: form.secondaryGuardianEmail,
            field_household_status: form.householdStatus,
            field_student_lives_with: form.studentLivesWith,
            field_custody_description: form.custodyDescription,
          },
        },
      };
      const updated = await drupalClient.patch(`/jsonapi/node/application/${appId}`, payload);
      dispatch(setCurrentApplication(updated.data));
      navigate('/apply/additional-support');
    } catch (err) {
      setSaveError(err.message || 'Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  const hasErrors = Object.values(errors).some(Boolean);

  return (
    <div className="step-content">
      <h1 className="step-title">Parent / Guardian Information</h1>
      <p className="step-description">
        Provide information for the student's primary and secondary guardians.
      </p>

      {saveError && <AlertBanner type="error" message={saveError} />}

      <form onSubmit={handleNext} noValidate>
        <h2 style={{ fontSize: '1.125rem', marginBottom: '1rem' }}>Primary Guardian</h2>

        <div className="form-group">
          <label htmlFor="gi-primaryName">
            Name<span className="required-mark" aria-hidden="true">*</span>
          </label>
          <input
            id="gi-primaryName"
            type="text"
            value={form.primaryGuardianName}
            onChange={(e) => handleChange('primaryGuardianName', e.target.value)}
            aria-required="true"
            aria-invalid={errors.primaryGuardianName ? 'true' : 'false'}
            aria-describedby={errors.primaryGuardianName ? 'gi-primaryName-err' : undefined}
          />
          {errors.primaryGuardianName && <span id="gi-primaryName-err" className="field-error" role="alert">{errors.primaryGuardianName}</span>}
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="gi-primaryPhone">
              Phone<span className="required-mark" aria-hidden="true">*</span>
            </label>
            <input
              id="gi-primaryPhone"
              type="tel"
              value={form.primaryGuardianPhone}
              onChange={(e) => handleChange('primaryGuardianPhone', e.target.value)}
              aria-required="true"
              aria-invalid={errors.primaryGuardianPhone ? 'true' : 'false'}
              aria-describedby={errors.primaryGuardianPhone ? 'gi-primaryPhone-err' : undefined}
              placeholder="mobile:2045551234"
            />
            {errors.primaryGuardianPhone && <span id="gi-primaryPhone-err" className="field-error" role="alert">{errors.primaryGuardianPhone}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="gi-primaryEmail">Email</label>
            <input
              id="gi-primaryEmail"
              type="email"
              value={form.primaryGuardianEmail}
              onChange={(e) => handleChange('primaryGuardianEmail', e.target.value)}
              placeholder="work:guardian@example.com"
            />
          </div>
        </div>

        <h2 style={{ fontSize: '1.125rem', marginBottom: '1rem', marginTop: '1.5rem' }}>Secondary Guardian (Optional)</h2>

        <div className="form-group">
          <label htmlFor="gi-secondaryName">Name</label>
          <input
            id="gi-secondaryName"
            type="text"
            value={form.secondaryGuardianName}
            onChange={(e) => handleChange('secondaryGuardianName', e.target.value)}
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="gi-secondaryPhone">Phone</label>
            <input
              id="gi-secondaryPhone"
              type="tel"
              value={form.secondaryGuardianPhone}
              onChange={(e) => handleChange('secondaryGuardianPhone', e.target.value)}
              placeholder="mobile:2045551234"
            />
          </div>

          <div className="form-group">
            <label htmlFor="gi-secondaryEmail">Email</label>
            <input
              id="gi-secondaryEmail"
              type="email"
              value={form.secondaryGuardianEmail}
              onChange={(e) => handleChange('secondaryGuardianEmail', e.target.value)}
              placeholder="work:guardian@example.com"
            />
          </div>
        </div>

        <h2 style={{ fontSize: '1.125rem', marginBottom: '1rem', marginTop: '1.5rem' }}>Household Information</h2>

        <div className="form-group">
          <label htmlFor="gi-householdStatus">
            Parents' Relationship Status<span className="required-mark" aria-hidden="true">*</span>
          </label>
          <select
            id="gi-householdStatus"
            value={form.householdStatus}
            onChange={(e) => handleChange('householdStatus', e.target.value)}
            aria-required="true"
            aria-invalid={errors.householdStatus ? 'true' : 'false'}
            aria-describedby={errors.householdStatus ? 'gi-householdStatus-err' : undefined}
          >
            <option value="">Select…</option>
            <option value="married">Married / Common-law</option>
            <option value="separated">Separated</option>
            <option value="divorced">Divorced</option>
            <option value="single_parent">Single Parent</option>
            <option value="other">Other</option>
          </select>
          {errors.householdStatus && <span id="gi-householdStatus-err" className="field-error" role="alert">{errors.householdStatus}</span>}
        </div>

        <div className="form-group">
          <label htmlFor="gi-studentLivesWith">
            Student Lives With<span className="required-mark" aria-hidden="true">*</span>
          </label>
          <select
            id="gi-studentLivesWith"
            value={form.studentLivesWith}
            onChange={(e) => handleChange('studentLivesWith', e.target.value)}
            aria-required="true"
            aria-invalid={errors.studentLivesWith ? 'true' : 'false'}
            aria-describedby={errors.studentLivesWith ? 'gi-studentLivesWith-err' : undefined}
          >
            <option value="">Select…</option>
            <option value="both_parents">Both Parents</option>
            <option value="primary_guardian">Primary Guardian Only</option>
            <option value="secondary_guardian">Secondary Guardian Only</option>
            <option value="shared">Shared Custody</option>
            <option value="other">Other</option>
          </select>
          {errors.studentLivesWith && <span id="gi-studentLivesWith-err" className="field-error" role="alert">{errors.studentLivesWith}</span>}
        </div>

        <div className="form-group">
          <label htmlFor="gi-custodyDescription">Custody Description (if applicable)</label>
          <textarea
            id="gi-custodyDescription"
            value={form.custodyDescription}
            onChange={(e) => handleChange('custodyDescription', e.target.value)}
            placeholder="Describe any custody arrangements relevant to the school…"
          />
        </div>

        <div className="form-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => navigate('/apply/health-info')}
          >
            ← Back
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={saving}
          >
            {saving ? 'Saving…' : 'Next: Additional Support →'}
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

export default GuardianInfoStep;
