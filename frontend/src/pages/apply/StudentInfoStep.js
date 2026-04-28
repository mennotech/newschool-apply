import React, { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { updateApplication } from '../../store/slices/applicationSlice';

function StudentInfoStep() {
  const { application, markStepComplete, goToNextStep } = useOutletContext();
  const dispatch = useDispatch();

  const attrs = application?.attributes || {};

  const [form, setForm] = useState({
    student_first_name: attrs.field_student_first_name || '',
    student_middle_name: attrs.field_student_middle_name || '',
    student_last_name: attrs.field_student_last_name || '',
    student_preferred_name: attrs.field_student_preferred_name || '',
    student_gender: attrs.field_student_gender || '',
    student_birth_date: attrs.field_student_birth_date || '',
    student_current_grade: attrs.field_student_current_grade || '',
    student_applying_for_grade: attrs.field_student_applying_for_grade || '',
    primary_home_phone: attrs.field_primary_home_phone || '',
    citizenship_status: attrs.field_citizenship_status || '',
    attended_mb_school_before: attrs.field_attended_mb_school_before || '',
    church_attending: attrs.field_church_attending || '',
    denomination: attrs.field_denomination || '',
    mailing_address_differs: attrs.field_mailing_address_differs || 'no',
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
    if (!form.student_first_name.trim()) e.student_first_name = 'First name is required.';
    if (!form.student_last_name.trim()) e.student_last_name = 'Last name is required.';
    if (!form.student_gender) e.student_gender = 'Gender is required.';
    if (!form.student_birth_date) e.student_birth_date = 'Birth date is required.';
    if (!form.student_current_grade) e.student_current_grade = 'Current grade is required.';
    if (!form.student_applying_for_grade) e.student_applying_for_grade = 'Applying-for grade is required.';
    if (!form.primary_home_phone.trim()) e.primary_home_phone = 'Phone number is required.';
    if (!form.citizenship_status) e.citizenship_status = 'Citizenship status is required.';
    if (!form.attended_mb_school_before) e.attended_mb_school_before = 'This field is required.';
    return e;
  }

  async function handleAutosave(field) {
    if (!application?.id) return;
    const value = form[field];
    try {
      await dispatch(updateApplication({
        id: application.id,
        attributes: { [`field_${field}`]: value },
      }));
    } catch {}
  }

  async function handleNext(e) {
    e.preventDefault();
    const validationErrors = validate();
    if (Object.keys(validationErrors).length) {
      setErrors(validationErrors);
      return;
    }
    setSaving(true);
    setApiError(null);
    try {
      const result = await dispatch(updateApplication({
        id: application.id,
        attributes: {
          field_student_first_name: form.student_first_name,
          field_student_middle_name: form.student_middle_name,
          field_student_last_name: form.student_last_name,
          field_student_preferred_name: form.student_preferred_name,
          field_student_gender: form.student_gender,
          field_student_birth_date: form.student_birth_date,
          field_student_current_grade: form.student_current_grade,
          field_student_applying_for_grade: form.student_applying_for_grade,
          field_primary_home_phone: form.primary_home_phone,
          field_citizenship_status: form.citizenship_status,
          field_attended_mb_school_before: form.attended_mb_school_before,
          field_church_attending: form.church_attending,
          field_denomination: form.denomination,
          field_mailing_address_differs: form.mailing_address_differs,
          field_section_1_reviewed: 'yes',
        },
      }));
      if (updateApplication.fulfilled.match(result)) {
        markStepComplete('student-info');
        goToNextStep('student-info');
      } else {
        setApiError('Failed to save. Please try again.');
      }
    } catch (err) {
      setApiError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const grades = ['JK', 'K', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];

  return (
    <form onSubmit={handleNext} noValidate>
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Step 1: Student Information</h2>
        </div>

        <div className="alert alert-info" style={{ marginBottom: '1rem' }}>
          Please provide accurate information for the student applying to NewSchool.
        </div>

        {apiError && <div className="alert alert-error" role="alert">{apiError}</div>}

        <div className="form-section">
          <h3 className="form-section-title">Identity</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 1rem' }}>
            <div className="form-group">
              <label htmlFor="student_first_name">
                First Name <span className="required" aria-hidden="true">*</span>
              </label>
              <input
                id="student_first_name"
                name="student_first_name"
                type="text"
                className="form-control"
                value={form.student_first_name}
                onChange={handleChange}
                onBlur={() => handleAutosave('student_first_name')}
                aria-required="true"
                aria-invalid={errors.student_first_name ? 'true' : 'false'}
                aria-describedby={errors.student_first_name ? 'sfn-error' : undefined}
              />
              {errors.student_first_name && <span id="sfn-error" className="field-error" role="alert">{errors.student_first_name}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="student_middle_name">Middle Name</label>
              <input
                id="student_middle_name"
                name="student_middle_name"
                type="text"
                className="form-control"
                value={form.student_middle_name}
                onChange={handleChange}
                onBlur={() => handleAutosave('student_middle_name')}
              />
            </div>

            <div className="form-group">
              <label htmlFor="student_last_name">
                Last Name <span className="required" aria-hidden="true">*</span>
              </label>
              <input
                id="student_last_name"
                name="student_last_name"
                type="text"
                className="form-control"
                value={form.student_last_name}
                onChange={handleChange}
                onBlur={() => handleAutosave('student_last_name')}
                aria-required="true"
                aria-invalid={errors.student_last_name ? 'true' : 'false'}
                aria-describedby={errors.student_last_name ? 'sln-error' : undefined}
              />
              {errors.student_last_name && <span id="sln-error" className="field-error" role="alert">{errors.student_last_name}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="student_preferred_name">Preferred Name</label>
              <input
                id="student_preferred_name"
                name="student_preferred_name"
                type="text"
                className="form-control"
                value={form.student_preferred_name}
                onChange={handleChange}
              />
            </div>
          </div>

          <div className="form-group">
            <fieldset>
              <legend style={{ fontWeight: 500, fontSize: '0.875rem', marginBottom: '0.375rem' }}>
                Gender <span className="required" aria-hidden="true">*</span>
              </legend>
              <div className="radio-group inline" aria-required="true">
                {['male', 'female'].map((g) => (
                  <label key={g} className="radio-option">
                    <input
                      type="radio"
                      name="student_gender"
                      value={g}
                      checked={form.student_gender === g}
                      onChange={handleChange}
                      aria-invalid={errors.student_gender ? 'true' : 'false'}
                    />
                    {g.charAt(0).toUpperCase() + g.slice(1)}
                  </label>
                ))}
              </div>
              {errors.student_gender && <span className="field-error" role="alert">{errors.student_gender}</span>}
            </fieldset>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 1rem' }}>
            <div className="form-group">
              <label htmlFor="student_birth_date">
                Date of Birth <span className="required" aria-hidden="true">*</span>
              </label>
              <input
                id="student_birth_date"
                name="student_birth_date"
                type="date"
                className="form-control"
                value={form.student_birth_date}
                onChange={handleChange}
                aria-required="true"
                aria-invalid={errors.student_birth_date ? 'true' : 'false'}
                aria-describedby={errors.student_birth_date ? 'sbd-error' : undefined}
              />
              {errors.student_birth_date && <span id="sbd-error" className="field-error" role="alert">{errors.student_birth_date}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="primary_home_phone">
                Primary Phone <span className="required" aria-hidden="true">*</span>
              </label>
              <input
                id="primary_home_phone"
                name="primary_home_phone"
                type="tel"
                className="form-control"
                value={form.primary_home_phone}
                onChange={handleChange}
                onBlur={() => handleAutosave('primary_home_phone')}
                aria-required="true"
                aria-invalid={errors.primary_home_phone ? 'true' : 'false'}
                aria-describedby={errors.primary_home_phone ? 'php-error' : undefined}
              />
              {errors.primary_home_phone && <span id="php-error" className="field-error" role="alert">{errors.primary_home_phone}</span>}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 1rem' }}>
            <div className="form-group">
              <label htmlFor="student_current_grade">
                Current Grade <span className="required" aria-hidden="true">*</span>
              </label>
              <select
                id="student_current_grade"
                name="student_current_grade"
                className="form-control"
                value={form.student_current_grade}
                onChange={handleChange}
                aria-required="true"
                aria-invalid={errors.student_current_grade ? 'true' : 'false'}
              >
                <option value="">Select grade…</option>
                {grades.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
              {errors.student_current_grade && <span className="field-error" role="alert">{errors.student_current_grade}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="student_applying_for_grade">
                Applying for Grade <span className="required" aria-hidden="true">*</span>
              </label>
              <select
                id="student_applying_for_grade"
                name="student_applying_for_grade"
                className="form-control"
                value={form.student_applying_for_grade}
                onChange={handleChange}
                aria-required="true"
                aria-invalid={errors.student_applying_for_grade ? 'true' : 'false'}
              >
                <option value="">Select grade…</option>
                {grades.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
              {errors.student_applying_for_grade && <span className="field-error" role="alert">{errors.student_applying_for_grade}</span>}
            </div>
          </div>
        </div>

        <div className="form-section">
          <h3 className="form-section-title">Additional Details</h3>

          <div className="form-group">
            <fieldset>
              <legend style={{ fontWeight: 500, fontSize: '0.875rem', marginBottom: '0.375rem' }}>
                Citizenship Status <span className="required" aria-hidden="true">*</span>
              </legend>
              <div className="radio-group">
                {[
                  { value: 'canadian_citizen', label: 'Canadian Citizen' },
                  { value: 'permanent_resident', label: 'Permanent Resident' },
                  { value: 'refugee_claimant', label: 'Refugee Claimant' },
                  { value: 'study_permit', label: 'Study Permit' },
                  { value: 'other', label: 'Other' },
                ].map((opt) => (
                  <label key={opt.value} className="radio-option">
                    <input
                      type="radio"
                      name="citizenship_status"
                      value={opt.value}
                      checked={form.citizenship_status === opt.value}
                      onChange={handleChange}
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
              {errors.citizenship_status && <span className="field-error" role="alert">{errors.citizenship_status}</span>}
            </fieldset>
          </div>

          <div className="form-group">
            <fieldset>
              <legend style={{ fontWeight: 500, fontSize: '0.875rem', marginBottom: '0.375rem' }}>
                Have you attended a Manitoba school before? <span className="required" aria-hidden="true">*</span>
              </legend>
              <div className="radio-group inline">
                {['yes', 'no'].map((opt) => (
                  <label key={opt} className="radio-option">
                    <input
                      type="radio"
                      name="attended_mb_school_before"
                      value={opt}
                      checked={form.attended_mb_school_before === opt}
                      onChange={handleChange}
                    />
                    {opt.charAt(0).toUpperCase() + opt.slice(1)}
                  </label>
                ))}
              </div>
              {errors.attended_mb_school_before && <span className="field-error" role="alert">{errors.attended_mb_school_before}</span>}
            </fieldset>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 1rem' }}>
            <div className="form-group">
              <label htmlFor="church_attending">Church Attending</label>
              <input
                id="church_attending"
                name="church_attending"
                type="text"
                className="form-control"
                value={form.church_attending}
                onChange={handleChange}
              />
            </div>
            <div className="form-group">
              <label htmlFor="denomination">Denomination</label>
              <input
                id="denomination"
                name="denomination"
                type="text"
                className="form-control"
                value={form.denomination}
                onChange={handleChange}
              />
            </div>
          </div>
        </div>

        {Object.keys(errors).length > 0 && (
          <div className="validation-summary" role="alert">
            Please correct the errors above before proceeding.
          </div>
        )}

        <div className="step-nav">
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? <><span className="loading-spinner" aria-hidden="true" /> Saving…</> : 'Next: Health Information'}
          </button>
        </div>
      </div>
    </form>
  );
}

export default StudentInfoStep;
