import React from 'react';
import { useSelector } from 'react-redux';
import { selectUser } from '../store/slices/authSlice';

function ProfilePage() {
  const user = useSelector(selectUser);

  return (
    <main className="page-content container">
      <h1>Profile</h1>
      {user ? (
        <div className="card" style={{ maxWidth: 480 }}>
          <div className="card-header">
            <h2 className="card-title">Account Information</h2>
          </div>
          <div>
            <div className="form-group">
              <label>Username</label>
              <p style={{ margin: 0, fontWeight: 500 }}>{user.name || '—'}</p>
            </div>
            <div className="form-group">
              <label>Email</label>
              <p style={{ margin: 0, fontWeight: 500 }}>{user.email || '—'}</p>
            </div>
            <div className="form-group">
              <label>Roles</label>
              <p style={{ margin: 0, fontWeight: 500 }}>
                {user.roles && user.roles.length > 0
                  ? user.roles.join(', ')
                  : 'Authenticated user'}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <p>No profile information available.</p>
      )}
    </main>
  );
}

export default ProfilePage;
