import React, { useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Link } from 'react-router-dom';
import { logoutUser } from '../store/slices/authSlice';
import { clearApplication, fetchApplications } from '../store/slices/applicationSlice';

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
  const user = useSelector((state) => state.auth.user);
  const { applications, fetchStatus } = useSelector((state) => state.application);

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

                return (
                  <li key={app.id} className="app-card">
                    <div className="app-card__content">
                      <div className="app-card__top">
                        <div>
                          <h3 className="app-card__title">
                            Application {applications.length - index}
                          </h3>
                          {created && (
                            <p className="app-card__date">Started {created}</p>
                          )}
                        </div>
                        <span className={`badge ${badgeClass}`} aria-label={`Status: ${label}`}>
                          {label}
                        </span>
                      </div>
                    </div>
                    <div className="app-card__actions">
                      {isDraft ? (
                        <Link to="/apply" className="btn btn--primary btn--sm">
                          Continue
                        </Link>
                      ) : (
                        <Link to={`/application/${app.id}`} className="btn btn--secondary btn--sm">
                          View
                        </Link>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}

export default DashboardPage;

