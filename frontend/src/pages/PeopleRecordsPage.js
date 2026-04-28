import React, { useEffect, useState } from 'react';
import * as client from '../api/drupalClient';

function PeopleRecordsPage() {
  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    client.get('/jsonapi/node/person?sort=-created')
      .then((data) => setPeople(data.data || []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="page-content container">
      <h1>People Records</h1>
      <p className="form-hint" style={{ marginBottom: '1.5rem' }}>
        Reusable contact records for guardians and emergency contacts that can be referenced across applications.
      </p>

      {loading && (
        <div className="loading-container" aria-live="polite">
          <span className="loading-spinner" aria-hidden="true" />
          Loading people…
        </div>
      )}
      {error && <div className="alert alert-error" role="alert">{error}</div>}

      {!loading && people.length === 0 && (
        <div className="empty-state">
          <h3>No people records yet</h3>
          <p>Person records are created during the application process.</p>
        </div>
      )}

      <div className="records-grid">
        {people.map((person) => {
          const attrs = person.attributes || {};
          const name = [attrs.field_given_name, attrs.field_surname].filter(Boolean).join(' ') || attrs.title || 'Unnamed';
          const relationship = attrs.field_relationship_to_student || '';
          return (
            <div key={person.id} className="person-card">
              <div className="person-card-header">
                <div>
                  <div className="person-card-name">{name}</div>
                  {relationship && (
                    <div className="person-card-role">{relationship.replace(/_/g, ' ')}</div>
                  )}
                </div>
              </div>
              {attrs.field_workplace && (
                <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', margin: '0.25rem 0' }}>
                  Workplace: {attrs.field_workplace}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </main>
  );
}

export default PeopleRecordsPage;
