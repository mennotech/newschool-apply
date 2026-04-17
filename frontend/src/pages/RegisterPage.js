import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, Link } from 'react-router-dom';
import { registerUser } from '../store/slices/authSlice';

function RegisterPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { status, error, user } = useSelector((state) => state.auth);

  const [mail, setMail] = useState('');
  const [pass, setPass] = useState('');
  const [passConfirm, setPassConfirm] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [successMessage, setSuccessMessage] = useState(null);

  // If already authenticated, go straight to dashboard
  useEffect(() => {
    if (user) {
      navigate('/dashboard', { replace: true });
    }
  }, [user, navigate]);

  function validate() {
    const errors = {};
    if (!mail.trim()) {
      errors.mail = 'Email address is required.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail.trim())) {
      errors.mail = 'Please enter a valid email address.';
    }
    if (!pass) {
      errors.pass = 'Password is required.';
    } else if (pass.length < 8) {
      errors.pass = 'Password must be at least 8 characters.';
    }
    if (!passConfirm) {
      errors.passConfirm = 'Please confirm your password.';
    } else if (pass !== passConfirm) {
      errors.passConfirm = 'Passwords do not match.';
    }
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
    const result = await dispatch(registerUser({ mail: mail.trim(), pass }));
    if (registerUser.fulfilled.match(result)) {
      setSuccessMessage(
        'Account created! Please check your email to activate your account, then log in.'
      );
    }
  }

  if (successMessage) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <h1 className="auth-card__title">Check Your Email</h1>
          <div className="form-alert form-alert--success" role="status">
            {successMessage}
          </div>
          <Link to="/login" className="btn btn--primary btn--full" style={{ marginTop: '1rem' }}>
            Go to Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="auth-card__title">Create Account</h1>
        <p className="auth-card__subtitle">
          Sign up to start your application.
        </p>

        <form onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label className="form-label" htmlFor="register-mail">Email address</label>
            <input
              id="register-mail"
              type="email"
              className="form-input"
              value={mail}
              onChange={(e) => setMail(e.target.value)}
              aria-describedby={fieldErrors.mail ? 'register-mail-error' : undefined}
              aria-invalid={fieldErrors.mail ? 'true' : undefined}
              autoComplete="email"
            />
            {fieldErrors.mail && (
              <span id="register-mail-error" className="form-error" role="alert">
                {fieldErrors.mail}
              </span>
            )}
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="register-pass">Password</label>
            <input
              id="register-pass"
              type="password"
              className="form-input"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              aria-describedby={fieldErrors.pass ? 'register-pass-error' : undefined}
              aria-invalid={fieldErrors.pass ? 'true' : undefined}
              autoComplete="new-password"
            />
            {fieldErrors.pass && (
              <span id="register-pass-error" className="form-error" role="alert">
                {fieldErrors.pass}
              </span>
            )}
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="register-pass-confirm">Confirm password</label>
            <input
              id="register-pass-confirm"
              type="password"
              className="form-input"
              value={passConfirm}
              onChange={(e) => setPassConfirm(e.target.value)}
              aria-describedby={fieldErrors.passConfirm ? 'register-pass-confirm-error' : undefined}
              aria-invalid={fieldErrors.passConfirm ? 'true' : undefined}
              autoComplete="new-password"
            />
            {fieldErrors.passConfirm && (
              <span id="register-pass-confirm-error" className="form-error" role="alert">
                {fieldErrors.passConfirm}
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
                Creating account…
              </>
            ) : (
              'Create account'
            )}
          </button>
        </form>

        <p className="auth-card__footer">
          Already have an account?{' '}
          <Link to="/login">Log in</Link>
        </p>
      </div>
    </div>
  );
}

export default RegisterPage;
