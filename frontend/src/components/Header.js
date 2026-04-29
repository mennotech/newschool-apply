import React, { useState, useEffect } from 'react';
import { Link, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { logoutUser } from '../store/slices/authSlice';
import { clearApplication } from '../store/slices/applicationSlice';

function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const user = useSelector((state) => state.auth.user);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();

  // Close mobile nav on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  async function handleLogout() {
    const result = await dispatch(logoutUser());
    if (logoutUser.fulfilled.match(result)) {
      dispatch(clearApplication());
      navigate('/');
    }
  }

  return (
    <header className="site-header">
      <div className="header-inner">
        <Link to="/" className="site-logo">
          NewSchool Apply
        </Link>

        {/* Desktop nav */}
        <nav className="nav-desktop" aria-label="Main navigation">
          <ul>
            {user ? (
              <>
                <li>
                  <NavLink to="/dashboard">Dashboard</NavLink>
                </li>
                <li>
                  <NavLink to="/apply">New Application</NavLink>
                </li>
                <li>
                  <NavLink to="/records/people">People</NavLink>
                </li>
                <li>
                  <NavLink to="/records/addresses">Addresses</NavLink>
                </li>
                <li>
                  <NavLink to="/profile">Profile</NavLink>
                </li>
                <li>
                  <button onClick={handleLogout} aria-label="Log out">
                    Log out
                  </button>
                </li>
              </>
            ) : (
              <li>
                <Link to="/login" className="btn btn-primary btn-sm">
                  Log in
                </Link>
              </li>
            )}
          </ul>
        </nav>

        {/* Hamburger */}
        <button
          className="hamburger-btn"
          aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={mobileOpen}
          aria-controls="mobile-nav"
          onClick={() => setMobileOpen((o) => !o)}
        >
          <span />
          <span />
          <span />
        </button>
      </div>

      {/* Mobile nav */}
      <nav
        id="mobile-nav"
        className={`mobile-nav${mobileOpen ? ' open' : ''}`}
        aria-label="Mobile navigation"
        aria-hidden={!mobileOpen}
      >
        <ul>
          {user ? (
            <>
              <li>
                <NavLink to="/dashboard">Dashboard</NavLink>
              </li>
              <li>
                <NavLink to="/apply">New Application</NavLink>
              </li>
              <li>
                <NavLink to="/records/people">People</NavLink>
              </li>
              <li>
                <NavLink to="/records/addresses">Addresses</NavLink>
              </li>
              <li>
                <NavLink to="/profile">Profile</NavLink>
              </li>
              <li>
                <button onClick={handleLogout}>Log out</button>
              </li>
            </>
          ) : (
            <>
              <li>
                <NavLink to="/login">Log in</NavLink>
              </li>
              <li>
                <NavLink to="/register">Register</NavLink>
              </li>
            </>
          )}
        </ul>
      </nav>
    </header>
  );
}

export default Header;
