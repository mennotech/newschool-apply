import React, { useState } from 'react';
import { post } from '../../api/drupalClient';

function StudentInfoStep({ onComplete }) {
  const [fields, setFields] = useState({
    firstName: '',
    lastName: '',
    dateOfBirth: '',
    gradeApplyingFor: '',
  });
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  function validate() {
    const errs = {};
    if (!fields.firstName.trim()) errs.firstName = 'First name is required.';
    if (!fields.lastName.trim()) errs.lastName = 'Last name is required.';
    if (!fields.dateOfBirth) errs.dateOfBirth = 'Date of birth is required.';
    if (!fields.gradeApplyingFor.trim()) errs.gradeApplyingFor = 'Grade is required.';
    return errs;
  }

  function handleChange(e) {
    setFields({ ...fields, [e.target.name]: e.target.value });
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
      const payload = {
        data: {
          type: 'node--student_profile',
          attributes: {
            title: `${fields.firstName} ${fields.lastName}`,
            field_first_name: fields.firstName,
            field_last_name: fields.lastName,
            field_date_of_birth: fields.dateOfBirth,
            field_grade_applying_for: fields.gradeApplyingFor,
          },
        },
      };
      const result = await post('/jsonapi/node/student_profile', payload);
      onComplete(result.data);
    } catch (err) {
      setServerError(err.message || 'An error occurred. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section aria-labelledby="student-info-heading">
      <h2 id="student-info-heading">Student Information</h2>

      <form onSubmit={handleSubmit} noValidate>
        <div>
          <label htmlFor="firstName">First name</label>
          <input
            id="firstName"
            name="firstName"
            type="text"
            value={fields.firstName}
            onChange={handleChange}
            aria-describedby={errors.firstName ? 'firstName-error' : undefined}
            aria-invalid={errors.firstName ? 'true' : undefined}
            autoComplete="given-name"
          />
          {errors.firstName && (
            <span id="firstName-error" role="alert">
              {errors.firstName}
            </span>
          )}
        </div>

        <div>
          <label htmlFor="lastName">Last name</label>
          <input
            id="lastName"
            name="lastName"
            type="text"
            value={fields.lastName}
            onChange={handleChange}
            aria-describedby={errors.lastName ? 'lastName-error' : undefined}
            aria-invalid={errors.lastName ? 'true' : undefined}
            autoComplete="family-name"
          />
          {errors.lastName && (
            <span id="lastName-error" role="alert">
              {errors.lastName}
            </span>
          )}
        </div>

        <div>
          <label htmlFor="dateOfBirth">Date of birth</label>
          <input
            id="dateOfBirth"
            name="dateOfBirth"
            type="date"
            value={fields.dateOfBirth}
            onChange={handleChange}
            aria-describedby={errors.dateOfBirth ? 'dateOfBirth-error' : undefined}
            aria-invalid={errors.dateOfBirth ? 'true' : undefined}
          />
          {errors.dateOfBirth && (
            <span id="dateOfBirth-error" role="alert">
              {errors.dateOfBirth}
            </span>
          )}
        </div>

        <div>
          <label htmlFor="gradeApplyingFor">Grade applying for</label>
          <input
            id="gradeApplyingFor"
            name="gradeApplyingFor"
            type="text"
            value={fields.gradeApplyingFor}
            onChange={handleChange}
            aria-describedby={errors.gradeApplyingFor ? 'gradeApplyingFor-error' : undefined}
            aria-invalid={errors.gradeApplyingFor ? 'true' : undefined}
          />
          {errors.gradeApplyingFor && (
            <span id="gradeApplyingFor-error" role="alert">
              {errors.gradeApplyingFor}
            </span>
          )}
        </div>

        {serverError && (
          <p role="alert" aria-live="assertive">
            {serverError}
          </p>
        )}

        <button type="submit" disabled={submitting}>
          {submitting ? 'Saving…' : 'Next'}
        </button>
      </form>
    </section>
  );
}

export default StudentInfoStep;
