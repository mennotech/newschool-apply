import React from 'react';
import { Link } from 'react-router-dom';

function HomePage() {
  return (
    <main>
      <h1>NewSchool Apply</h1>
      <p>Apply to NewSchool — a school for curious minds.</p>
      <nav aria-label="Main actions">
        <Link to="/login">Log in or apply</Link>
      </nav>
    </main>
  );
}

export default HomePage;
