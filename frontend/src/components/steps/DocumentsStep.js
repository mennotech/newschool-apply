import React, { useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { uploadAndCreateDocument } from '../../store/slices/applicationSlice';

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

function DocumentsStep({ onComplete }) {
  const dispatch = useDispatch();
  const applicationId = useSelector(
    (state) => state.application.currentApplication?.id,
  );

  const fileInputRef = useRef(null);
  const [uploadedDocs, setUploadedDocs] = useState([]);
  const [fileError, setFileError] = useState(null);
  const [serverError, setServerError] = useState(null);
  const [uploading, setUploading] = useState(false);

  async function handleFileChange(e) {
    const file = e.target.files[0];
    if (!file) return;

    // Client-side pre-check: size only (server validates authoritatively)
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setFileError('File is too large. Maximum allowed size is 5 MB.');
      e.target.value = '';
      return;
    }

    setFileError(null);
    setServerError(null);
    setUploading(true);

    try {
      const resultAction = await dispatch(
        uploadAndCreateDocument({
          applicationId,
          documentType: 'transcript',
          file,
        }),
      );

      if (uploadAndCreateDocument.rejected.match(resultAction)) {
        setServerError(resultAction.payload || 'Upload failed. Please try again.');
      } else {
        const docNode = resultAction.payload;
        setUploadedDocs((prev) => [
          ...prev,
          { id: docNode?.id, name: file.name },
        ]);
      }
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  function handleContinue() {
    onComplete(uploadedDocs);
  }

  return (
    <section aria-labelledby="documents-heading">
      <h2 id="documents-heading" style={{ marginBottom: '0.5rem' }}>Documents</h2>
      <p style={{ color: 'var(--color-text-muted)', marginBottom: '1.5rem', fontSize: '0.9375rem' }}>
        Upload your transcript (PDF, max 5 MB). The server will perform final validation.
      </p>

      <div className="form-group">
        <label className="form-label" htmlFor="file-upload">Select file</label>
        <input
          id="file-upload"
          ref={fileInputRef}
          type="file"
          className="form-input"
          accept=".pdf,.doc,.docx,.jpg,.png"
          onChange={handleFileChange}
          disabled={uploading}
          aria-describedby={fileError ? 'file-upload-error' : undefined}
          aria-invalid={fileError ? 'true' : undefined}
          style={{ paddingTop: '0.4375rem', paddingBottom: '0.4375rem', cursor: 'pointer' }}
        />
        {fileError && (
          <span id="file-upload-error" className="form-error" role="alert">
            {fileError}
          </span>
        )}
      </div>

      {serverError && (
        <div className="form-alert form-alert--error" role="alert" aria-live="assertive">
          {serverError}
        </div>
      )}

      {uploading && (
        <div className="loading-state" aria-live="polite">
          <span className="spinner" aria-hidden="true" />
          Uploading…
        </div>
      )}

      {uploadedDocs.length > 0 && (
        <ul
          aria-label="Uploaded documents"
          style={{ listStyle: 'none', padding: 0, margin: '0 0 1.5rem' }}
        >
          {uploadedDocs.map((doc) => (
            <li
              key={doc.id || doc.name}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.625rem 0.875rem',
                background: 'var(--color-success-light)',
                border: '1px solid #bbf7d0',
                borderRadius: 'var(--radius)',
                marginBottom: '0.5rem',
                fontSize: '0.9375rem',
                color: 'var(--color-success)',
                fontWeight: 500,
              }}
            >
              ✓ {doc.name}
            </li>
          ))}
        </ul>
      )}

      <button type="button" className="btn btn--primary" onClick={handleContinue} disabled={uploading}>
        Next →
      </button>
    </section>
  );
}

export default DocumentsStep;
