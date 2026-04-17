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
      <h2 id="documents-heading">Documents</h2>
      <p>Upload your transcript (PDF, max 5 MB). The server will perform final validation.</p>

      <div>
        <label htmlFor="file-upload">Select file</label>
        <input
          id="file-upload"
          ref={fileInputRef}
          type="file"
          accept=".pdf,.doc,.docx,.jpg,.png"
          onChange={handleFileChange}
          disabled={uploading}
          aria-describedby={fileError ? 'file-upload-error' : undefined}
          aria-invalid={fileError ? 'true' : undefined}
        />
        {fileError && (
          <span id="file-upload-error" role="alert">
            {fileError}
          </span>
        )}
        {serverError && (
          <span role="alert" aria-live="assertive">
            {serverError}
          </span>
        )}
        {uploading && <span aria-live="polite">Uploading…</span>}
      </div>

      {uploadedDocs.length > 0 && (
        <ul aria-label="Uploaded documents">
          {uploadedDocs.map((doc) => (
            <li key={doc.id || doc.name}>{doc.name}</li>
          ))}
        </ul>
      )}

      <button type="button" onClick={handleContinue} disabled={uploading}>
        Next
      </button>
    </section>
  );
}

export default DocumentsStep;
