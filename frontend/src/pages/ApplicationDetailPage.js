import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import * as client from '../api/drupalClient';

const STATUS_LABELS = {
  draft: 'Draft',
  submitted: 'Submitted',
  under_review: 'Under Review',
  accepted: 'Accepted',
  not_accepted: 'Not Accepted',
};

function ApplicationDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [app, setApp] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    Promise.all([
      client.get(`/jsonapi/node/application_partial_programming/${id}?include=field_student_profile`),
      client.get(`/jsonapi/node/document?filter[field_application.id]=${id}`),
    ])
      .then(([appData, docsData]) => {
        setApp(appData.data);
        setDocuments(docsData.data || []);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <main className="page-content container">
        <div className="loading-container" aria-live="polite">
          <span className="loading-spinner" aria-hidden="true" />
          Loading application…
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="page-content container">
        <div className="alert alert-error" role="alert">{error}</div>
        <button className="btn btn-ghost" onClick={() => navigate('/dashboard')}>
          Back to Dashboard
        </button>
      </main>
    );
  }

  if (!app) return null;

  const attrs = app.attributes || {};
  const appStatus = attrs.field_application_status || 'draft';

  function formatDate(dateStr) {
    if (!dateStr) return '—';
    try { return new Date(dateStr).toLocaleDateString(); } catch { return dateStr; }
  }

  return (
    <main className="page-content container">
      <div style={{ marginBottom: '1rem' }}>
        <Link to="/dashboard" className="btn btn-ghost btn-sm">&larr; Back to Dashboard</Link>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
        <h1>Application</h1>
        <span className={`badge badge-${appStatus}`}>{STATUS_LABELS[appStatus] || appStatus}</span>
      </div>

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="card-header">
          <h2 className="card-title">Student Information</h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div>
            <label style={{ fontWeight: 500, fontSize: '0.875rem' }}>Student Name</label>
            <p style={{ margin: 0 }}>
              {[attrs.field_student_first_name, attrs.field_student_last_name].filter(Boolean).join(' ') || '—'}
            </p>
          </div>
          <div>
            <label style={{ fontWeight: 500, fontSize: '0.875rem' }}>Applying for Grade</label>
            <p style={{ margin: 0 }}>{attrs.field_student_applying_for_grade || '—'}</p>
          </div>
          <div>
            <label style={{ fontWeight: 500, fontSize: '0.875rem' }}>Started</label>
            <p style={{ margin: 0 }}>{formatDate(attrs.created)}</p>
          </div>
          {attrs.field_submitted_at && (
            <div>
              <label style={{ fontWeight: 500, fontSize: '0.875rem' }}>Submitted</label>
              <p style={{ margin: 0 }}>{formatDate(attrs.field_submitted_at)}</p>
            </div>
          )}
        </div>
      </div>

      {documents.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Uploaded Documents</h2>
          </div>
          <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
            {documents.map((doc) => (
              <li key={doc.id} style={{ marginBottom: '0.5rem' }}>
                {doc.attributes?.title || 'Document'}
              </li>
            ))}
          </ul>
        </div>
      )}
    </main>
  );
}

export default ApplicationDetailPage;
