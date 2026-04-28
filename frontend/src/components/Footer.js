import React from 'react';

function Footer() {
  return (
    <footer className="footer">
      <p>
        &copy; {new Date().getFullYear()} NewSchool Apply &mdash;{' '}
        <a href="mailto:info@school.edu">Contact Us</a>
      </p>
    </footer>
  );
}

export default Footer;
