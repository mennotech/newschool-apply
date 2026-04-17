import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { logoutUser } from '../store/slices/authSlice';

function Header() {
  const dispatch = useDispatch();
  const location = useLocation();
  const user = useSelector((state) => state.auth.user);

  async function handleLogout() {
    await dispatch(logoutUser());
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
          <nav className="header__nav" aria-label="Main navigation">
            <Link to="/dashboard" className={navClass('/dashboard')}>
              Dashboard
            </Link>
            <Link to="/apply" className={navClass('/apply')}>
              New Application
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
