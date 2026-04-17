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
    <main>
      <h1>Log In</h1>

      <form onSubmit={handleSubmit} noValidate>
        <div>
          <label htmlFor="login-name">Username or email</label>
          <input
            id="login-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-describedby={fieldErrors.name ? 'login-name-error' : undefined}
            aria-invalid={fieldErrors.name ? 'true' : undefined}
            autoComplete="username"
          />
          {fieldErrors.name && (
            <span id="login-name-error" role="alert">
              {fieldErrors.name}
            </span>
          )}
        </div>

        <div>
          <label htmlFor="login-pass">Password</label>
          <input
            id="login-pass"
            type="password"
            value={pass}
            onChange={(e) => setPass(e.target.value)}
            aria-describedby={fieldErrors.pass ? 'login-pass-error' : undefined}
            aria-invalid={fieldErrors.pass ? 'true' : undefined}
            autoComplete="current-password"
          />
          {fieldErrors.pass && (
            <span id="login-pass-error" role="alert">
              {fieldErrors.pass}
            </span>
          )}
        </div>

        {error && (
          <p role="alert" aria-live="assertive">
            {error}
          </p>
        )}

        <button type="submit" disabled={status === 'loading'}>
          {status === 'loading' ? 'Logging in…' : 'Log in'}
        </button>
      </form>

      <section aria-label="Social login options">
        <p>Or log in with:</p>
        <a href={`${DRUPAL_BASE_URL}/social-auth/google`}>Login with Google</a>
        <a href={`${DRUPAL_BASE_URL}/social-auth/microsoft`}>Login with Microsoft</a>
      </section>
    </main>
  );
}

export default LoginPage;
