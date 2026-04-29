import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { setCurrentApplication } from '../../store/slices/applicationSlice';
import * as drupalClient from '../../api/drupalClient';
import AlertBanner from '../../components/AlertBanner';

const REQUIRED_FIELDS = [
  { step: 'student-info', label: 'Student Information', field: 'field_student_first_name' },
  { step: 'student-info', label: 'Student Information', field: 'field_student_last_name' },
  { step: 'student-info', label: 'Student Information', field: 'field_student_gender' },
  { step: 'student-info', label: 'Student Information', field: 'field_student_birth_date' },
  { step: 'student-info', label: 'Student Information', field: 'field_student_current_grade' },
  { step: 'student-info', label: 'Student Information', field: 'field_student_applying_for_grade' },
  { step: 'student-info', label: 'Student Information', field: 'field_primary_home_phone' },
  { step: 'student-info', label: 'Student Information', field: 'field_citizenship_status' },
  { step: 'student-info', label: 'Student Information', field: 'field_attended_mb_school_before' },
  { step: 'student-info', label: 'Student Information', field: 'field_mailing_address_differs' },
  { step: 'health-info', label: 'Health Information', field: 'field_mb_health_number_9_digit' },
  { step: 'health-info', label: 'Health Information', field: 'field_mb_health_number_6_digit' },
  { step: 'guardian-info', label: 'Guardian Information', field: 'field_student_lives_with' },
  { step: 'guardian-info', label: 'Guardian Information', field: 'field_household_relations_e12444' },
  { step: 'guardian-info', label: 'Guardian Information', field: 'field_custody_description' },
  { step: 'additional-support', label: 'Additional Support Declaration', field: 'field_support_declaration_265eb8' },
  { step: 'questionnaire', label: 'Parent Questionnaire', field: 'field_christian_testimony' },
  { step: 'questionnaire', label: 'Parent Questionnaire', field: 'field_school_interest_reason' },
];

