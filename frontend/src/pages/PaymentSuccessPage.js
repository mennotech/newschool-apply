import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { get } from '../api/drupalClient';

const MAX_POLLS = 10;
const POLL_INTERVAL_MS = 3000;

function PaymentSuccessPage() {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session_id') || '';

  const [status, setStatus] = useState('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (!sessionId) {
      setStatus('missing');
      return;
    }

    let cancelled = false;
    let attempts = 0;

    async function pollStatus() {
      try {
        const data = await get(`/api/payments/checkout-status?session_id=${encodeURIComponent(sessionId)}`);
        if (cancelled) return;

        setResult(data);

        if (data.payment_confirmed && data.application_submitted) {
          setStatus('confirmed');
          return;
        }

        if (attempts < MAX_POLLS) {
          attempts += 1;
          setStatus('pending');
          setTimeout(pollStatus, POLL_INTERVAL_MS);
          return;
        }

        setStatus('error');
        setErrorMessage('Payment is not yet confirmed. Please refresh this page in a moment.');
      } catch (err) {
        if (cancelled) return;

        if ((err.status === 404 || err.status === 409) && attempts < MAX_POLLS) {
          attempts += 1;
          setStatus('pending');
          setTimeout(pollStatus, POLL_INTERVAL_MS);
          return;
        }

        if (err.status === 401 || err.status === 403) {
          setStatus('error');
          setErrorMessage('Please sign in to view payment confirmation status.');
          return;
        }

        setStatus('error');
        setErrorMessage(err.message || 'Unable to verify payment status.');
      }
    }

    pollStatus();

    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  if (status === 'missing') {
    return (
      <main className="page">
        <div className="container" style={{ maxWidth: '720px' }}>
          <h1>Payment Confirmation</h1>
          <p>Missing payment session information. Please return to your dashboard and try again.</p>
          <Link className="btn btn--primary" to="/dashboard">Go to Dashboard</Link>
        </div>
      </main>
    );
  }

  if (status === 'loading' || status === 'pending') {
    return (
      <main className="page">
        <div className="container" style={{ maxWidth: '720px' }}>
          <h1>Finalizing Your Payment</h1>
          <p>We are confirming your payment with our backend. This can take a few seconds.</p>
        </div>
      </main>
    );
  }

  if (status === 'confirmed') {
    return (
      <main className="page">
        <div className="container" style={{ maxWidth: '720px' }}>
          <h1>Thank You, Payment Received</h1>
          <p>Your payment has been received and your form has been submitted.</p>
          {result?.confirmation_number && (
            <p>
              <strong>Confirmation number:</strong> {result.confirmation_number}
            </p>
          )}
          {result?.receipt_url && (
            <p>
              <a
                className="btn btn--secondary"
                href={result.receipt_url}
                target="_blank"
                rel="noopener noreferrer"
              >
                View Receipt
              </a>
            </p>
          )}
          <Link className="btn btn--primary" to="/dashboard">Go to Dashboard</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="page">
      <div className="container" style={{ maxWidth: '720px' }}>
        <h1>Payment Pending</h1>
        <p>{errorMessage || 'Your payment has not been confirmed yet.'}</p>
        <Link className="btn btn--primary" to="/dashboard">Go to Dashboard</Link>
      </div>
    </main>
  );
}

export default PaymentSuccessPage;
