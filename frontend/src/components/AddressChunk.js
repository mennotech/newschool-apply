import React from 'react';
import PropTypes from 'prop-types';

/**
 * AddressChunk
 * A reusable address input component that handles a complete address block.
 * 
 * Props:
 * - title: Display title for the address section (e.g., "Physical Address", "Mailing Address")
 * - fieldPrefix: Prefix for field names (e.g., "physical_address", "mailing_address")
 * - values: Object containing address field values
 * - errors: Object containing validation errors
 * - onChange: Callback when any field changes
 * - onBlur: Callback when any field loses focus
 * - required: Whether address fields are required (default: true)
 */
function AddressChunk({
  title,
  fieldPrefix,
  fieldNameOverrides = {},
  values = {},
  errors = {},
  onChange,
  onBlur,
  required = true,
}) {
  function getFieldName(fieldKey) {
    return fieldNameOverrides[fieldKey] || `${fieldPrefix}_${fieldKey}`;
  }

  // Extract address values with fallback defaults
  const address = {
    line_1: values[getFieldName('line_1')] || '',
    line_2: values[getFieldName('line_2')] || '',
    city: values[getFieldName('city')] || '',
    state_province: values[getFieldName('state_province')] || '',
    postal_zip: values[getFieldName('postal_zip')] || '',
  };

  function handleChange(e) {
    if (onChange) {
      onChange(e);
    }
  }

  function handleBlur(e) {
    if (onBlur) {
      onBlur(e);
    }
  }

  function textField(fieldKey, label, inputProps = {}) {
    const fieldName = getFieldName(fieldKey);
    const error = errors[fieldName];
    const value = address[fieldKey];

    return (
      <div className="form-group">
        <label className="form-label" htmlFor={fieldName}>
          {label}
          {required && fieldKey !== 'line_2' && (
            <span aria-hidden="true" style={{ color: 'var(--color-danger)', marginLeft: '0.25rem' }}>
              *
            </span>
          )}
        </label>
        <input
          id={fieldName}
          name={fieldName}
          type="text"
          className={`form-input${error ? ' form-input--error' : ''}`}
          value={value}
          onChange={handleChange}
          onBlur={handleBlur}
          {...inputProps}
        />
        {error && (
          <span id={`${fieldName}-error`} className="form-error" role="alert">
            {error}
          </span>
        )}
      </div>
    );
  }

  return (
    <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
      {title && (
        <legend style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '1rem' }}>
          {title}
        </legend>
      )}
      
      <div style={{ display: 'grid', gap: '1rem' }}>
        {textField('line_1', 'Street Address')}
        {textField('line_2', 'Apartment, suite, etc. (optional)')}
        
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem' }}>
          {textField('city', 'City')}
          {textField('state_province', 'Province / State', { maxLength: 2, placeholder: 'e.g., MB' })}
        </div>
        
        {textField('postal_zip', 'Postal / Zip Code')}
      </div>
    </fieldset>
  );
}

AddressChunk.propTypes = {
  title: PropTypes.string,
  fieldPrefix: PropTypes.string.isRequired,
  fieldNameOverrides: PropTypes.object,
  values: PropTypes.object,
  errors: PropTypes.object,
  onChange: PropTypes.func,
  onBlur: PropTypes.func,
  required: PropTypes.bool,
};

export default AddressChunk;
