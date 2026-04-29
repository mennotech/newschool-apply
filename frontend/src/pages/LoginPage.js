import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { loginUser } from '../store/slices/authSlice';

function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});

  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const next = searchParams.get('next') || '/dashboard';

  const user = useSelector((state) => state.auth.user);
  const status = useSelector((state) => state.auth.status);
  const authError = useSelector((state) => state.auth.error);

  const drupalBase = process.env.REACT_APP_DRUPAL_BASE_URL || 'http://localhost:8080';

  // Redirect if already authenticated
  useEffect(() => {
    if (user) {
      navigate(next, { replace: true });
    }
  }, [user, navigate, next]);

  function validate() {
    const errs = {};
    if (!email.trim()) errs.email = 'Email is required';
    if (!password) errs.password = 'Password is required';
    return errs;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    setErrors({});
    dispatch(loginUser({ name: email, pass: password }));
  }

  const isLoading = status === 'loading';

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>Sign In</h1>
        <p className="auth-subtitle">Sign in to your NewSchool Apply account</p>

        {authError && (
          <div className="alert alert-error" role="alert">
            <div className="alert-content">{authError}</div>
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label htmlFor="login-email">
              Email or Username<span className="required-mark" aria-hidden="true">*</span>
            </label>
            <input
              id="login-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              aria-required="true"
              aria-invalid={errors.email ? 'true' : 'false'}
              aria-describedby={errors.email ? 'login-email-error' : undefined}
              disabled={isLoading}
            />
            {errors.email && (
              <span id="login-email-error" className="field-error" role="alert">
                {errors.email}
              </span>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="login-password">
              Password<span className="required-mark" aria-hidden="true">*</span>
            </label>
            <input
              id="login-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              aria-required="true"
              aria-invalid={errors.password ? 'true' : 'false'}
              aria-describedby={errors.password ? 'login-password-error' : undefined}
              disabled={isLoading}
            />
            {errors.password && (
              <span id="login-password-error" className="field-error" role="alert">
                {errors.password}
              </span>
            )}
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%' }}
            disabled={isLoading}
          >
            {isLoading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <div className="auth-divider">or continue with</div>

        <a
          href={`${drupalBase}/oauth/authorize/google`}
          className="social-login-btn"
          aria-label="Sign in with Google"
        >
          <span aria-hidden="true">G</span> Sign in with Google
        </a>
        <a
          href={`${drupalBase}/oauth/authorize/microsoft`}
          className="social-login-btn"
          aria-label="Sign in with Microsoft"
        >
          <span aria-hidden="true">M</span> Sign in with Microsoft
        </a>

        <p className="auth-link">
          Don't have an account? <Link to="/register">Create one</Link>
        </p>
      </div>
    </div>
  );
}

export default LoginPage;
