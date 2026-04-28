import React from 'react';
import { Link } from 'react-router-dom';

function HomePage() {
  return (
    <main className="page-content">
      <div className="hero">
        <h1>Welcome to NewSchool Apply</h1>
        <p>
          Start your application to NewSchool today. Our secure online process makes it easy
          to submit everything your family needs to apply for enrollment.
        </p>
        <Link to="/login" className="btn btn-primary">
          Start Your Application
        </Link>
      </div>

      <section className="container" style={{ maxWidth: 800, margin: '0 auto 3rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.5rem' }}>
          <div className="card">
            <h3>Secure &amp; Private</h3>
            <p>Your family's information is protected and kept strictly confidential.</p>
          </div>
          <div className="card">
            <h3>Save Your Progress</h3>
            <p>Applications auto-save as you go. Come back anytime to continue where you left off.</p>
          </div>
          <div className="card">
            <h3>Simple Process</h3>
            <p>Our step-by-step guide walks you through the entire application process.</p>
          </div>
        </div>
      </section>
    </main>
  );
}

export default HomePage;
