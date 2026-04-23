import React, { useState } from 'react';
import { post } from '../../api/drupalClient';
import AddressChunk from '../AddressChunk';

const CITIZENSHIP_OPTIONS = [
  { value: 'canadian_citizen', label: 'Canadian Citizen' },
  { value: 'permanent_resident', label: 'Permanent Resident' },
  { value: 'refugee_claimant', label: 'Refugee Claimant' },
  { value: 'study_permit', label: 'Study Permit' },
  { value: 'other', label: 'Other' },
];

const INITIAL_FIELDS = {
  student_first_name: '',
  student_middle_name: '',
  student_last_name: '',
  student_preferred_name: '',
  student_gender: '',
  student_birth_date: '',
  student_current_grade: '',
  student_applying_for_grade: '',
  primary_home_phone: '',
  physical_address_line_1: '',
  physical_address_line_2: '',
  physical_city: '',
  physical_state_province: '',
  physical_postal_zip: '',
  mailing_address_differs: '',
  mailing_address_line_1: '',
  mailing_address_line_2: '',
  mailing_address_city: '',
  mailing_address_state_province: '',
  mailing_address_postal_zip: '',
  citizenship_status: '',
  attended_mb_school_before: '',
  church_attending: '',
  denomination: '',
};

function StudentInfoStep({ onComplete, initialData = {}, applicationId, isResume = false, onFieldBlur }) {
  const [fields, setFields] = useState(() => ({ ...INITIAL_FIELDS, ...initialData }));
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  function handleChange(e) {
    const { name, value, type, tagName } = e.target;
    setFields((prev) => {
      const next = { ...prev, [name]: value };
      if (type === 'radio' || tagName === 'SELECT') {
        onFieldBlur && onFieldBlur(name, value, next);
      }
      return next;
    });
  }

  function handleBlur(e) {
    onFieldBlur && onFieldBlur(e.target.name, e.target.value, fields);
  }

  function validate() {
    const errs = {};
    if (!fields.student_first_name.trim()) errs.student_first_name = 'First name is required.';
    if (!fields.student_last_name.trim()) errs.student_last_name = 'Last name is required.';
    if (!fields.student_birth_date) errs.student_birth_date = 'Date of birth is required.';
    if (!fields.student_applying_for_grade.trim()) errs.student_applying_for_grade = 'Applying for grade is required.';
    if (!fields.primary_home_phone.trim()) errs.primary_home_phone = 'Phone number is required.';
    if (!fields.physical_address_line_1.trim()) errs.physical_address_line_1 = 'Street address is required.';
    if (!fields.physical_city.trim()) errs.physical_city = 'City is required.';
    if (!fields.physical_state_province.trim()) errs.physical_state_province = 'Province is required.';
    if (!fields.physical_postal_zip.trim()) errs.physical_postal_zip = 'Postal code is required.';
    if (!fields.student_gender) errs.student_gender = 'Gender is required.';
    if (!fields.citizenship_status) errs.citizenship_status = 'Citizenship status is required.';
    if (!fields.mailing_address_differs) errs.mailing_address_differs = 'Please indicate if mailing address differs.';
    if (!fields.attended_mb_school_before) errs.attended_mb_school_before = 'Please answer this question.';

    // Validate mailing address fields if different
    if (fields.mailing_address_differs === 'yes') {
      if (!fields.mailing_address_line_1.trim()) errs.mailing_address_line_1 = 'Street address is required.';
      if (!fields.mailing_address_city.trim()) errs.mailing_address_city = 'City is required.';
      if (!fields.mailing_address_state_province.trim()) errs.mailing_address_state_province = 'Province is required.';
      if (!fields.mailing_address_postal_zip.trim()) errs.mailing_address_postal_zip = 'Postal code is required.';
    }

    return errs;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    setErrors({});
    setServerError(null);
    setSubmitting(true);

    try {
      // When resuming an existing draft, skip creating a new student profile
      if (applicationId && isResume) {
        onComplete({ profile: null, formData: fields });
        return;
      }

      const payload = {
        data: {
          type: 'node--student_profile',
          attributes: {
            title: `${fields.student_first_name} ${fields.student_last_name}`,
            field_first_name: fields.student_first_name,
            field_last_name: fields.student_last_name,
            field_date_of_birth: fields.student_birth_date,
            field_grade_applying_for: fields.student_applying_for_grade,
          },
        },
      };
      const result = await post('/jsonapi/node/student_profile', payload);
      onComplete({ profile: result.data, formData: fields });
    } catch (err) {
      setServerError(err.message || 'An error occurred. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  function field(key, label, inputProps = {}, hint = null) {
    return (
      <div className="form-group">
        <label className="form-label" htmlFor={key}>{label}</label>
        <input
          id={key}
          name={key}
          className="form-input"
          value={fields[key]}
          onChange={handleChange}
          onBlur={handleBlur}
          aria-describedby={errors[key] ? `${key}-error` : undefined}
          aria-invalid={errors[key] ? 'true' : undefined}
          {...inputProps}
        />
        {hint && <span className="form-hint">{hint}</span>}
        {errors[key] && (
          <span id={`${key}-error`} className="form-error" role="alert">{errors[key]}</span>
        )}
      </div>
    );
  }

  function radioGroup(key, label, options, required = false) {
    return (
      <div className="form-group">
        <fieldset>
          <legend className="form-label">
            {label}
            {required && <span aria-hidden="true" style={{ color: 'var(--color-danger)', marginLeft: '0.25rem' }}>*</span>}
          </legend>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginTop: '0.25rem' }}>
            {options.map((opt) => (
              <label key={opt.value} style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontWeight: 400, cursor: 'pointer' }}>
                <input
                  type="radio"
                  name={key}
                  value={opt.value}
                  checked={fields[key] === opt.value}
                  onChange={handleChange}
                />
                {opt.label}
              </label>
            ))}
          </div>
          {errors[key] && (
            <span id={`${key}-error`} className="form-error" role="alert">{errors[key]}</span>
          )}
        </fieldset>
      </div>
    );
  }

  return (
    <section aria-labelledby="student-info-heading">
      <h2 id="student-info-heading" style={{ marginBottom: '0.5rem' }}>Student Information</h2>
      <ul style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem', paddingLeft: '1.25rem' }}>
        <li>Student must be registered in the Home School Program through the Province of Manitoba.</li>
        <li>$100 Tuition Deposit required with this application.</li>
        <li>Students registered for Partial Programming are not eligible to join SCS sports teams.</li>
        <li>Registration for Home School Partial Programming does not provide direct access to Full Time enrollment at SCS.</li>
      </ul>

      <form onSubmit={handleSubmit} noValidate>
        <h3 className="form-section-title">Student&apos;s Legal Name</h3>
        <div className="form-row">
          <div className="form-row__item">
            {field('student_first_name', 'First Name', { autoComplete: 'given-name' })}
          </div>
          <div className="form-row__item">
            {field('student_middle_name', 'Middle Name(s)')}
          </div>
          <div className="form-row__item">
            {field('student_last_name', 'Last Name', { autoComplete: 'family-name' })}
          </div>
        </div>

        {field('student_preferred_name', "Student's Preferred Name (if different from legal first name)")}

        <div className="form-row form-row--spacious">
          <div className="form-row__item form-row__item--min">
            {radioGroup('student_gender', 'Gender', [{ value: 'male', label: 'Male' }, { value: 'female', label: 'Female' }], true)}
          </div>
          <div className="form-row__item form-row__item--min">
            {field('student_birth_date', 'Date of Birth', { type: 'date' })}
          </div>
        </div>

        <div className="form-row">
          <div className="form-row__item">
            {field('student_current_grade', 'Current Grade', { placeholder: 'e.g. Grade 6' })}
          </div>
          <div className="form-row__item">
            {field('student_applying_for_grade', 'Applying For Grade', { placeholder: 'e.g. Grade 7' })}
          </div>
        </div>

        {field('primary_home_phone', 'Primary / Home Phone Number', { type: 'tel', autoComplete: 'tel', placeholder: '(000) 000-0000' })}

        <h3 className="form-section-title" style={{ marginTop: '1.25rem' }}>Physical Address</h3>
        <AddressChunk
          fieldPrefix="physical_address"
          fieldNameOverrides={{
            city: 'physical_city',
            state_province: 'physical_state_province',
            postal_zip: 'physical_postal_zip',
          }}
          values={fields}
          errors={errors}
          onChange={handleChange}
          onBlur={handleBlur}
          required={true}
        />

        {radioGroup(
          'mailing_address_differs',
          'Is your Mailing Address different from your Physical Address?',
          [{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }],
          true
        )}

        {fields.mailing_address_differs === 'yes' && (
          <div style={{ marginTop: '1.5rem' }}>
            <h3 className="form-section-title">Mailing Address</h3>
            <AddressChunk
              fieldPrefix="mailing_address"
              values={fields}
              errors={errors}
              onChange={handleChange}
              onBlur={handleBlur}
              required={true}
            />
          </div>
        )}

        {radioGroup('citizenship_status', 'Citizenship Status', CITIZENSHIP_OPTIONS, true)}

        {radioGroup(
          'attended_mb_school_before',
          'Have you attended a Manitoba school in the past?',
          [{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }],
          true
        )}

        <div className="form-row">
          <div className="form-row__item">{field('church_attending', 'Church Attending')}</div>
          <div className="form-row__item">{field('denomination', 'Denomination')}</div>
        </div>

        {serverError && (
          <div className="form-alert form-alert--error" role="alert" aria-live="assertive">
            {serverError}
          </div>
        )}

        <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
          <button type="submit" className="btn btn--primary" disabled={submitting}>
            {submitting ? <><span className="spinner" aria-hidden="true" /> Saving…</> : 'Next →'}
          </button>
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

export default StudentInfoStep;
