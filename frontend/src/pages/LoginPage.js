import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { loginWithPassword } from '../store/slices/authSlice';

const DRUPAL_BASE_URL = process.env.REACT_APP_DRUPAL_BASE_URL;

function LoginPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { status, error, user } = useSelector((state) => state.auth);

  // If already authenticated, go straight to dashboard
  useEffect(() => {
    if (user) {
      navigate('/dashboard', { replace: true });
    }
  }, [user, navigate]);

  const [name, setName] = useState('');
  const [pass, setPass] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  function validate() {
    const errors = {};
    if (!name.trim()) errors.name = 'Username or email is required.';
    if (!pass) errors.pass = 'Password is required.';
    return errors;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const errors = validate();
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});
    const result = await dispatch(loginWithPassword({ name, pass }));
    if (loginWithPassword.fulfilled.match(result)) {
      navigate('/dashboard');
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="auth-card__title">Log In</h1>
        <p className="auth-card__subtitle">
          Sign in to manage your application.
        </p>

        <section aria-label="Social login options">
          <a href={`${DRUPAL_BASE_URL}/social-auth/google`} className="social-btn">
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" focusable="false">
              <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/>
              <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" fill="#34A853"/>
              <path d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707s.102-1.167.282-1.707V4.961H.957C.347 6.173 0 7.548 0 9s.348 2.827.957 4.039l3.007-2.332z" fill="#FBBC05"/>
              <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.961L3.964 7.293C4.672 5.166 6.656 3.58 9 3.58z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </a>
          <a href={`${DRUPAL_BASE_URL}/social-auth/microsoft`} className="social-btn">
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" focusable="false">
              <rect x="1" y="1" width="7.5" height="7.5" fill="#F25022"/>
              <rect x="9.5" y="1" width="7.5" height="7.5" fill="#7FBA00"/>
              <rect x="1" y="9.5" width="7.5" height="7.5" fill="#00A4EF"/>
              <rect x="9.5" y="9.5" width="7.5" height="7.5" fill="#FFB900"/>
            </svg>
            Continue with Microsoft
          </a>
        </section>

        <div className="auth-divider" aria-hidden="true">or</div>

        <form onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label className="form-label" htmlFor="login-name">Username or email</label>
            <input
              id="login-name"
              type="text"
              className="form-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              aria-describedby={fieldErrors.name ? 'login-name-error' : undefined}
              aria-invalid={fieldErrors.name ? 'true' : undefined}
              autoComplete="username"
            />
            {fieldErrors.name && (
              <span id="login-name-error" className="form-error" role="alert">
                {fieldErrors.name}
              </span>
            )}
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="login-pass">Password</label>
            <input
              id="login-pass"
              type="password"
              className="form-input"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              aria-describedby={fieldErrors.pass ? 'login-pass-error' : undefined}
              aria-invalid={fieldErrors.pass ? 'true' : undefined}
              autoComplete="current-password"
            />
            {fieldErrors.pass && (
              <span id="login-pass-error" className="form-error" role="alert">
                {fieldErrors.pass}
              </span>
            )}
          </div>

          {error && (
            <div className="form-alert form-alert--error" role="alert" aria-live="assertive">
              {error}
            </div>
          )}

          <button
            type="submit"
            className="btn btn--primary btn--full"
            disabled={status === 'loading'}
          >
            {status === 'loading' ? (
              <>
                <span className="spinner" aria-hidden="true" />
                Logging in…
              </>
            ) : (
              'Log in'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

export default LoginPage;

