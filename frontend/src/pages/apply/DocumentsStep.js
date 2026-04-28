import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import * as drupalClient from '../../api/drupalClient';
import AlertBanner from '../../components/AlertBanner';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/gif'];

function DocumentsStep() {
  const navigate = useNavigate();
  const currentApplication = useSelector((s) => s.application.currentApplication);
  const fileInputRef = useRef(null);

  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [dragover, setDragover] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  function validateFile(file) {
    if (file.size > MAX_FILE_SIZE) {
      return `"${file.name}" exceeds the 5 MB size limit`;
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      return `"${file.name}" is not a supported file type (PDF, JPEG, PNG, GIF)`;
    }
    return null;
  }

  async function handleFiles(files) {
    const fileArray = Array.from(files);
    for (const file of fileArray) {
      const validationError = validateFile(file);
      if (validationError) {
        setUploadError(validationError);
        return;
      }
      setUploadError('');
      setUploading(true);
      try {
        const appId = currentApplication?.id;
        const path = `/jsonapi/node/document/field_file${appId ? `?filter[field_application.id]=${appId}` : ''}`;
        await drupalClient.uploadFile(path, file);
        setUploadedFiles((prev) => [
          ...prev,
          { name: file.name, size: file.size, uploadedAt: new Date().toISOString() },
        ]);
      } catch (err) {
        setUploadError(err.message || `Failed to upload "${file.name}"`);
      } finally {
        setUploading(false);
      }
    }
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragover(false);
    handleFiles(e.dataTransfer.files);
  }

  function handleDragOver(e) {
    e.preventDefault();
    setDragover(true);
  }

  function handleDragLeave() {
    setDragover(false);
  }

  function handleInputChange(e) {
    handleFiles(e.target.files);
    // Reset input so same file can be re-uploaded if needed
    e.target.value = '';
  }

  return (
    <div className="step-content">
      <h1 className="step-title">Documents</h1>
      <p className="step-description">
        Upload any supporting documents (transcripts, immunization records, etc.).
        This step is optional — you may proceed without uploading.
      </p>

      {uploadError && <AlertBanner type="error" message={uploadError} />}

      <div
        className={`dropzone${dragover ? ' dragover' : ''}`}
        role="button"
        tabIndex={0}
        aria-label="Upload documents — click or drag and drop files here"
        onClick={() => fileInputRef.current?.click()}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click(); }}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }} aria-hidden="true">📁</div>
        <p style={{ margin: 0, fontWeight: 600 }}>
          {uploading ? 'Uploading…' : 'Drop files here or click to browse'}
        </p>
        <p style={{ margin: '0.5rem 0 0', fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
          PDF, JPEG, PNG — max 5 MB per file
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,.gif"
          multiple
          onChange={handleInputChange}
          style={{ display: 'none' }}
          aria-hidden="true"
          tabIndex={-1}
        />
      </div>

      {uploadedFiles.length > 0 && (
        <div className="uploaded-files-list" aria-label="Uploaded files">
          {uploadedFiles.map((f) => (
            <div key={f.name + f.uploadedAt} className="uploaded-file-item">
              <span>✓ {f.name}</span>
              <span style={{ fontSize: '0.75rem' }}>
                {(f.size / 1024).toFixed(1)} KB
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="form-actions" style={{ marginTop: '2rem' }}>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => navigate('/apply/commitment')}
        >
          ← Back
        </button>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => navigate('/apply/review')}
          disabled={uploading}
        >
          {uploadedFiles.length > 0 ? 'Next: Review →' : 'Skip to Review →'}
        </button>
      </div>
    </div>
  );
}

export default DocumentsStep;
