import React, { useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Link } from 'react-router-dom';
import { logoutUser } from '../store/slices/authSlice';
import { clearApplication } from '../store/slices/applicationSlice';

function DashboardPage() {
  const dispatch = useDispatch();
  const user = useSelector((state) => state.auth.user);
  const { currentApplication } = useSelector((state) => state.application);

  useEffect(() => {
    // Clear any lingering application state when returning to the dashboard
    return () => {
      dispatch(clearApplication());
    };
  }, [dispatch]);

  async function handleLogout() {
    await dispatch(logoutUser());
  }

  return (
    <main>
      <h1>Dashboard</h1>
      {user && <p>Welcome, {user.name}</p>}

      <nav aria-label="Application actions">
        {currentApplication ? (
          <p>
            Application status:{' '}
            <strong>{currentApplication.attributes?.field_status ?? 'pending'}</strong>
          </p>
        ) : (
          <Link to="/apply">Start a new application</Link>
        )}
      </nav>

      <nav aria-label="Account">
        <Link to="/profile">View profile</Link>
        <button type="button" onClick={handleLogout}>
          Log out
        </button>
      </nav>
    </main>
  );
}

export default DashboardPage;
