import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { setCurrentApplication } from '../../store/slices/applicationSlice';
import * as drupalClient from '../../api/drupalClient';
import AlertBanner from '../../components/AlertBanner';

function StudentInfoStep() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const currentApplication = useSelector((s) => s.application.currentApplication);
  const attrs = currentApplication?.attributes || {};

  const [form, setForm] = useState({
    firstName: attrs.field_student_first_name || '',
    middleName: attrs.field_student_middle_name || '',
    lastName: attrs.field_student_last_name || '',
    preferredName: attrs.field_student_preferred_name || '',
    gender: attrs.field_student_gender || '',
    dob: attrs.field_student_birth_date || '',
    currentGrade: attrs.field_student_current_grade || '',
    applyingGrade: attrs.field_student_applying_for_grade || '',
    phone: attrs.field_primary_home_phone || '',
    citizenship: attrs.field_citizenship_status || '',
    prevMbSchool: attrs.field_attended_mb_school_before || '',
    church: attrs.field_church_attending || '',
    denomination: attrs.field_denomination || '',
    mailingDiff: attrs.field_mailing_address_differs === 'yes',
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
    if (!form.firstName.trim()) errs.firstName = 'First name is required';
    if (!form.lastName.trim()) errs.lastName = 'Last name is required';
    if (!form.gender) errs.gender = 'Gender is required';
    if (!form.dob) errs.dob = 'Date of birth is required';
    if (!form.currentGrade) errs.currentGrade = 'Current grade is required';
    if (!form.applyingGrade) errs.applyingGrade = 'Applying grade is required';
    if (!form.citizenship.trim()) errs.citizenship = 'Citizenship is required';
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
          ...(appId ? { id: appId } : {}),
          attributes: {
            field_student_first_name: form.firstName,
            field_student_middle_name: form.middleName,
            field_student_last_name: form.lastName,
            field_student_preferred_name: form.preferredName,
            field_student_gender: form.gender,
            field_student_birth_date: form.dob,
            field_student_current_grade: form.currentGrade,
            field_student_applying_for_grade: form.applyingGrade,
            field_primary_home_phone: form.phone,
            field_citizenship_status: form.citizenship,
            field_attended_mb_school_before: form.prevMbSchool,
            field_church_attending: form.church,
            field_denomination: form.denomination,
            field_mailing_address_differs: form.mailingDiff ? 'yes' : 'no',
          },
        },
      };
      let updated;
      if (appId) {
        updated = await drupalClient.patch(`/jsonapi/node/application_partial_programming/${appId}`, payload);
      } else {
        payload.data.attributes.title = `${form.firstName} ${form.lastName} Application`;
        payload.data.attributes.field_application_status = 'draft';
        updated = await drupalClient.post('/jsonapi/node/application_partial_programming', payload);
      }
      dispatch(setCurrentApplication(updated.data));
      navigate('/apply/health-info');
    } catch (err) {
      setSaveError(err.message || 'Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  const hasErrors = Object.values(errors).some(Boolean);

  return (
    <div className="step-content">
      <h1 className="step-title">Student Information</h1>
      <p className="step-description">
        Please provide the student's legal name and personal details. All fields marked with * are required.
      </p>

      {saveError && <AlertBanner type="error" message={saveError} />}

      <div className="alert alert-info" role="note">
        <div className="alert-content">
          Please ensure all names match the student's official government identification.
        </div>
      </div>

      <form onSubmit={handleNext} noValidate>
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="si-firstName">
              Legal First Name<span className="required-mark" aria-hidden="true">*</span>
            </label>
            <input
              id="si-firstName"
              type="text"
              value={form.firstName}
              onChange={(e) => handleChange('firstName', e.target.value)}
              aria-required="true"
              aria-invalid={errors.firstName ? 'true' : 'false'}
              aria-describedby={errors.firstName ? 'si-firstName-err' : undefined}
            />
            {errors.firstName && <span id="si-firstName-err" className="field-error" role="alert">{errors.firstName}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="si-middleName">Legal Middle Name</label>
            <input
              id="si-middleName"
              type="text"
              value={form.middleName}
              onChange={(e) => handleChange('middleName', e.target.value)}
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="si-lastName">
              Legal Last Name<span className="required-mark" aria-hidden="true">*</span>
            </label>
            <input
              id="si-lastName"
              type="text"
              value={form.lastName}
              onChange={(e) => handleChange('lastName', e.target.value)}
              aria-required="true"
              aria-invalid={errors.lastName ? 'true' : 'false'}
              aria-describedby={errors.lastName ? 'si-lastName-err' : undefined}
            />
            {errors.lastName && <span id="si-lastName-err" className="field-error" role="alert">{errors.lastName}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="si-preferredName">Preferred Name</label>
            <input
              id="si-preferredName"
              type="text"
              value={form.preferredName}
              onChange={(e) => handleChange('preferredName', e.target.value)}
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="si-gender">
              Gender<span className="required-mark" aria-hidden="true">*</span>
            </label>
            <select
              id="si-gender"
              value={form.gender}
              onChange={(e) => handleChange('gender', e.target.value)}
              aria-required="true"
              aria-invalid={errors.gender ? 'true' : 'false'}
              aria-describedby={errors.gender ? 'si-gender-err' : undefined}
            >
              <option value="">Select…</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
              <option value="prefer_not_to_say">Prefer not to say</option>
            </select>
            {errors.gender && <span id="si-gender-err" className="field-error" role="alert">{errors.gender}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="si-dob">
              Date of Birth<span className="required-mark" aria-hidden="true">*</span>
            </label>
            <input
              id="si-dob"
              type="date"
              value={form.dob}
              onChange={(e) => handleChange('dob', e.target.value)}
              aria-required="true"
              aria-invalid={errors.dob ? 'true' : 'false'}
              aria-describedby={errors.dob ? 'si-dob-err' : undefined}
            />
            {errors.dob && <span id="si-dob-err" className="field-error" role="alert">{errors.dob}</span>}
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="si-currentGrade">
              Current Grade<span className="required-mark" aria-hidden="true">*</span>
            </label>
            <select
              id="si-currentGrade"
              value={form.currentGrade}
              onChange={(e) => handleChange('currentGrade', e.target.value)}
              aria-required="true"
              aria-invalid={errors.currentGrade ? 'true' : 'false'}
              aria-describedby={errors.currentGrade ? 'si-currentGrade-err' : undefined}
            >
              <option value="">Select…</option>
              {['K', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'].map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
            {errors.currentGrade && <span id="si-currentGrade-err" className="field-error" role="alert">{errors.currentGrade}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="si-applyingGrade">
              Applying for Grade<span className="required-mark" aria-hidden="true">*</span>
            </label>
            <select
              id="si-applyingGrade"
              value={form.applyingGrade}
              onChange={(e) => handleChange('applyingGrade', e.target.value)}
              aria-required="true"
              aria-invalid={errors.applyingGrade ? 'true' : 'false'}
              aria-describedby={errors.applyingGrade ? 'si-applyingGrade-err' : undefined}
            >
              <option value="">Select…</option>
              {['K', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'].map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
            {errors.applyingGrade && <span id="si-applyingGrade-err" className="field-error" role="alert">{errors.applyingGrade}</span>}
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="si-phone">Primary Phone</label>
          <input
            id="si-phone"
            type="tel"
            value={form.phone}
            onChange={(e) => handleChange('phone', e.target.value)}
            placeholder="e.g. mobile:2045551234"
          />
          <span className="form-hint">Format: type:number (e.g. mobile:2045551234)</span>
        </div>

        <div className="form-group">
          <label htmlFor="si-citizenship">
            Citizenship<span className="required-mark" aria-hidden="true">*</span>
          </label>
          <select
            id="si-citizenship"
            value={form.citizenship}
            onChange={(e) => handleChange('citizenship', e.target.value)}
            aria-required="true"
            aria-invalid={errors.citizenship ? 'true' : 'false'}
            aria-describedby={errors.citizenship ? 'si-citizenship-err' : undefined}
          >
            <option value="">Select…</option>
            <option value="canadian_citizen">Canadian Citizen</option>
            <option value="permanent_resident">Permanent Resident</option>
            <option value="refugee_claimant">Refugee Claimant</option>
            <option value="study_permit">Study Permit</option>
            <option value="other">Other</option>
          </select>
          {errors.citizenship && <span id="si-citizenship-err" className="field-error" role="alert">{errors.citizenship}</span>}
        </div>

        <div className="form-group">
          <label htmlFor="si-prevMbSchool">Previous Manitoba School</label>
          <select
            id="si-prevMbSchool"
            value={form.prevMbSchool}
            onChange={(e) => handleChange('prevMbSchool', e.target.value)}
          >
            <option value="">Select…</option>
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </select>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="si-church">Church Attending</label>
            <input
              id="si-church"
              type="text"
              value={form.church}
              onChange={(e) => handleChange('church', e.target.value)}
            />
          </div>

          <div className="form-group">
            <label htmlFor="si-denomination">Denomination</label>
            <input
              id="si-denomination"
              type="text"
              value={form.denomination}
              onChange={(e) => handleChange('denomination', e.target.value)}
            />
          </div>
        </div>

        <div className="form-check">
          <input
            id="si-mailingDiff"
            type="checkbox"
            checked={form.mailingDiff}
            onChange={(e) => handleChange('mailingDiff', e.target.checked)}
          />
          <label htmlFor="si-mailingDiff">
            Mailing address is different from physical address
          </label>
        </div>

        <div className="form-actions">
          <button
            type="submit"
            className="btn btn-primary"
            disabled={saving}
          >
            {saving ? 'Saving…' : 'Next: Health Info →'}
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

export default StudentInfoStep;
