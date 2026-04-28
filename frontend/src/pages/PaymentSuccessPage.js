import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import * as client from '../api/drupalClient';

const MAX_POLLS = 10;
const POLL_INTERVAL = 3000;

function PaymentSuccessPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const sessionId = new URLSearchParams(location.search).get('session_id');
  const [status, setStatus] = useState('polling');
  const [receiptUrl, setReceiptUrl] = useState(null);
  const pollCount = useRef(0);

  useEffect(() => {
    if (!sessionId) {
      setStatus('error');
      return;
    }

    const poll = async () => {
      try {
        const data = await client.get(`/api/payments/checkout-status?session_id=${encodeURIComponent(sessionId)}`);
        if (data.status === 'paid') {
          setStatus('paid');
          if (data.receipt_url) setReceiptUrl(data.receipt_url);
          return;
        }
      } catch {}

      pollCount.current += 1;
      if (pollCount.current >= MAX_POLLS) {
        setStatus('timeout');
        return;
      }
      setTimeout(poll, POLL_INTERVAL);
    };

    poll();
  }, [sessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <main className="page-content">
      <div className="payment-success">
        {status === 'polling' && (
          <>
            <div className="loading-container">
              <span className="loading-spinner" aria-hidden="true" />
              Confirming your payment…
            </div>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
              This may take a few moments. Please do not close this page.
            </p>
          </>
        )}

        {status === 'paid' && (
          <>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✅</div>
            <h1>Payment Confirmed!</h1>
            <p>Your payment was processed successfully and your application has been submitted.</p>
            {receiptUrl && (
              <p>
                <a href={receiptUrl} target="_blank" rel="noopener noreferrer">
                  View Receipt
                </a>
              </p>
            )}
            <Link to="/dashboard" className="btn btn-primary" style={{ marginTop: '1rem' }}>
              Go to Dashboard
            </Link>
          </>
        )}

        {status === 'timeout' && (
          <>
            <div className="alert alert-warning" role="alert">
              <h2 style={{ fontSize: '1.1rem' }}>Payment Confirmation Pending</h2>
              <p>
                We could not confirm your payment status at this time. If you completed payment,
                it may take a few minutes to reflect. Please check your dashboard.
              </p>
            </div>
            <Link to="/dashboard" className="btn btn-primary" style={{ marginTop: '1rem' }}>
              Go to Dashboard
            </Link>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="alert alert-error" role="alert">
              Invalid payment session. Please contact support if you believe this is an error.
            </div>
            <Link to="/dashboard" className="btn btn-primary" style={{ marginTop: '1rem' }}>
              Go to Dashboard
            </Link>
          </>
        )}
      </div>
    </main>
  );
}

export default PaymentSuccessPage;
