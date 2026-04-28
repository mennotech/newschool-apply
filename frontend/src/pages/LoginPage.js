import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { loginUser, selectAuthStatus, selectAuthError } from '../store/slices/authSlice';

function LoginPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const status = useSelector(selectAuthStatus);
  const error = useSelector(selectAuthError);

  const [name, setName] = useState('');
  const [pass, setPass] = useState('');
  const [errors, setErrors] = useState({});

  const nextPath = new URLSearchParams(location.search).get('next') || '/dashboard';
  const BASE = process.env.REACT_APP_DRUPAL_BASE_URL || 'http://localhost:8080';

  function validate() {
    const e = {};
    if (!name.trim()) e.name = 'Username or email is required.';
    if (!pass) e.pass = 'Password is required.';
    return e;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const e2 = validate();
    if (Object.keys(e2).length) {
      setErrors(e2);
      return;
    }
    setErrors({});
    const result = await dispatch(loginUser({ name: name.trim(), pass }));
    if (loginUser.fulfilled.match(result)) {
      navigate(nextPath, { replace: true });
    }
  }

  return (
    <main className="auth-page">
      <div className="auth-card">
        <div className="auth-title">
          <h1 style={{ fontSize: '1.5rem' }}>Sign In</h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', margin: 0 }}>
            Sign in to your NewSchool Apply account
          </p>
        </div>

        {error && (
          <div className="alert alert-error" role="alert">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label htmlFor="login-name">
              Username or Email <span className="required" aria-hidden="true">*</span>
            </label>
            <input
              id="login-name"
              type="text"
              className="form-control"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="username"
              aria-required="true"
              aria-invalid={errors.name ? 'true' : 'false'}
              aria-describedby={errors.name ? 'login-name-error' : undefined}
            />
            {errors.name && (
              <span id="login-name-error" className="field-error" role="alert">
                {errors.name}
              </span>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="login-pass">
              Password <span className="required" aria-hidden="true">*</span>
            </label>
            <input
              id="login-pass"
              type="password"
              className="form-control"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              autoComplete="current-password"
              aria-required="true"
              aria-invalid={errors.pass ? 'true' : 'false'}
              aria-describedby={errors.pass ? 'login-pass-error' : undefined}
            />
            {errors.pass && (
              <span id="login-pass-error" className="field-error" role="alert">
                {errors.pass}
              </span>
            )}
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%' }}
            disabled={status === 'loading'}
          >
            {status === 'loading' ? (
              <>
                <span className="loading-spinner" aria-hidden="true" />
                Signing in…
              </>
            ) : (
              'Sign In'
            )}
          </button>
        </form>

        <div className="auth-divider">or</div>

        <a
          href={`${BASE}/oauth/authorize/google`}
          className="social-btn"
          aria-label="Sign in with Google"
        >
          Sign in with Google
        </a>
        <a
          href={`${BASE}/oauth/authorize/microsoft`}
          className="social-btn"
          aria-label="Sign in with Microsoft"
        >
          Sign in with Microsoft
        </a>

        <p style={{ textAlign: 'center', marginTop: '1rem', fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
          Don&apos;t have an account?{' '}
          <Link to="/register">Create one</Link>
        </p>
      </div>
    </main>
  );
}

export default LoginPage;
