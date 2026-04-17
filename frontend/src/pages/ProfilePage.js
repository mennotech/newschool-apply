import React from 'react';
import { useSelector } from 'react-redux';

function ProfilePage() {
  const user = useSelector((state) => state.auth.user);

  return (
    <main>
      <h1>Profile</h1>
      {user && (
        <dl>
          <dt>Username</dt>
          <dd>{user.name}</dd>
          <dt>Email</dt>
          <dd>{user.mail}</dd>
        </dl>
      )}
    </main>
  );
}

export default ProfilePage;
