import React, { useEffect, useState } from 'react';
import * as client from '../api/drupalClient';

function AddressRecordsPage() {
  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    client.get('/jsonapi/node/address?sort=-created')
      .then((data) => setAddresses(data.data || []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  function formatAddress(attrs) {
    const parts = [
      attrs.field_address_line_1,
      attrs.field_address_line_2,
      attrs.field_address_city,
      attrs.field_address_state_province,
      attrs.field_address_postal_zip,
    ].filter(Boolean);
    return parts.join(', ') || 'No address details';
  }

  return (
    <main className="page-content container">
      <h1>Address Records</h1>
      <p className="form-hint" style={{ marginBottom: '1.5rem' }}>
        Reusable address records that can be referenced across applications and person records.
      </p>

      {loading && (
        <div className="loading-container" aria-live="polite">
          <span className="loading-spinner" aria-hidden="true" />
          Loading addresses…
        </div>
      )}
      {error && <div className="alert alert-error" role="alert">{error}</div>}

      {!loading && addresses.length === 0 && (
        <div className="empty-state">
          <h3>No address records yet</h3>
          <p>Address records are created during the application process.</p>
        </div>
      )}

      <div className="records-grid">
        {addresses.map((addr) => {
          const attrs = addr.attributes || {};
          return (
            <div key={addr.id} className="address-card">
              <p style={{ margin: 0, fontWeight: 500 }}>{formatAddress(attrs)}</p>
            </div>
          );
        })}
      </div>
    </main>
  );
}

export default AddressRecordsPage;
