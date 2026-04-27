import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { logoutUser } from '../store/slices/authSlice';

function Header() {
  const dispatch = useDispatch();
  const location = useLocation();
  const user = useSelector((state) => state.auth.user);
  const [menuOpen, setMenuOpen] = useState(false);

  // Close menu on route change
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  async function handleLogout() {
    await dispatch(logoutUser());
    setMenuOpen(false);
  }

  function navClass(path) {
    const isActive =
      path === '/dashboard'
        ? location.pathname === '/dashboard'
        : location.pathname.startsWith(path);
    return `header__nav-link${isActive ? ' header__nav-link--active' : ''}`;
  }

  return (
    <header className="header">
      <div className="container header__inner">
        <Link to="/" className="header__brand" aria-label="NewSchool Apply — home">
          NewSchool Apply
        </Link>

        {user ? (
          <>
            <button
              type="button"
              className="header__hamburger"
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={menuOpen}
              aria-controls="main-nav"
              onClick={() => setMenuOpen((o) => !o)}
            >
              <span className={`hamburger-icon${menuOpen ? ' hamburger-icon--open' : ''}`} aria-hidden="true">
                <span /><span /><span />
              </span>
            </button>

            <nav
              id="main-nav"
              className={`header__nav${menuOpen ? ' header__nav--open' : ''}`}
              aria-label="Main navigation"
            >
              <Link to="/dashboard" className={navClass('/dashboard')}>
                Dashboard
              </Link>
              <Link to="/profile" className={navClass('/profile')}>
                Profile
              </Link>
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                onClick={handleLogout}
              >
                Log out
              </button>
            </nav>
          </>
        ) : (
          <nav className="header__nav" aria-label="Main navigation">
            <Link to="/login" className="btn btn--primary btn--sm">
              Log in
            </Link>
          </nav>
        )}
      </div>
    </header>
  );
}

export default Header;
