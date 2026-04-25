import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { get } from '../api/drupalClient';

const STATUS_LABELS = {
  pending: 'Draft',
  submitted: 'Submitted',
  under_review: 'Under Review',
  accepted: 'Accepted',
  rejected: 'Not Accepted',
};

const STATUS_CLASS = {
  pending: 'badge--pending',
  submitted: 'badge--submitted',
  under_review: 'badge--under-review',
  accepted: 'badge--accepted',
  rejected: 'badge--rejected',
};

function formatDate(value) {
  if (!value) return '—';
  const ms = typeof value === 'number' ? value * 1000 : Date.parse(value);
  if (isNaN(ms)) return value;
  return new Date(ms).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function ApplicationDetailPage() {
  const { id } = useParams();
  const [application, setApplication] = useState(null);
  const [studentProfile, setStudentProfile] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        // Fetch application with included student profile and documents
        const result = await get(
          `/jsonapi/node/application/${id}?include=field_student_profile`
        );
        setApplication(result.data);

        const included = result.included || [];
        const profile = included.find((r) => r.type === 'node--student_profile');
        if (profile) setStudentProfile(profile);

        // Fetch documents linked to this application
        const docsResult = await get(
          `/jsonapi/node/document?filter[field_application.id]=${id}`
        );
        setDocuments(docsResult.data || []);
      } catch (err) {
        setError(err.message || 'Failed to load application.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  if (loading) {
    return (
      <main className="page">
        <div className="container">
          <div className="loading-state">
            <span className="spinner" aria-hidden="true" />
            Loading application…
          </div>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="page">
        <div className="container">
          <div className="form-alert form-alert--error" role="alert">{error}</div>
          <Link to="/dashboard" className="btn btn--secondary btn--sm">← Back to Dashboard</Link>
        </div>
      </main>
    );
  }

  const attrs = application?.attributes || {};
  const status = attrs.field_status ?? 'pending';
  const badgeClass = STATUS_CLASS[status] ?? 'badge--pending';
  const statusLabel = STATUS_LABELS[status] ?? status;
  const profileAttrs = studentProfile?.attributes || {};
  const applicationTitle = attrs.title || 'Application';

  return (
    <main className="page">
      <div className="container" style={{ maxWidth: '720px' }}>
        <div style={{ marginBottom: '1.5rem' }}>
          <Link to="/dashboard" className="btn btn--ghost btn--sm" style={{ paddingLeft: 0 }}>
            ← Back to Dashboard
          </Link>
        </div>

        <div className="page-header" style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <h1 className="page-header__title" style={{ margin: 0 }}>{applicationTitle}</h1>
          <span className={`badge ${badgeClass}`}>{statusLabel}</span>
        </div>
        {attrs.created && (
          <p className="page-header__subtitle" style={{ marginTop: '0.25rem' }}>
            Started {formatDate(attrs.created)}
          </p>
        )}

        {/* Student information */}
        <div className="card" style={{ marginTop: '1.75rem', marginBottom: '1.25rem' }}>
          <div className="card__header">
            <h2 className="card__title">Student Information</h2>
          </div>
          <div className="card__body">
            {studentProfile ? (
              <dl className="profile-dl">
                <dt>First name</dt>
                <dd>{profileAttrs.field_first_name || '—'}</dd>
                <dt>Last name</dt>
                <dd>{profileAttrs.field_last_name || '—'}</dd>
                <dt>Date of birth</dt>
                <dd>{profileAttrs.field_date_of_birth || '—'}</dd>
                <dt>Grade applying for</dt>
                <dd>{profileAttrs.field_grade_applying_for || '—'}</dd>
              </dl>
            ) : (
              <p style={{ color: 'var(--color-text-muted)' }}>No student information on record.</p>
            )}
          </div>
        </div>

        {/* Documents */}
        <div className="card" style={{ marginBottom: '1.25rem' }}>
          <div className="card__header">
            <h2 className="card__title">Documents</h2>
          </div>
          <div className="card__body">
            {documents.length > 0 ? (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {documents.map((doc) => (
                  <li
                    key={doc.id}
                    style={{
                      padding: '0.625rem 0.875rem',
                      background: 'var(--color-bg)',
                      border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius)',
                      fontSize: '0.9375rem',
                    }}
                  >
                    {doc.attributes?.title || doc.attributes?.field_document_type || 'Document'}
                  </li>
                ))}
              </ul>
            ) : (
              <p style={{ color: 'var(--color-text-muted)' }}>No documents uploaded.</p>
            )}
          </div>
        </div>

        {/* Submission info */}
        {attrs.field_submitted_at && (
          <div className="card">
            <div className="card__body">
              <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: '0.9375rem' }}>
                Submitted on {formatDate(attrs.field_submitted_at)}
              </p>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

export default ApplicationDetailPage;
