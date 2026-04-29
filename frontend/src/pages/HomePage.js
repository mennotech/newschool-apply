import React from 'react';
import { Link } from 'react-router-dom';

function HomePage() {
  return (
    <div>
      <section className="hero">
        <div className="container">
          <h1>Apply to NewSchool</h1>
          <p>
            Begin your family's journey with a simple, secure online application.
            Our guided process makes it easy to apply for your student.
          </p>
          <Link to="/login" className="btn btn-primary btn-lg">
            Start Your Application
          </Link>
        </div>
      </section>

      <section className="trust-section">
        <div className="container">
          <h2 style={{ textAlign: 'center', marginBottom: '2rem' }}>
            Why Families Choose NewSchool
          </h2>
          <div className="trust-grid">
            <div className="trust-item">
              <div className="trust-icon" aria-hidden="true">🔒</div>
              <h3>Secure &amp; Private</h3>
              <p>
                Your family's information is protected with industry-standard security.
                We never share your data with third parties.
              </p>
            </div>
            <div className="trust-item">
              <div className="trust-icon" aria-hidden="true">📋</div>
              <h3>Save &amp; Resume</h3>
              <p>
                Complete your application at your own pace. Save progress and
                come back anytime — your data is always waiting for you.
              </p>
            </div>
            <div className="trust-item">
              <div className="trust-icon" aria-hidden="true">✅</div>
              <h3>Step-by-Step Guidance</h3>
              <p>
                Our clear, guided application wizard walks you through each step
                so nothing is missed.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section style={{ padding: '3rem 1rem', textAlign: 'center', background: 'var(--color-primary-light)' }}>
        <div className="container">
          <h2>Ready to get started?</h2>
          <p>Create an account or sign in to begin or continue your application.</p>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to="/register" className="btn btn-primary btn-lg">
              Create Account
            </Link>
            <Link to="/login" className="btn btn-secondary btn-lg">
              Sign In
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

export default HomePage;
