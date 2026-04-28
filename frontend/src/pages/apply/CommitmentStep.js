import React, { useRef, useState, useEffect } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { updateApplication } from '../../store/slices/applicationSlice';

const REQUIRED_STEPS = ['student-info', 'health-info', 'guardian-info', 'additional-support', 'questionnaire'];

function CommitmentStep() {
  const { application, completedSteps, markStepComplete, goToPrevStep } = useOutletContext();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSigned, setHasSigned] = useState(false);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [apiError, setApiError] = useState(null);
  const [showIncompleteWarning, setShowIncompleteWarning] = useState(false);
  const [incompleteSections, setIncompleteSections] = useState([]);

  const STEP_LABELS = {
    'student-info': 'Student Information',
    'health-info': 'Health Information',
    'guardian-info': 'Guardian Information',
    'additional-support': 'Additional Support',
    'questionnaire': 'Questionnaire',
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.strokeStyle = '#1f2937';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
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
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const { x, y } = getPos(e, canvas);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
    e.preventDefault();
  }

  function draw(e) {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const { x, y } = getPos(e, canvas);
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasSigned(true);
    e.preventDefault();
  }

  function endDraw() {
    setIsDrawing(false);
  }

  function clearSignature() {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSigned(false);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const missing = REQUIRED_STEPS.filter((s) => !completedSteps.includes(s));
    if (missing.length > 0) {
      setIncompleteSections(missing);
      setShowIncompleteWarning(true);
      return;
    }

    if (!hasSigned) {
      setErrors({ signature: 'A signature is required to submit.' });
      return;
    }

    setSaving(true);
    setApiError(null);
    setErrors({});

    const canvas = canvasRef.current;
    const signatureData = canvas.toDataURL('image/png');

    try {
      const result = await dispatch(updateApplication({
        id: application.id,
        attributes: {
          field_parent_guardian_signature: signatureData,
          field_application_status: 'submitted',
          field_submitted_at: new Date().toISOString(),
          field_section_6_reviewed: 'yes',
        },
      }));
      if (updateApplication.fulfilled.match(result)) {
        markStepComplete('commitment');
        navigate('/apply/review');
      } else {
        setApiError('Failed to submit. Please try again.');
      }
    } catch (err) {
      setApiError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Step 6: Statement of Commitment</h2>
        </div>

        {apiError && <div className="alert alert-error" role="alert">{apiError}</div>}

        <div className="form-section">
          <h3 className="form-section-title">Statement of Commitment</h3>
          <div style={{
            background: 'var(--color-bg)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius)',
            padding: '1rem',
            marginBottom: '1.5rem',
            fontSize: '0.9rem',
            lineHeight: 1.6,
          }}>
            <p>I/We hereby apply for enrollment of my/our child at NewSchool. I/We acknowledge that:</p>
            <ul>
              <li>All information provided in this application is accurate and complete.</li>
              <li>NewSchool operates as a Christian school and I/We support its values and mission.</li>
              <li>I/We understand and agree to abide by the school's policies and expectations.</li>
              <li>Acceptance of this application does not guarantee enrollment.</li>
            </ul>
            <p style={{ marginBottom: 0 }}>
              By signing below, I/We confirm that I/We have read and agree to the above statement.
            </p>
          </div>

          <div className="form-group">
            <label>
              Signature <span className="required" aria-hidden="true">*</span>
            </label>
            <p className="form-hint">Sign in the box below using your mouse or finger.</p>
            <div
              className="signature-pad-container"
              style={{ touchAction: 'none' }}
              aria-label="Signature pad"
            >
              <canvas
                ref={canvasRef}
                width={480}
                height={160}
                style={{ display: 'block', cursor: 'crosshair', maxWidth: '100%' }}
                onMouseDown={startDraw}
                onMouseMove={draw}
                onMouseUp={endDraw}
                onMouseLeave={endDraw}
                onTouchStart={startDraw}
                onTouchMove={draw}
                onTouchEnd={endDraw}
                aria-label="Signature canvas"
              />
            </div>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              style={{ marginTop: '0.5rem' }}
              onClick={clearSignature}
            >
              Clear Signature
            </button>
            {errors.signature && (
              <span className="field-error" role="alert" style={{ display: 'block', marginTop: '0.5rem' }}>
                {errors.signature}
              </span>
            )}
          </div>
        </div>

        <div className="step-nav">
          <button type="button" className="btn btn-ghost" onClick={() => goToPrevStep('commitment')}>Back</button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? <><span className="loading-spinner" aria-hidden="true" /> Submitting…</> : 'Submit Application'}
          </button>
        </div>
      </div>

      {showIncompleteWarning && (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="incomplete-modal-title">
          <div className="modal">
            <h2 className="modal-title" id="incomplete-modal-title">Incomplete Sections</h2>
            <p>The following required sections must be completed before submitting:</p>
            <ul>
              {incompleteSections.map((s) => (
                <li key={s}>{STEP_LABELS[s] || s}</li>
              ))}
            </ul>
            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setShowIncompleteWarning(false)}
              >
                Go Back and Complete
              </button>
            </div>
          </div>
        </div>
      )}
    </form>
  );
}

export default CommitmentStep;
