import React from 'react';
import { Link } from 'react-router-dom';

function HomePage() {
  return (
    <main>
      <section className="hero">
        <span className="hero__eyebrow">School Admissions</span>
        <h1 className="hero__title">Apply to NewSchool</h1>
        <p className="hero__subtitle">
          A modern school for curious minds. Complete your application online —
          it only takes a few minutes to get started.
        </p>
        <div className="hero__actions">
          <Link to="/login" className="btn btn--primary btn--lg">
            Start your application
          </Link>
        </div>
        <p className="hero__trust">Secure &amp; confidential application process</p>
      </section>
    </main>
  );
}

export default HomePage;
