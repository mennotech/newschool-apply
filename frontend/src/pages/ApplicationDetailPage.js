import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import * as drupalClient from '../api/drupalClient';

const STATUS_LABELS = {
  draft: 'Draft',
  submitted: 'Submitted',
  under_review: 'Under Review',
  accepted: 'Accepted',
  not_accepted: 'Not Accepted',
};

function ApplicationDetailPage() {
  const { id } = useParams();
  const [application, setApplication] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError('');
      try {
        let data;
        try {
          data = await drupalClient.get(`/jsonapi/node/application_partial_programming/${id}?include=field_student`);
        } catch (_firstErr) {
          data = await drupalClient.get(`/jsonapi/node/application/${id}?include=field_student`);
        }
        setApplication(data.data);
      } catch (err) {
        setError(err.message || 'Failed to load application');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner" aria-hidden="true" />
        <p>Loading application…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page">
        <div className="page-body">
          <div className="alert alert-error" role="alert">
            <div className="alert-content">{error}</div>
          </div>
          <Link to="/dashboard" className="btn btn-secondary">
            ← Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  if (!application) {
    return (
      <div className="page">
        <div className="page-body">
          <p>Application not found.</p>
          <Link to="/dashboard" className="btn btn-secondary">← Back to Dashboard</Link>
        </div>
      </div>
    );
  }

  const attrs = application.attributes || {};
  const status = attrs.field_application_status || attrs.field_status || 'draft';

  return (
    <div className="page">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <h1 style={{ margin: 0 }}>Application Details</h1>
          <span className={`badge badge-${status}`}>
            {STATUS_LABELS[status] || status}
          </span>
        </div>
      </div>
      <div className="page-body">
        <div className="review-section">
          <div className="review-section-header">
            <h2 style={{ fontSize: '1.125rem', margin: 0 }}>Overview</h2>
          </div>
          <div className="review-field">
            <span className="review-field-label">Status</span>
            <span className="review-field-value">{STATUS_LABELS[status] || status}</span>
          </div>
          {attrs.created && (
            <div className="review-field">
              <span className="review-field-label">Started</span>
              <span className="review-field-value">{new Date(attrs.created).toLocaleDateString()}</span>
            </div>
          )}
          {attrs.field_submitted_at && (
            <div className="review-field">
              <span className="review-field-label">Submitted</span>
              <span className="review-field-value">{new Date(attrs.field_submitted_at).toLocaleDateString()}</span>
            </div>
          )}
          {attrs.field_application_bundle && (
            <div className="review-field">
              <span className="review-field-label">Application Type</span>
              <span className="review-field-value">{attrs.field_application_bundle}</span>
            </div>
          )}
        </div>

        {(attrs.field_student_first_name || attrs.field_student_last_name) && (
          <div className="review-section">
            <div className="review-section-header">
              <h2 style={{ fontSize: '1.125rem', margin: 0 }}>Student</h2>
            </div>
            <div className="review-field">
              <span className="review-field-label">Name</span>
              <span className="review-field-value">
                {[attrs.field_student_first_name, attrs.field_student_last_name].filter(Boolean).join(' ')}
              </span>
            </div>
            {(attrs.field_student_applying_for_grade || attrs.field_applying_grade) && (
              <div className="review-field">
                <span className="review-field-label">Applying for Grade</span>
                <span className="review-field-value">{attrs.field_student_applying_for_grade || attrs.field_applying_grade}</span>
              </div>
            )}
          </div>
        )}

        <Link to="/dashboard" className="btn btn-secondary">
          ← Back to Dashboard
        </Link>
      </div>
    </div>
  );
}

export default ApplicationDetailPage;
