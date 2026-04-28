import React from 'react';
import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';

function ProfilePage() {
  const user = useSelector((state) => state.auth.user);

  return (
    <div className="page">
      <div className="page-header">
        <h1>My Profile</h1>
      </div>
      <div className="page-body">
        <div className="card" style={{ maxWidth: '480px' }}>
          <div className="card-header">
            <h2 className="card-title">Account Details</h2>
          </div>
          {user ? (
            <dl style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div>
                <dt style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>Username</dt>
                <dd style={{ marginTop: '2px' }}>{user.name || '—'}</dd>
              </div>
              <div>
                <dt style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>Email</dt>
                <dd style={{ marginTop: '2px' }}>{user.email || '—'}</dd>
              </div>
              <div>
                <dt style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>Roles</dt>
                <dd style={{ marginTop: '2px' }}>
                  {user.roles?.join(', ') || 'authenticated'}
                </dd>
              </div>
            </dl>
          ) : (
            <p>Profile information unavailable.</p>
          )}
        </div>
        <p style={{ marginTop: '1.5rem' }}>
          <Link to="/dashboard" className="btn btn-secondary">
            ← Back to Dashboard
          </Link>
        </p>
      </div>
    </div>
  );
}

export default ProfilePage;
