import React, { useState } from 'react';
import AddressChunk from '../AddressChunk';

const RELATIONSHIP_OPTIONS = [
  { value: 'married', label: 'Married' },
  { value: 'divorced', label: 'Divorced' },
  { value: 'separated', label: 'Separated' },
  { value: 'other', label: 'Other' },
];

const LIVES_WITH_OPTIONS = [
  { value: 'both_parents', label: 'Both Parents' },
  { value: 'mother', label: 'Mother' },
  { value: 'father', label: 'Father' },
  { value: 'shared_custody', label: 'Shared Custody' },
  { value: 'other', label: 'Other' },
];

const CUSTODY_OPTIONS = [
  { value: 'joint', label: 'Joint' },
  { value: 'mother', label: 'Mother' },
  { value: 'father', label: 'Father' },
  { value: 'other', label: 'Other' },
];

const INITIAL_FIELDS = {
  father_surname: '',
  father_given_name: '',
  father_address_same_as_student: '',
  father_address_line_1: '',
  father_address_line_2: '',
  father_address_city: '',
  father_address_state_province: '',
  father_address_postal_zip: '',
  father_workplace: '',
  father_work_number: '',
  father_cell_number: '',
  father_email: '',
  mother_surname: '',
  mother_given_name: '',
  mother_address_same_as_student: '',
  mother_address_line_1: '',
  mother_address_line_2: '',
  mother_address_city: '',
  mother_address_state_province: '',
  mother_address_postal_zip: '',
  mother_workplace: '',
  mother_work_number: '',
  mother_cell_number: '',
  mother_email: '',
  parents_relationship_status: '',
  student_lives_with: '',
  custody_description: '',
};

function ParentInfoStep({ onComplete, onBack, initialData = {}, onFieldBlur }) {
  const [fields, setFields] = useState(() => ({ ...INITIAL_FIELDS, ...initialData }));
  const [errors, setErrors] = useState({});

  function handleChange(e) {
    setFields((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    if (e.target.type === 'radio' || e.target.tagName === 'SELECT') {
      onFieldBlur && onFieldBlur(e.target.name, e.target.value);
    }
  }

  function handleBlur(e) {
    onFieldBlur && onFieldBlur(e.target.name, e.target.value);
  }

  function validate() {
    const errs = {};
    if (!fields.parents_relationship_status) errs.parents_relationship_status = 'Please select a relationship status.';
    if (!fields.student_lives_with) errs.student_lives_with = 'Please indicate who the student lives with.';
    if (!fields.custody_description) errs.custody_description = 'Please select a custody description.';
    return errs;
  }

  function handleSubmit(e) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    setErrors({});
    onComplete(fields);
  }

  function textField(key, label, inputProps = {}) {
    return (
      <div className="form-group">
        <label className="form-label" htmlFor={key}>{label}</label>
        <input
          id={key}
          name={key}
          type="text"
          className="form-input"
          value={fields[key]}
          onChange={handleChange}
          onBlur={handleBlur}
          {...inputProps}
        />
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

  function addressSameGroup(key, label) {
    return (
      <div className="form-group">
        <fieldset>
          <legend className="form-label">{label}</legend>
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.25rem' }}>
            {[{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }].map((opt) => (
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
        </fieldset>
      </div>
    );
  }

  return (
    <section aria-labelledby="parent-info-heading">
      <h2 id="parent-info-heading" style={{ marginBottom: '1.5rem' }}>Parent / Guardian Information</h2>

      <form onSubmit={handleSubmit} noValidate>
        <h3 className="form-section-title">Father</h3>
        <div className="form-row">
          <div className="form-row__item">{textField('father_surname', "Father's Surname")}</div>
          <div className="form-row__item">{textField('father_given_name', "Father's Given Name")}</div>
        </div>
        {addressSameGroup('father_address_same_as_student', "Father's Address Same as Student")}
        
        {fields.father_address_same_as_student === 'no' && (
          <div style={{ marginTop: '1rem' }}>
            <AddressChunk
              title="Father's Address"
              fieldPrefix="father_address"
              values={fields}
              errors={errors}
              onChange={handleChange}
              onBlur={handleBlur}
              required={false}
            />
          </div>
        )}
        
        <div className="form-row">
          <div className="form-row__item">{textField('father_workplace', "Father's Workplace")}</div>
          <div className="form-row__item">{textField('father_work_number', "Father's Work Number", { type: 'tel', placeholder: '(000) 000-0000' })}</div>
        </div>
        <div className="form-row">
          <div className="form-row__item">{textField('father_cell_number', "Father's Cell Number", { type: 'tel', placeholder: '(000) 000-0000' })}</div>
          <div className="form-row__item">{textField('father_email', "Father's Email", { type: 'email' })}</div>
        </div>

        <h3 className="form-section-title" style={{ marginTop: '1.25rem' }}>Mother</h3>
        <div className="form-row">
          <div className="form-row__item">{textField('mother_surname', "Mother's Surname")}</div>
          <div className="form-row__item">{textField('mother_given_name', "Mother's Given Name")}</div>
        </div>
        {addressSameGroup('mother_address_same_as_student', "Mother's Address Same as Student")}
        
        {fields.mother_address_same_as_student === 'no' && (
          <div style={{ marginTop: '1rem' }}>
            <AddressChunk
              title="Mother's Address"
              fieldPrefix="mother_address"
              values={fields}
              errors={errors}
              onChange={handleChange}
              onBlur={handleBlur}
              required={false}
            />
          </div>
        )}
        
        <div className="form-row">
          <div className="form-row__item">{textField('mother_workplace', "Mother's Workplace")}</div>
          <div className="form-row__item">{textField('mother_work_number', "Mother's Work Number", { type: 'tel', placeholder: '(000) 000-0000' })}</div>
        </div>
        <div className="form-row">
          <div className="form-row__item">{textField('mother_cell_number', "Mother's Cell Number", { type: 'tel', placeholder: '(000) 000-0000' })}</div>
          <div className="form-row__item">{textField('mother_email', "Mother's Email", { type: 'email' })}</div>
        </div>

        {radioGroup('parents_relationship_status', "Student's Parents Are", RELATIONSHIP_OPTIONS, true)}
        {radioGroup('student_lives_with', 'Student Lives With', LIVES_WITH_OPTIONS, true)}
        {radioGroup('custody_description', 'Custody Description', CUSTODY_OPTIONS, true)}

        <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'space-between' }}>
          <button type="button" className="btn" onClick={onBack}>← Back</button>
          <button type="submit" className="btn btn--primary">Next →</button>
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

export default ParentInfoStep;
