import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { registerUser, selectAuthStatus, selectAuthError } from '../store/slices/authSlice';

function RegisterPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const status = useSelector(selectAuthStatus);
  const serverError = useSelector(selectAuthError);

  const [mail, setMail] = useState('');
  const [name, setName] = useState('');
  const [pass, setPass] = useState('');
  const [passConfirm, setPassConfirm] = useState('');
  const [errors, setErrors] = useState({});
  const [success, setSuccess] = useState(false);

  function validate() {
    const e = {};
    if (!mail.trim()) {
      e.mail = 'Email is required.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) {
      e.mail = 'Please enter a valid email address.';
    }
    if (!name.trim()) e.name = 'Username is required.';
    if (!pass) {
      e.pass = 'Password is required.';
    } else if (pass.length < 8) {
      e.pass = 'Password must be at least 8 characters.';
    }
    if (!passConfirm) {
      e.passConfirm = 'Please confirm your password.';
    } else if (pass !== passConfirm) {
      e.passConfirm = 'Passwords do not match.';
    }
    return e;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const validationErrors = validate();
    if (Object.keys(validationErrors).length) {
      setErrors(validationErrors);
      return;
    }
    setErrors({});
    const result = await dispatch(registerUser({ mail, pass, name }));
    if (registerUser.fulfilled.match(result)) {
      setSuccess(true);
    }
  }

  if (success) {
    return (
      <main className="auth-page">
        <div className="auth-card">
          <div className="alert alert-success" role="status">
            <h2 style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>Account Created!</h2>
            <p>Please check your email to verify your account, then{' '}
              <Link to="/login">sign in</Link>.
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="auth-page">
      <div className="auth-card">
        <div className="auth-title">
          <h1 style={{ fontSize: '1.5rem' }}>Create Account</h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', margin: 0 }}>
            Create a new NewSchool Apply account
          </p>
        </div>

        {serverError && (
          <div className="alert alert-error" role="alert">
            {serverError}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label htmlFor="reg-mail">
              Email <span className="required" aria-hidden="true">*</span>
            </label>
            <input
              id="reg-mail"
              type="email"
              className="form-control"
              value={mail}
              onChange={(e) => setMail(e.target.value)}
              autoComplete="email"
              aria-required="true"
              aria-invalid={errors.mail ? 'true' : 'false'}
              aria-describedby={errors.mail ? 'reg-mail-error' : undefined}
            />
            {errors.mail && (
              <span id="reg-mail-error" className="field-error" role="alert">
                {errors.mail}
              </span>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="reg-name">
              Username <span className="required" aria-hidden="true">*</span>
            </label>
            <input
              id="reg-name"
              type="text"
              className="form-control"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="username"
              aria-required="true"
              aria-invalid={errors.name ? 'true' : 'false'}
              aria-describedby={errors.name ? 'reg-name-error' : undefined}
            />
            {errors.name && (
              <span id="reg-name-error" className="field-error" role="alert">
                {errors.name}
              </span>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="reg-pass">
              Password <span className="required" aria-hidden="true">*</span>
            </label>
            <input
              id="reg-pass"
              type="password"
              className="form-control"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              autoComplete="new-password"
              aria-required="true"
              aria-invalid={errors.pass ? 'true' : 'false'}
              aria-describedby={errors.pass ? 'reg-pass-error' : 'reg-pass-hint'}
            />
            <span id="reg-pass-hint" className="form-hint">Minimum 8 characters</span>
            {errors.pass && (
              <span id="reg-pass-error" className="field-error" role="alert">
                {errors.pass}
              </span>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="reg-pass-confirm">
              Confirm Password <span className="required" aria-hidden="true">*</span>
            </label>
            <input
              id="reg-pass-confirm"
              type="password"
              className="form-control"
              value={passConfirm}
              onChange={(e) => setPassConfirm(e.target.value)}
              autoComplete="new-password"
              aria-required="true"
              aria-invalid={errors.passConfirm ? 'true' : 'false'}
              aria-describedby={errors.passConfirm ? 'reg-pass-confirm-error' : undefined}
            />
            {errors.passConfirm && (
              <span id="reg-pass-confirm-error" className="field-error" role="alert">
                {errors.passConfirm}
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
                Creating account…
              </>
            ) : (
              'Create Account'
            )}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: '1rem', fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </main>
  );
}

export default RegisterPage;
