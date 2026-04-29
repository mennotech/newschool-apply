import React, { useState } from 'react';

function AlertBanner({ type = 'info', message, onDismiss }) {
  const [visible, setVisible] = useState(true);

  if (!visible || !message) return null;

  function handleDismiss() {
    setVisible(false);
    if (onDismiss) onDismiss();
  }

  return (
    <div className={`alert alert-${type}`} role="alert" aria-live="polite">
      <div className="alert-content">{message}</div>
      <button
        className="alert-dismiss"
        onClick={handleDismiss}
        aria-label="Dismiss alert"
      >
        &times;
      </button>
    </div>
  );
}

export default AlertBanner;
