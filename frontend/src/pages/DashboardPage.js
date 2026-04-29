import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { setCurrentApplication, clearApplication } from '../store/slices/applicationSlice';
import * as drupalClient from '../api/drupalClient';

const BUNDLE_LABELS = {
  partial_programming: 'Partial Programming',
  application: 'Application',
};

const RESOURCE_BY_TYPE = {
  'node--application_partial_programming': 'application_partial_programming',
  'node--application': 'application',
};

const STATUS_LABELS = {
  draft: 'Draft',
  submitted: 'Submitted',
  under_review: 'Under Review',
  accepted: 'Accepted',
  not_accepted: 'Not Accepted',
};

function DashboardPage() {
  const user = useSelector((state) => state.auth.user);
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [showBundleModal, setShowBundleModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [deleteError, setDeleteError] = useState('');

  // Clear any stale application state when landing on dashboard
  useEffect(() => {
    dispatch(clearApplication());
  }, [dispatch]);

  const loadApplications = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setLoadError('');
    try {
      const queries = [
        `/jsonapi/node/application_partial_programming?filter[uid.id][value]=${user.uid}&include=field_student`,
        `/jsonapi/node/application?filter[uid.id][value]=${user.uid}&include=field_student`,
      ];
      const results = await Promise.allSettled(queries.map((q) => drupalClient.get(q)));

      const succeeded = results.filter((r) => r.status === 'fulfilled');
      if (succeeded.length === 0) {
        throw new Error('Failed to load applications');
      }

      const merged = [];
      const seen = new Set();
      succeeded.forEach((result) => {
        (result.value?.data || []).forEach((app) => {
          if (app?.id && !seen.has(app.id)) {
            seen.add(app.id);
            merged.push(app);
          }
        });
      });

      merged.sort((a, b) => {
        const aTime = new Date(a?.attributes?.created || 0).getTime();
        const bTime = new Date(b?.attributes?.created || 0).getTime();
        return bTime - aTime;
      });
      setApplications(merged);
    } catch (err) {
      setLoadError(err.message || 'Failed to load applications');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadApplications();
  }, [loadApplications]);

  async function handleDelete(app) {
    setDeleteError('');
    try {
      const resource = RESOURCE_BY_TYPE[app.type] || 'application_partial_programming';
      await drupalClient.delete_(`/jsonapi/node/${resource}/${app.id}`);
      setApplications((prev) => prev.filter((a) => a.id !== app.id));
      setDeleteConfirm(null);
    } catch (err) {
      setDeleteError(err.message || 'Failed to delete application');
    }
  }

  async function handleNewApplication(bundle) {
    setShowBundleModal(false);
    try {
      const data = await drupalClient.post('/jsonapi/node/application_partial_programming', {
        data: {
          type: 'node--application_partial_programming',
          attributes: {
            title: `Application - ${BUNDLE_LABELS[bundle] || bundle}`,
            field_application_status: 'draft',
          },
        },
      });
      dispatch(setCurrentApplication(data.data));
      navigate('/apply/student-info');
    } catch (err) {
      setLoadError(err.message || 'Failed to create application');
    }
  }

  function handleContinue(app) {
    dispatch(setCurrentApplication(app));
    navigate('/apply/student-info');
  }

  const getStudentName = (app) => {
    const attrs = app.attributes || {};
    const firstName = attrs.field_student_first_name || '';
    const lastName = attrs.field_student_last_name || '';
    if (firstName || lastName) return `${firstName} ${lastName}`.trim();
    return 'Student';
  };

  const getStatus = (app) => {
    return app.attributes?.field_application_status || app.attributes?.field_status || 'draft';
  };

  const getBundle = (app) => {
    const bundle = app.attributes?.field_application_bundle ||
      (app.type === 'node--application' ? 'application' : 'partial_programming');
    return BUNDLE_LABELS[bundle] || bundle || 'Application';
  };

  const getStartDate = (app) => {
    const created = app.attributes?.created;
    if (!created) return '';
    return new Date(created).toLocaleDateString();
  };

  return (
    <div className="dashboard-page">
      <div className="dashboard-header">
        <div>
          <h1>
            {user?.name ? `Welcome, ${user.name}` : 'Dashboard'}
          </h1>
          <p style={{ margin: 0, color: 'var(--color-text-secondary)' }}>
            Manage your applications below.
          </p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => setShowBundleModal(true)}
          aria-label="Start a new application"
        >
          + New Application
        </button>
      </div>

      {loadError && (
        <div className="alert alert-error" role="alert">
          <div className="alert-content">{loadError}</div>
        </div>
      )}

      {loading ? (
        <div className="loading-container">
          <div className="spinner" aria-hidden="true" />
          <p>Loading applications…</p>
        </div>
      ) : applications.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon" aria-hidden="true">📄</div>
          <h2>No Applications Yet</h2>
          <p>Start a new application to begin the admissions process.</p>
          <button
            className="btn btn-primary btn-lg"
            onClick={() => setShowBundleModal(true)}
          >
            Start Application
          </button>
        </div>
      ) : (
        <div className="application-list" aria-label="Your applications">
          {applications.map((app, index) => {
            const status = getStatus(app);
            const isDraft = status === 'draft';
            return (
              <article key={app.id} className="application-card">
                <div className="application-card-header">
                  <h2 className="application-card-title">
                    Application #{index + 1} — {getBundle(app)}
                  </h2>
                  <span className={`badge badge-${status}`} aria-label={`Status: ${STATUS_LABELS[status] || status}`}>
                    {STATUS_LABELS[status] || status}
                  </span>
                </div>
                <div className="application-card-meta">
                  <div>Student: {getStudentName(app)}</div>
                  <div>Started: {getStartDate(app)}</div>
                  {(app.attributes?.field_student_applying_for_grade || app.attributes?.field_applying_grade) && (
                    <div>Applying for Grade: {app.attributes.field_student_applying_for_grade || app.attributes.field_applying_grade}</div>
                  )}
                </div>
                <div className="application-card-actions">
                  {isDraft ? (
                    <>
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => handleContinue(app)}
                        aria-label={`Continue application ${index + 1}`}
                      >
                        Continue
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => setDeleteConfirm(app)}
                        aria-label={`Delete application ${index + 1}`}
                      >
                        Delete
                      </button>
                    </>
                  ) : (
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => navigate(`/application/${app.id}`)}
                      aria-label={`View application ${index + 1}`}
                    >
                      View
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Bundle selection modal */}
      {showBundleModal && (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="bundle-modal-title">
          <div className="modal">
            <h2 className="modal-title" id="bundle-modal-title">Choose Application Type</h2>
            <div className="modal-body">
              <p>Select the type of program you are applying for:</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1rem' }}>
                {Object.entries(BUNDLE_LABELS).map(([key, label]) => (
                  <button
                    key={key}
                    className="btn btn-secondary"
                    onClick={() => handleNewApplication(key)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="modal-actions">
              <button
                className="btn btn-ghost"
                onClick={() => setShowBundleModal(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteConfirm && (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="delete-modal-title">
          <div className="modal">
            <h2 className="modal-title" id="delete-modal-title">Delete Application?</h2>
            <div className="modal-body">
              <p>
                Are you sure you want to delete this draft application? This action cannot be undone.
              </p>
              {deleteError && (
                <div className="alert alert-error" role="alert">
                  <div className="alert-content">{deleteError}</div>
                </div>
              )}
            </div>
            <div className="modal-actions">
              <button
                className="btn btn-ghost"
                onClick={() => { setDeleteConfirm(null); setDeleteError(''); }}
              >
                Cancel
              </button>
              <button
                className="btn btn-danger"
                onClick={() => handleDelete(deleteConfirm)}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default DashboardPage;
