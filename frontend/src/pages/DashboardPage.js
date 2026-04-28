import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { selectUser } from '../store/slices/authSlice';
import {
  fetchApplications,
  deleteApplication,
  setCurrentApplication,
  clearCurrentApplication,
  selectApplicationList,
  selectApplicationStatus,
  selectApplicationError,
} from '../store/slices/applicationSlice';

const BUNDLE_LABELS = {
  application_partial_programming: 'Partial Programming',
  application_full_early_years: 'Full Early Years',
  application_full_middle_years: 'Full Middle Years',
  application_full_senior_years: 'Full Senior Years',
};

const APPLICATION_BUNDLES = [
  { value: 'application_partial_programming', label: 'Partial Programming' },
  { value: 'application_full_early_years', label: 'Full Early Years' },
  { value: 'application_full_middle_years', label: 'Full Middle Years' },
  { value: 'application_full_senior_years', label: 'Full Senior Years' },
];

function StatusBadge({ status }) {
  const cls = `badge badge-${status || 'draft'}`;
  const labels = {
    draft: 'Draft',
    submitted: 'Submitted',
    under_review: 'Under Review',
    accepted: 'Accepted',
    not_accepted: 'Not Accepted',
  };
  return <span className={cls}>{labels[status] || status}</span>;
}

function ConfirmDialog({ message, onConfirm, onCancel }) {
  return (
    <div className="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
      <div className="modal">
        <h2 className="modal-title" id="confirm-title">Confirm Deletion</h2>
        <p>{message}</p>
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
          <button className="btn btn-danger" onClick={onConfirm}>Delete Application</button>
        </div>
      </div>
    </div>
  );
}

function DashboardPage() {
  const user = useSelector(selectUser);
  const list = useSelector(selectApplicationList);
  const status = useSelector(selectApplicationStatus);
  const error = useSelector(selectApplicationError);
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteSuccess, setDeleteSuccess] = useState(null);
  const [showBundleSelect, setShowBundleSelect] = useState(false);
  const [selectedBundle, setSelectedBundle] = useState('application_partial_programming');

  useEffect(() => {
    dispatch(fetchApplications());
    dispatch(clearCurrentApplication());
  }, [dispatch]);

  function handleContinue(app) {
    dispatch(setCurrentApplication(app));
    navigate('/apply/student-info');
  }

  function handleView(app) {
    navigate(`/application/${app.id}`);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const result = await dispatch(deleteApplication({ id: deleteTarget.id, bundle: deleteTarget.bundle }));
    if (deleteApplication.fulfilled.match(result)) {
      setDeleteSuccess('Application deleted successfully.');
      setDeleteTarget(null);
    }
  }

  function handleNewApplication() {
    setShowBundleSelect(true);
  }

  function handleBundleSelected() {
    navigate(`/apply?bundle=${selectedBundle}`);
    setShowBundleSelect(false);
  }

  function getAppBundle(app) {
    if (!app.type) return 'application_partial_programming';
    return app.type.replace('node--', '');
  }

  function formatDate(dateStr) {
    if (!dateStr) return 'Unknown';
    try {
      return new Date(dateStr).toLocaleDateString();
    } catch {
      return dateStr;
    }
  }

  function getStudentName(app) {
    const attrs = app.attributes || {};
    const first = attrs.field_student_first_name || '';
    const last = attrs.field_student_last_name || '';
    if (first || last) return `${first} ${last}`.trim();
    return 'Unknown student';
  }

  return (
    <main className="page-content container">
      <div className="dashboard-section">
        <div className="dashboard-section-header">
          <h1>Welcome{user?.name ? `, ${user.name}` : ''}!</h1>
          <button className="btn btn-primary" onClick={handleNewApplication}>
            + New Application
          </button>
        </div>

        {deleteSuccess && (
          <div className="alert alert-success" role="status">
            {deleteSuccess}
          </div>
        )}
        {error && (
          <div className="alert alert-error" role="alert">
            {error}
          </div>
        )}

        {showBundleSelect && (
          <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="bundle-modal-title">
            <div className="modal">
              <h2 className="modal-title" id="bundle-modal-title">Select Application Type</h2>
              <div className="form-group">
                <label htmlFor="bundle-select">Application Type</label>
                <select
                  id="bundle-select"
                  className="form-control"
                  value={selectedBundle}
                  onChange={(e) => setSelectedBundle(e.target.value)}
                >
                  {APPLICATION_BUNDLES.map((b) => (
                    <option key={b.value} value={b.value}>{b.label}</option>
                  ))}
                </select>
              </div>
              <div className="modal-actions">
                <button className="btn btn-ghost" onClick={() => setShowBundleSelect(false)}>Cancel</button>
                <button className="btn btn-primary" onClick={handleBundleSelected}>Start Application</button>
              </div>
            </div>
          </div>
        )}

        <h2>Your Applications</h2>

        {status === 'loading' && (
          <div className="loading-container" aria-live="polite">
            <span className="loading-spinner" aria-hidden="true" />
            Loading applications…
          </div>
        )}

        {status !== 'loading' && list.length === 0 && (
          <div className="empty-state">
            <h3>No applications yet</h3>
            <p>Get started by clicking "New Application" above.</p>
          </div>
        )}

        {list.map((app, idx) => {
          const attrs = app.attributes || {};
          const appStatus = attrs.field_application_status || 'draft';
          const isDraft = appStatus === 'draft';
          const bundle = getAppBundle(app);

          return (
            <div key={app.id} className="application-card">
              <div className="application-card-header">
                <div>
                  <h3 className="application-card-title">
                    Application #{idx + 1} &mdash; {BUNDLE_LABELS[bundle] || bundle}
                  </h3>
                  <div className="application-card-meta">
                    <span>Started: {formatDate(attrs.created)}</span>
                    <span>Student: {getStudentName(app)}</span>
                    {attrs.field_student_applying_for_grade && (
                      <span>Grade: {attrs.field_student_applying_for_grade}</span>
                    )}
                  </div>
                </div>
                <StatusBadge status={appStatus} />
              </div>
              <div className="application-card-actions">
                {isDraft ? (
                  <>
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => handleContinue(app)}
                    >
                      Continue
                    </button>
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => setDeleteTarget({ id: app.id, bundle })}
                    >
                      Delete
                    </button>
                  </>
                ) : (
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleView(app)}
                  >
                    View
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {deleteTarget && (
        <ConfirmDialog
          message="Are you sure you want to delete this draft application? This cannot be undone."
          onConfirm={confirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </main>
  );
}

export default DashboardPage;
