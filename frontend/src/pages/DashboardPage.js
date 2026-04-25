import React, { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Link, useNavigate } from 'react-router-dom';
import { clearApplication, deleteApplication, fetchApplications, setCurrentApplication } from '../store/slices/applicationSlice';

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

function formatDate(created) {
  if (!created) return '';
  // Drupal returns created as a Unix timestamp (integer)
  const ms = typeof created === 'number' ? created * 1000 : Date.parse(created);
  if (isNaN(ms)) return '';
  return new Date(ms).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function DashboardPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const user = useSelector((state) => state.auth.user);
  const { applications, fetchStatus, paymentByApplication } = useSelector((state) => state.application);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [notice, setNotice] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  function handleContinue(app) {
    dispatch(setCurrentApplication(app));
    navigate('/apply/student-info');
  }

  function handleDelete(app) {
    setPendingDelete(app);
  }

  function handleCancelDelete() {
    setPendingDelete(null);
  }

  function handleConfirmDelete() {
    if (!pendingDelete) return;
    setDeletingId(pendingDelete.id);
    dispatch(deleteApplication(pendingDelete.id)).then((action) => {
      if (deleteApplication.fulfilled.match(action)) {
        setNotice({ type: 'success', message: 'Draft application deleted.' });
      } else {
        setNotice({ type: 'error', message: action.payload || 'Failed to delete application.' });
      }
      setDeletingId(null);
      setPendingDelete(null);
    });
  }

  useEffect(() => {
    dispatch(fetchApplications());
    return () => {
      dispatch(clearApplication());
    };
  }, [dispatch]);

  return (
    <main className="page">
      <div className="container">
        <div className="dashboard-welcome">
          <h1 className="dashboard-welcome__greeting">
            Welcome back{user ? `, ${user.name}` : ''}
          </h1>
          <p className="dashboard-welcome__subtitle">
            Track your applications and manage your account below.
          </p>
        </div>

        <section className="dashboard-section" aria-labelledby="applications-heading">
          <div className="dashboard-section__header">
            <h2 className="dashboard-section__title" id="applications-heading">
              Your Applications
            </h2>
            <Link to="/apply" className="btn btn--primary btn--sm">
              + New Application
            </Link>
          </div>

          {notice && (
            <div
              className={`form-alert ${notice.type === 'error' ? 'form-alert--error' : 'form-alert--success'}`}
              role="status"
              aria-live="polite"
            >
              {notice.message}
            </div>
          )}

          {fetchStatus === 'loading' && (
            <div className="loading-state" aria-live="polite">
              <span className="spinner" aria-hidden="true" />
              Loading applications…
            </div>
          )}

          {fetchStatus !== 'loading' && applications.length === 0 && (
            <div className="empty-state">
              <span className="empty-state__icon" aria-hidden="true">📋</span>
              <h3 className="empty-state__title">No applications yet</h3>
              <p className="empty-state__description">
                Start a new application to begin the admissions process for your student.
              </p>
              <Link to="/apply" className="btn btn--primary">
                Start an application
              </Link>
            </div>
          )}

          {fetchStatus !== 'loading' && applications.length > 0 && (
            <ul className="applications-list" aria-label="Your applications">
              {applications.map((app, index) => {
                const status = app.attributes?.field_status ?? 'pending';
                const badgeClass = STATUS_CLASS[status] ?? 'badge--pending';
                const label = STATUS_LABELS[status] ?? status;
                const created = formatDate(app.attributes?.created);
                const isDraft = status === 'pending';
                const firstName = app.attributes?.field_student_first_name?.trim?.() || '';
                const lastName = app.attributes?.field_student_last_name?.trim?.() || '';
                const studentName = `${firstName} ${lastName}`.trim();
                const applyingGrade = app.attributes?.field_student_applying_for_grade?.trim?.() || '';
                const receiptUrl = paymentByApplication?.[app.id]?.receiptUrl || '';
                const canViewReceipt = status === 'submitted' && receiptUrl;
                const applicationTitle = app.attributes?.title || `Application ${applications.length - index}`;

                return (
                  <li key={app.id} className="app-card">
                    <div className="app-card__content">
                      <div className="app-card__top">
                        <div>
                          <h3 className="app-card__title">
                            {applicationTitle}
                          </h3>
                          {created && (
                            <p className="app-card__date">Started {created}</p>
                          )}
                          <div className="app-card__meta">
                            <p className="app-card__meta-row">
                              <span className="app-card__meta-label">Student</span>
                              <span className="app-card__meta-value">{studentName || 'Not started'}</span>
                            </p>
                            <p className="app-card__meta-row">
                              <span className="app-card__meta-label">Applying for grade</span>
                              <span className="app-card__meta-value">{applyingGrade || 'Not set'}</span>
                            </p>
                          </div>
                        </div>
                        <span className={`badge ${badgeClass}`} aria-label={`Status: ${label}`}>
                          {label}
                        </span>
                      </div>
                    </div>
                    <div className="app-card__actions">
                      {isDraft ? (
                        <>
                          <button
                            type="button"
                            className="btn btn--primary btn--sm"
                            onClick={() => handleContinue(app)}
                          >
                            Continue
                          </button>
                          <button
                            type="button"
                            className="btn btn--danger btn--sm"
                            onClick={() => handleDelete(app)}
                            disabled={deletingId === app.id}
                          >
                            Delete
                          </button>
                        </>
                      ) : (
                        <>
                          <Link to={`/application/${app.id}`} className="btn btn--secondary btn--sm">
                            View
                          </Link>
                          {canViewReceipt && (
                            <a
                              className="btn btn--secondary btn--sm"
                              href={receiptUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              View Receipt
                            </a>
                          )}
                        </>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      {pendingDelete && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="delete-draft-title">
          <div className="modal-card">
            <h3 id="delete-draft-title" className="modal-card__title">Delete draft application?</h3>
            <p className="modal-card__body">
              This will permanently remove the draft for
              {' '}
              {pendingDelete.attributes?.field_student_first_name || 'this student'}.
              {' '}
              This action cannot be undone.
            </p>
            <div className="modal-card__actions">
              <button
                type="button"
                className="btn btn--secondary btn--sm"
                onClick={handleCancelDelete}
                disabled={deletingId === pendingDelete.id}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn--danger btn--sm"
                onClick={handleConfirmDelete}
                disabled={deletingId === pendingDelete.id}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export default DashboardPage;

