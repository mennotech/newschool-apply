import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { setCurrentApplication } from '../../store/slices/applicationSlice';
import * as drupalClient from '../../api/drupalClient';
import AlertBanner from '../../components/AlertBanner';

function QuestionnaireStep() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const currentApplication = useSelector((s) => s.application.currentApplication);
  const attrs = currentApplication?.attributes || {};

  const [form, setForm] = useState({
    parentName: attrs.field_parent_name || '',
    christianTestimony: attrs.field_parent_testimony || '',
    reasonForInterest: attrs.field_reason_for_interest || '',
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
    if (!form.parentName.trim()) errs.parentName = 'Parent name is required';
    if (!form.christianTestimony.trim()) errs.christianTestimony = 'Christian testimony is required';
    if (!form.reasonForInterest.trim()) errs.reasonForInterest = 'Reason for interest is required';
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
            field_parent_name: form.parentName,
            field_parent_testimony: form.christianTestimony,
            field_reason_for_interest: form.reasonForInterest,
          },
        },
      };
      const updated = await drupalClient.patch(`/jsonapi/node/application/${appId}`, payload);
      dispatch(setCurrentApplication(updated.data));
      navigate('/apply/commitment');
    } catch (err) {
      setSaveError(err.message || 'Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  const hasErrors = Object.values(errors).some(Boolean);

  return (
    <div className="step-content">
      <h1 className="step-title">Parent Questionnaire</h1>
      <p className="step-description">
        Please share your faith background and reason for interest in NewSchool.
      </p>

      {saveError && <AlertBanner type="error" message={saveError} />}

      <form onSubmit={handleNext} noValidate>
        <div className="form-group">
          <label htmlFor="q-parentName">
            Parent / Guardian Name<span className="required-mark" aria-hidden="true">*</span>
          </label>
          <input
            id="q-parentName"
            type="text"
            value={form.parentName}
            onChange={(e) => handleChange('parentName', e.target.value)}
            aria-required="true"
            aria-invalid={errors.parentName ? 'true' : 'false'}
            aria-describedby={errors.parentName ? 'q-parentName-err' : undefined}
          />
          {errors.parentName && <span id="q-parentName-err" className="field-error" role="alert">{errors.parentName}</span>}
        </div>

        <div className="form-group">
          <label htmlFor="q-testimony">
            Christian Testimony<span className="required-mark" aria-hidden="true">*</span>
          </label>
          <textarea
            id="q-testimony"
            value={form.christianTestimony}
            onChange={(e) => handleChange('christianTestimony', e.target.value)}
            aria-required="true"
            aria-invalid={errors.christianTestimony ? 'true' : 'false'}
            aria-describedby={errors.christianTestimony ? 'q-testimony-err' : undefined}
            placeholder="Please share your personal faith journey and how faith is practised in your home…"
            style={{ minHeight: '150px' }}
          />
          {errors.christianTestimony && <span id="q-testimony-err" className="field-error" role="alert">{errors.christianTestimony}</span>}
        </div>

        <div className="form-group">
          <label htmlFor="q-reasonForInterest">
            Reason for Interest in NewSchool<span className="required-mark" aria-hidden="true">*</span>
          </label>
          <textarea
            id="q-reasonForInterest"
            value={form.reasonForInterest}
            onChange={(e) => handleChange('reasonForInterest', e.target.value)}
            aria-required="true"
            aria-invalid={errors.reasonForInterest ? 'true' : 'false'}
            aria-describedby={errors.reasonForInterest ? 'q-reasonForInterest-err' : undefined}
            placeholder="Why are you interested in enrolling your student at NewSchool?…"
            style={{ minHeight: '150px' }}
          />
          {errors.reasonForInterest && <span id="q-reasonForInterest-err" className="field-error" role="alert">{errors.reasonForInterest}</span>}
        </div>

        <div className="form-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => navigate('/apply/additional-support')}
          >
            ← Back
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={saving}
          >
            {saving ? 'Saving…' : 'Next: Commitment →'}
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

export default QuestionnaireStep;
