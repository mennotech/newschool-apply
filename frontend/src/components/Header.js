import React, { useState } from 'react';
import { NavLink, Link, useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { selectUser } from '../store/slices/authSlice';
import { logoutUser } from '../store/slices/authSlice';

function Header() {
  const user = useSelector(selectUser);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const closeMenu = () => setMenuOpen(false);

  const handleLogout = async () => {
    closeMenu();
    await dispatch(logoutUser());
    navigate('/');
  };

  return (
    <header className="header">
      <div className="header-inner">
        <Link to="/" className="header-logo" onClick={closeMenu}>
          NewSchool Apply
        </Link>

        <button
          className="hamburger"
          aria-label="Toggle navigation menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((o) => !o)}
        >
          <span />
          <span />
          <span />
        </button>

        <nav className={`header-nav${menuOpen ? ' open' : ''}`} aria-label="Main navigation">
          {user ? (
            <>
              <NavLink to="/dashboard" onClick={closeMenu}>Dashboard</NavLink>
              <NavLink to="/apply" onClick={closeMenu}>New Application</NavLink>
              <NavLink to="/records/people" onClick={closeMenu}>People</NavLink>
              <NavLink to="/records/addresses" onClick={closeMenu}>Addresses</NavLink>
              <NavLink to="/profile" onClick={closeMenu}>Profile</NavLink>
              <button onClick={handleLogout}>Log out</button>
            </>
          ) : (
            <NavLink to="/login" onClick={closeMenu}>Log in</NavLink>
          )}
        </nav>
      </div>
    </header>
  );
}

export default Header;
