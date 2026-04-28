import React, { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { uploadDocument } from '../../store/slices/applicationSlice';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

function DocumentsStep() {
  const { application, markStepComplete, goToNextStep, goToPrevStep } = useOutletContext();
  const dispatch = useDispatch();
  const [uploading, setUploading] = useState(false);
  const [uploadedDocs, setUploadedDocs] = useState([]);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  async function handleFileChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > MAX_FILE_SIZE) {
      setError(`File "${file.name}" is too large. Maximum size is 5 MB.`);
      return;
    }
    setError(null);
    setUploading(true);
    try {
      const result = await dispatch(uploadDocument({
        applicationId: application.id,
        file,
        documentType: 'other',
      }));
      if (uploadDocument.fulfilled.match(result)) {
        setUploadedDocs((prev) => [...prev, { name: file.name, id: Date.now() }]);
        setSuccess(`"${file.name}" uploaded successfully.`);
      } else {
        setError(result.payload || 'Upload failed. Please try again.');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  function handleNext() {
    markStepComplete('documents');
    goToNextStep('documents');
  }

  return (
    <div className="card">
      <div className="card-header">
        <h2 className="card-title">Step 7: Documents (Optional)</h2>
      </div>

      <div className="alert alert-info">
        You may upload supporting documents such as transcripts or immunization records. This step is optional.
      </div>

      {error && <div className="alert alert-error" role="alert">{error}</div>}
      {success && <div className="alert alert-success" role="status">{success}</div>}

      <div className="form-group">
        <label htmlFor="doc-upload">Upload Document</label>
        <span id="doc-upload-hint" className="form-hint">
          Accepted formats: PDF, JPG, PNG. Max size: 5 MB per file.
        </span>
        <input
          id="doc-upload"
          type="file"
          className="form-control"
          accept=".pdf,.jpg,.jpeg,.png"
          onChange={handleFileChange}
          disabled={uploading}
          aria-describedby="doc-upload-hint"
        />
        {uploading && (
          <div className="loading-container" style={{ justifyContent: 'flex-start', padding: '0.5rem 0' }}>
            <span className="loading-spinner" aria-hidden="true" />
            Uploading…
          </div>
        )}
      </div>

      {uploadedDocs.length > 0 && (
        <div>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '0.5rem' }}>Uploaded This Session</h3>
          <ul style={{ paddingLeft: '1.25rem' }}>
            {uploadedDocs.map((doc) => (
              <li key={doc.id}>{doc.name}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="step-nav">
        <button type="button" className="btn btn-ghost" onClick={() => goToPrevStep('documents')}>Back</button>
        <button type="button" className="btn btn-primary" onClick={handleNext}>
          Next: Review
        </button>
      </div>
    </div>
  );
}

export default DocumentsStep;