function CommitmentStep() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const currentApplication = useSelector((s) => s.application.currentApplication);
  const attrs = useMemo(() => currentApplication?.attributes || {}, [currentApplication]);

  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSigned, setHasSigned] = useState(false);
  const [signatureError, setSignatureError] = useState('');
  const [incompleteSections, setIncompleteSections] = useState([]);
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  // Canvas setup runs once on mount; signature data is restored from saved attrs only at initial load
  const savedSignature = attrs.field_parent_guardian_signature;
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = canvas.offsetWidth;
    canvas.height = 200;
    const ctx = canvas.getContext('2d');
    ctx.strokeStyle = '#1a1a2e';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';

    if (savedSignature) {
      const img = new window.Image();
      img.onload = () => ctx.drawImage(img, 0, 0);
      img.src = savedSignature;
      setHasSigned(true);
    }
  }, [savedSignature]); // eslint-disable-line react-hooks/exhaustive-deps

  function getPos(e) {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    if (e.touches) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      };
    }
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function startDrawing(e) {
    e.preventDefault();
    setIsDrawing(true);
    const ctx = canvasRef.current.getContext('2d');
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  }

  function draw(e) {
    if (!isDrawing) return;
    e.preventDefault();
    const ctx = canvasRef.current.getContext('2d');
    const pos = getPos(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    setHasSigned(true);
    setSignatureError('');
  }

  function stopDrawing() {
    setIsDrawing(false);
  }

  function clearSignature() {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSigned(false);
  }

  const checkIncompleteSections = useCallback(() => {
    return REQUIRED_FIELDS.filter((f) => {
      const val = attrs[f.field];
      return !val || val === false || val === '';
    }).map((f) => f.label);
  }, [attrs]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!hasSigned) {
      setSignatureError('A signature is required before submitting');
      return;
    }

    const missing = checkIncompleteSections();
    if (missing.length > 0) {
      setIncompleteSections(missing);
      setShowWarningModal(true);
      return;
    }

    await submitApplication();
  }

  async function submitApplication() {
    setSaving(true);
    setSaveError('');
    try {
      const signatureData = canvasRef.current.toDataURL('image/png');
      const appId = currentApplication?.id;
      const payload = {
        data: {
          type: 'node--application_partial_programming',
          id: appId,
          attributes: {
            field_parent_guardian_signature: signatureData,
            field_application_status: 'submitted',
            field_submitted_at: new Date().toISOString(),
          },
        },
      };
      const updated = await drupalClient.patch(`/jsonapi/node/application_partial_programming/${appId}`, payload);
      dispatch(setCurrentApplication(updated.data));
      setSubmitted(true);
    } catch (err) {
      setSaveError(err.message || 'Submission failed. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  if (submitted) {
    return (
      <div className="step-content" style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '4rem', marginBottom: '1rem' }} aria-hidden="true">🎉</div>
        <h1>Application Submitted!</h1>
        <p>
          Thank you for submitting your application to NewSchool. We will review your application
          and be in touch regarding next steps.
        </p>
        <button
          className="btn btn-primary btn-lg"
          onClick={() => navigate('/dashboard')}
        >
          Return to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="step-content">
      <h1 className="step-title">Commitment</h1>
      <p className="step-description">
        Please read the statement below and sign to confirm your commitment.
      </p>

      {saveError && <AlertBanner type="error" message={saveError} />}

      <div className="commitment-text">
        <p>
          <strong>Statement of Commitment</strong>
        </p>
        <p>
          We, the parent(s)/guardian(s), commit to supporting NewSchool's Christian educational
          philosophy and community standards. We understand that NewSchool is a faith-based
          educational institution and agree to actively support the school's mission, values, and
          expectations as outlined in the school handbook.
        </p>
        <p>
          We agree to participate constructively in the school community, communicate openly with
          staff, and ensure our student attends regularly and arrives prepared to learn.
        </p>
        <p>
          We affirm that all information provided in this application is accurate and complete to
          the best of our knowledge.
        </p>
      </div>

      <form onSubmit={handleSubmit} noValidate>
        <div className="form-group">
          <label htmlFor="sig-canvas" style={{ marginBottom: '0.5rem' }}>
            Signature<span className="required-mark" aria-hidden="true">*</span>
          </label>
          <div
            className="signature-pad-container"
            aria-invalid={signatureError ? 'true' : 'false'}
            aria-describedby={signatureError ? 'sig-error' : undefined}
          >
            <canvas
              id="sig-canvas"
              ref={canvasRef}
              style={{ width: '100%', cursor: 'crosshair' }}
              aria-label="Signature pad — draw your signature here"
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
            />
          </div>
          {signatureError && (
            <span id="sig-error" className="field-error" role="alert">
              {signatureError}
            </span>
          )}
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={clearSignature}
            style={{ marginTop: '0.5rem' }}
          >
            Clear Signature
          </button>
        </div>

        <div className="form-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => navigate('/apply/questionnaire')}
          >
            ← Back
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={saving}
          >
            {saving ? 'Submitting…' : 'Submit Application'}
          </button>
        </div>
      </form>

      {/* Incomplete sections warning modal */}
      {showWarningModal && (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="warning-modal-title">
          <div className="modal">
            <h2 className="modal-title" id="warning-modal-title">Incomplete Sections</h2>
            <div className="modal-body">
              <p>The following required sections are incomplete:</p>
              <ul style={{ listStyle: 'disc', paddingLeft: '1.5rem', marginTop: '0.5rem' }}>
                {incompleteSections.map((s) => (
                  <li key={s} style={{ color: 'var(--color-danger)', marginBottom: '0.25rem' }}>{s}</li>
                ))}
              </ul>
              <p style={{ marginTop: '1rem' }}>
                Please complete all required sections before submitting.
              </p>
            </div>
            <div className="modal-actions">
              <button
                className="btn btn-primary"
                onClick={() => setShowWarningModal(false)}
              >
                Go Back and Complete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CommitmentStep;
