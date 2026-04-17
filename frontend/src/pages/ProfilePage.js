import React from 'react';
import { useSelector } from 'react-redux';

function ProfilePage() {
  const user = useSelector((state) => state.auth.user);

  return (
    <main className="page">
      <div className="container">
        <div className="page-header">
          <h1 className="page-header__title">My Profile</h1>
          <p className="page-header__subtitle">Your account information.</p>
        </div>

        <div className="card profile-card">
          <div className="card__header">
            <h2 className="card__title">Account Details</h2>
          </div>
          <div className="card__body">
            {user ? (
              <dl className="profile-dl">
                <dt>Username</dt>
                <dd>{user.name}</dd>
                <dt>Email</dt>
                <dd>{user.mail}</dd>
              </dl>
            ) : (
              <p>No profile information available.</p>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

export default ProfilePage;

