import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { selectUser } from '../store/slices/authSlice';

function ProtectedRoute({ children }) {
  const user = useSelector(selectUser);
  const location = useLocation();

  if (!user) {
    const destination = location.pathname + location.search + location.hash;
    return <Navigate to={`/login?next=${encodeURIComponent(destination)}`} replace />;
  }

  return children;
}

export default ProtectedRoute;
