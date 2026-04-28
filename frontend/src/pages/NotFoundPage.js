import React from 'react';
import { Link } from 'react-router-dom';

function NotFoundPage() {
  return (
    <main className="page-content">
      <div className="empty-state">
        <h1>404</h1>
        <h2>Page Not Found</h2>
        <p>The page you are looking for does not exist.</p>
        <Link to="/" className="btn btn-primary">Go Home</Link>
      </div>
    </main>
  );
}

export default NotFoundPage;
