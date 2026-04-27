import React, { useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { patchAndSubmitApplication } from '../../store/slices/applicationSlice';

/**
 * Map all accumulated form step data to Drupal field names.
 * text_long fields are wrapped in { value, format: 'plain_text' }.
 * Null / empty values are excluded from the payload.
 */
function buildAttributes(stepData) {
  const {
    studentInfo = {},
    healthInfo = {},
    parentInfo = {},
    additionalSupport = {},
    questionnaire = {},
    validation = {},
    signature = '',
  } = stepData;

  function tl(value) {
    return value ? { value, format: 'plain_text' } : undefined;
  }

  const raw = {
    // Section 1 – Student Information
    field_student_first_name: studentInfo.student_first_name,
    field_student_middle_name: studentInfo.student_middle_name,
    field_student_last_name: studentInfo.student_last_name,
    field_student_preferred_name: studentInfo.student_preferred_name,
    field_student_gender: studentInfo.student_gender,
    field_student_birth_date: studentInfo.student_birth_date,
    field_student_current_grade: studentInfo.student_current_grade,
    field_student_applying_for_grade: studentInfo.student_applying_for_grade,
    field_primary_home_phone: studentInfo.primary_home_phone,
    field_mailing_address_differs: studentInfo.mailing_address_differs,
    field_citizenship_status: studentInfo.citizenship_status,
    field_attended_mb_school_before: studentInfo.attended_mb_school_before,
    field_church_attending: studentInfo.church_attending,
    field_denomination: studentInfo.denomination,

    // Section 2 – Health Information
    field_mb_health_number_9_digit: healthInfo.mb_health_number_9_digit,
    field_mb_health_number_6_digit: healthInfo.mb_health_number_6_digit,
    field_emergency_contact_name: healthInfo.emergency_contact_name,
    field_emergency_contact_phone: healthInfo.emergency_contact_phone,
    field_allergies: tl(healthInfo.allergies),
    field_medications_used_fr_2b9881: tl(healthInfo.medications_used_frequently),
    field_medical_restrictions: tl(healthInfo.medical_restrictions),

    // Section 3 – Parent / Guardian Information
    field_father_surname: parentInfo.father_surname,
    field_father_given_name: parentInfo.father_given_name,
    field_father_address_same_a45c44: parentInfo.father_address_same_as_student,
    field_father_workplace: parentInfo.father_workplace,
    field_father_work_number: parentInfo.father_work_number,
    field_father_cell_number: parentInfo.father_cell_number,
    field_father_email: parentInfo.father_email,
    field_mother_surname: parentInfo.mother_surname,
    field_mother_given_name: parentInfo.mother_given_name,
    field_mother_address_same_afa04c: parentInfo.mother_address_same_as_student,
    field_mother_workplace: parentInfo.mother_workplace,
    field_mother_work_number: parentInfo.mother_work_number,
    field_mother_cell_number: parentInfo.mother_cell_number,
    field_mother_email: parentInfo.mother_email,
    field_parents_relationshi_456f4f: parentInfo.parents_relationship_status,
    field_student_lives_with: parentInfo.student_lives_with,
    field_custody_description: parentInfo.custody_description,

    // Section 4 – Additional Support Declaration
    field_academic_support_details: tl(additionalSupport.academic_support_details),
    field_diagnosis_assessmen_18b9ab: tl(additionalSupport.diagnosis_assessments_details),
    field_psychological_suppo_e92629: tl(additionalSupport.psychological_support_details),

    // Section 5 – Parent Questionnaire
    field_parent_name: questionnaire.parent_name,
    field_christian_testimony: tl(questionnaire.christian_testimony),
    field_school_interest_reason: tl(questionnaire.school_interest_reason),

    // Persist validated/reviewed state for all pages
    field_section_1_reviewed: validation.section_1_reviewed ? 'yes' : undefined,
    field_section_2_reviewed: validation.section_2_reviewed ? 'yes' : undefined,
    field_section_3_reviewed: validation.section_3_reviewed ? 'yes' : undefined,
    field_section_4_reviewed: validation.section_4_reviewed ? 'yes' : undefined,
    field_section_5_reviewed: validation.section_5_reviewed ? 'yes' : undefined,
    field_section_6_reviewed: 'yes',
    field_support_declaration_265eb8: additionalSupport.support_declaration_reviewed ? 'yes' : undefined,

    // Section 6 – Commitment signature (stored as data URL in text_long)
    field_parent_guardian_signature: tl(signature),
  };

  // Strip undefined / empty string values so we don't send empty fields to Drupal
  return Object.fromEntries(Object.entries(raw).filter(([, v]) => v !== undefined && v !== '' && v !== null));
}

function CommitmentStep({ allStepData, incompleteSections = [], onBack }) {
  const dispatch = useDispatch();
  const { currentApplication, status, error } = useSelector((s) => s.application);

  const canvasRef = useRef(null);
  const isDrawingRef = useRef(false);
  const lastPointRef = useRef({ x: 0, y: 0 });
  const [hasSignature, setHasSignature] = useState(false);
  const [signatureError, setSignatureError] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [showIncompleteModal, setShowIncompleteModal] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, []);

  function getPos(e, canvas) {
    const rect = canvas.getBoundingClientRect();
    if (e.touches) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      };
    }
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function startDraw(e) {
    e.preventDefault();
    isDrawingRef.current = true;
    const pos = getPos(e, canvasRef.current);
    lastPointRef.current = pos;
    setHasSignature(true);
    setSignatureError(null);
  }

  function draw(e) {
    e.preventDefault();
    if (!isDrawingRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const pos = getPos(e, canvas);
    ctx.beginPath();
    ctx.moveTo(lastPointRef.current.x, lastPointRef.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    lastPointRef.current = pos;
  }

  function endDraw(e) {
    if (e) e.preventDefault();
    isDrawingRef.current = false;
  }

  function clearSignature() {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  }

  async function handleSubmit() {
    if (incompleteSections.length > 0) {
      setShowIncompleteModal(true);
      return;
    }

    if (!hasSignature) {
      setSignatureError('A signature is required to submit.');
      return;
    }
    if (!currentApplication?.id) return;

    const signature = canvasRef.current.toDataURL('image/png');
    const attributes = buildAttributes({ ...allStepData, signature });

    const result = await dispatch(patchAndSubmitApplication({ applicationId: currentApplication.id, attributes }));
    if (patchAndSubmitApplication.fulfilled.match(result)) {
      setSubmitted(true);
    }
  }

  if (submitted) {
    return (
      <section aria-labelledby="commitment-heading" style={{ textAlign: 'center', padding: '2rem 0' }}>
        <span style={{ fontSize: '3rem', display: 'block', marginBottom: '1rem' }} aria-hidden="true">🎉</span>
        <h2 id="commitment-heading" style={{ marginBottom: '0.5rem' }}>Application Submitted!</h2>
        <p style={{ color: 'var(--color-text-muted)' }}>
          Your application has been submitted successfully. We will be in touch.
        </p>
      </section>
    );
  }

  return (
    <>
      {showIncompleteModal && (
        <div className="modal-backdrop" role="presentation">
          <div
            className="modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="incomplete-sections-title"
            aria-describedby="incomplete-sections-description"
          >
            <h3 id="incomplete-sections-title" className="modal-card__title">Finish Required Sections</h3>
            <p id="incomplete-sections-description" className="modal-card__body">
              Please complete the following sections before submitting your application.
            </p>
            <ul className="modal-card__list">
              {incompleteSections.map((section) => (
                <li key={section}>{section}</li>
              ))}
            </ul>
            <div className="modal-card__actions">
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => setShowIncompleteModal(false)}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      <section aria-labelledby="commitment-heading">
        <h2 id="commitment-heading" style={{ marginBottom: '1rem' }}>Statement of Commitment</h2>
        <hr style={{ borderColor: 'var(--color-border)', marginBottom: '1.25rem' }} />

        <p style={{ fontWeight: 600, marginBottom: '0.75rem' }}>
          By completing this application form, we/I understand, accept and will abide by:
        </p>
        <ul style={{ paddingLeft: '1.25rem', marginBottom: '1.75rem', lineHeight: 1.75 }}>
          <li>The guidelines in the School Information Handbook* which we have received and read.</li>
          <li>The right of the SCS Administration to discipline our child in accordance with the School Information Handbook*</li>
          <li>The SCS Statement of Purpose and What We Believe statement both found in the School Information Handbook* which we have received and read.</li>
          <li>The tuition for the applicable school year and we will pay all fees on a regular basis.</li>
        </ul>

        <div className="form-group">
          <label className="form-label" htmlFor="signature-canvas">
            Parent/Guardian Signature (Statement of Commitment)
          </label>
          <div
            style={{
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius)',
              overflow: 'hidden',
              background: '#fff',
              display: 'inline-block',
              width: '100%',
            }}
          >
            <canvas
              id="signature-canvas"
              ref={canvasRef}
              width={500}
              height={150}
              style={{ display: 'block', width: '100%', cursor: 'crosshair', touchAction: 'none' }}
              onMouseDown={startDraw}
              onMouseMove={draw}
              onMouseUp={endDraw}
              onMouseLeave={endDraw}
              onTouchStart={startDraw}
              onTouchMove={draw}
              onTouchEnd={endDraw}
              aria-label="Signature pad — draw your signature here"
              role="img"
            />
            <div style={{ textAlign: 'right', padding: '0.25rem 0.75rem', borderTop: '1px solid var(--color-border)' }}>
              <button
                type="button"
                onClick={clearSignature}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', fontSize: '0.875rem', padding: '0.125rem 0' }}
              >
                Clear
              </button>
            </div>
          </div>
          {signatureError && (
            <span className="form-error" role="alert">{signatureError}</span>
          )}
        </div>

        {error && (
          <div className="form-alert form-alert--error" role="alert" aria-live="assertive">
            {error}
          </div>
        )}

        <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'space-between' }}>
          <button type="button" className="btn" onClick={onBack} disabled={status === 'loading'}>
            ← Back
          </button>
          <button
            type="button"
            className="btn btn--primary"
            style={{ background: 'var(--color-success)', borderColor: 'var(--color-success)' }}
            onClick={handleSubmit}
            disabled={status === 'loading'}
          >
            {status === 'loading' ? (
              <><span className="spinner" aria-hidden="true" /> Submitting…</>
            ) : (
              'Submit Application'
            )}
          </button>
        </div>
      </section>
    </>
  );
}

export default CommitmentStep;
