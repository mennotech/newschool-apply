import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { configureStore } from '@reduxjs/toolkit';
import { rest } from 'msw';
import { server } from '../mocks/server';
import authReducer from '../store/slices/authSlice';
import applicationReducer from '../store/slices/applicationSlice';
import ApplicationPage from './ApplicationPage';

jest.mock('../components/steps/CommitmentStep', () => {
  return function MockCommitmentStep() {
    return (
      <section aria-labelledby="commitment-heading">
        <h2 id="commitment-heading">Statement of Commitment</h2>
        <button type="button">Submit Application</button>
      </section>
    );
  };
});

process.env.REACT_APP_DRUPAL_BASE_URL = 'http://localhost:8080';

function renderApp({ initialPath = '/apply/student-info', preloadedApplication = {} } = {}) {
  const store = configureStore({
    reducer: { auth: authReducer, application: applicationReducer },
    preloadedState: {
      auth: { user: { uid: '1', name: 'testuser' }, status: 'idle', error: null },
      application: {
        currentApplication: null,
        applications: [],
        fetchStatus: 'idle',
        steps: [],
        status: 'idle',
        error: null,
        ...preloadedApplication,
      },
    },
  });
  render(
    <Provider store={store}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/apply/:step" element={<ApplicationPage />} />
          <Route path="/apply" element={<ApplicationPage />} />
        </Routes>
      </MemoryRouter>
    </Provider>
  );
  return { store };
}

describe('ApplicationPage', () => {
  describe('Step 1 — Student Information', () => {
    it('renders the student info form', () => {
      renderApp();
      expect(screen.getByRole('heading', { name: /student information/i })).toBeInTheDocument();
      expect(screen.getByLabelText(/^first name$/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/^last name$/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/date of birth/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/applying for grade/i)).toBeInTheDocument();
    });

    it('shows validation errors when submitting empty form', async () => {
      renderApp();
      await userEvent.click(screen.getByRole('button', { name: /next/i }));
      expect(await screen.findByText(/first name is required/i)).toBeInTheDocument();
      expect(screen.getByText(/last name is required/i)).toBeInTheDocument();
      expect(screen.getByText(/date of birth is required/i)).toBeInTheDocument();
      expect(screen.getByText(/applying for grade is required/i)).toBeInTheDocument();
    });

    it('advances to Health Information step after valid submission', async () => {
      renderApp();
      await userEvent.type(screen.getByLabelText(/^first name$/i), 'Roland');
      await userEvent.type(screen.getByLabelText(/^last name$/i), 'Penner');
      await userEvent.type(screen.getByLabelText(/date of birth/i), '2010-04-23');
      await userEvent.type(screen.getByLabelText(/applying for grade/i), 'Grade 7');
      await userEvent.type(screen.getByLabelText(/primary.*phone/i), '2045551234');
      await userEvent.type(document.querySelector('input[name="physical_address_line_1"]'), '123 Main St');
      await userEvent.type(document.querySelector('input[name="physical_city"]'), 'Steinbach');
      await userEvent.type(document.querySelector('input[name="physical_state_province"]'), 'MB');
      await userEvent.type(document.querySelector('input[name="physical_postal_zip"]'), 'R5G 1A1');
      // radio buttons
      await userEvent.click(screen.getByRole('radio', { name: /^male$/i }));
      await userEvent.click(screen.getAllByRole('radio', { name: /^no$/i })[0]);
      await userEvent.click(screen.getAllByRole('radio', { name: /^no$/i })[1]);
      await userEvent.click(screen.getByRole('radio', { name: /canadian citizen/i }));
      await userEvent.click(screen.getByRole('button', { name: /next/i }));

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /health information/i })).toBeInTheDocument();
      });
    });

    it('restores student information values when navigating back from Health Information', async () => {
      renderApp();
      await userEvent.type(screen.getByLabelText(/^first name$/i), 'Roland');
      await userEvent.type(screen.getByLabelText(/^last name$/i), 'Penner');
      await userEvent.type(screen.getByLabelText(/date of birth/i), '2010-04-23');
      await userEvent.type(screen.getByLabelText(/applying for grade/i), 'Grade 7');
      await userEvent.type(screen.getByLabelText(/primary.*phone/i), '2045551234');
      await userEvent.type(document.querySelector('input[name="physical_address_line_1"]'), '123 Main St');
      await userEvent.type(document.querySelector('input[name="physical_city"]'), 'Steinbach');
      await userEvent.type(document.querySelector('input[name="physical_state_province"]'), 'MB');
      await userEvent.type(document.querySelector('input[name="physical_postal_zip"]'), 'R5G 1A1');
      await userEvent.click(screen.getByRole('radio', { name: /^male$/i }));
      await userEvent.click(screen.getAllByRole('radio', { name: /^no$/i })[0]);
      await userEvent.click(screen.getAllByRole('radio', { name: /^no$/i })[1]);
      await userEvent.click(screen.getByRole('radio', { name: /canadian citizen/i }));
      await userEvent.click(screen.getByRole('button', { name: /next/i }));

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /health information/i })).toBeInTheDocument();
      });

      await userEvent.click(screen.getByRole('button', { name: /back/i }));

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /student information/i })).toBeInTheDocument();
      });
      expect(screen.getByLabelText(/^first name$/i)).toHaveValue('Roland');
      expect(screen.getByLabelText(/^last name$/i)).toHaveValue('Penner');
      expect(screen.getByLabelText(/date of birth/i)).toHaveValue('2010-04-23');
      expect(screen.getByLabelText(/applying for grade/i)).toHaveValue('Grade 7');
    });
  });

  describe('Step 2 — Health Information', () => {
    it('renders the health information form', () => {
      renderApp({ initialPath: '/apply/health-info' });
      expect(screen.getByRole('heading', { name: /health information/i })).toBeInTheDocument();
      expect(screen.getByLabelText(/mb health.*9 digit/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/emergency contact name/i)).toBeInTheDocument();
    });

    it('shows validation errors when required fields are empty', async () => {
      renderApp({ initialPath: '/apply/health-info' });
      await userEvent.click(screen.getByRole('button', { name: /next/i }));
      expect(await screen.findByText(/mb health.*9 digit.*required/i)).toBeInTheDocument();
      expect(screen.getByText(/emergency contact name is required/i)).toBeInTheDocument();
    });
  });

  describe('Step 6 — Statement of Commitment', () => {
    it('renders the commitment step with signature canvas', async () => {
      renderApp({
        initialPath: '/apply/commitment',
        preloadedApplication: {
          currentApplication: { id: 'mock-app-id', attributes: { field_status: 'pending' } },
          status: 'idle',
        },
      });
      // Hydration fetch resolves first (MSW returns immediately), then step renders
      expect(await screen.findByRole('heading', { name: /statement of commitment/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /submit application/i })).toBeInTheDocument();
    });
  });

  describe('Resume and autosave', () => {
    it('creates a draft and autosaves on step 1 blur for a brand new application', async () => {
      let created = false;
      let patchedBody;

      server.use(
        rest.post('http://localhost:8080/jsonapi/node/application', (req, res, ctx) => {
          created = true;
          return res(
            ctx.status(201),
            ctx.json({
              data: {
                id: 'new-draft-id',
                type: 'node--application',
                attributes: { field_status: 'pending' },
              },
            })
          );
        }),
        rest.patch('http://localhost:8080/jsonapi/node/application/:id', async (req, res, ctx) => {
          patchedBody = await req.json();
          return res(
            ctx.status(200),
            ctx.json({
              data: {
                id: req.params.id,
                type: 'node--application',
                attributes: patchedBody.data.attributes || {},
              },
            })
          );
        })
      );

      renderApp({ initialPath: '/apply/student-info' });

      await userEvent.type(screen.getByLabelText(/^first name$/i), 'Alice');
      await userEvent.tab();

      await waitFor(() => {
        expect(created).toBe(true);
        expect(patchedBody?.data?.attributes?.field_student_first_name).toBe('Alice');
      });
    });

    it('creates address nodes and links them on student info submit', async () => {
      const createdAddresses = [];
      let patchedBody;

      server.use(
        rest.post('http://localhost:8080/jsonapi/node/address', async (req, res, ctx) => {
          const body = await req.json();
          createdAddresses.push(body);
          return res(
            ctx.status(201),
            ctx.json({
              data: {
                id: `address-${createdAddresses.length}`,
                type: 'node--address',
                attributes: body.data.attributes,
              },
            })
          );
        }),
        rest.patch('http://localhost:8080/jsonapi/node/application/:id', async (req, res, ctx) => {
          patchedBody = await req.json();
          return res(
            ctx.status(200),
            ctx.json({
              data: {
                id: req.params.id,
                type: 'node--application',
                attributes: patchedBody.data.attributes || {},
                relationships: patchedBody.data.relationships || {},
              },
            })
          );
        })
      );

      renderApp({ initialPath: '/apply/student-info' });

      await screen.findByLabelText(/^first name$/i);

      await userEvent.type(screen.getByLabelText(/^first name$/i), 'Alice');
      await userEvent.type(screen.getByLabelText(/^last name$/i), 'Smith');
      await userEvent.type(screen.getByLabelText(/date of birth/i), '2010-01-15');
      await userEvent.type(screen.getByLabelText(/applying for grade/i), 'Grade 7');
      await userEvent.type(screen.getByLabelText(/primary.*phone/i), '2045551234');
      await userEvent.type(document.querySelector('input[name="physical_address_line_1"]'), '1 Main St');
      await userEvent.type(document.querySelector('input[name="physical_city"]'), 'Steinbach');
      await userEvent.type(document.querySelector('input[name="physical_state_province"]'), 'MB');
      await userEvent.type(document.querySelector('input[name="physical_postal_zip"]'), 'R5G 1A1');
      await userEvent.click(screen.getByRole('radio', { name: /^female$/i }));
      await userEvent.click(screen.getByRole('radio', { name: /canadian citizen/i }));
      await userEvent.click(screen.getAllByRole('radio', { name: /^yes$/i })[0]);

      const mailingLine1Input = document.querySelector('input[name="mailing_address_line_1"]');
      const mailingCityInput = document.querySelector('input[name="mailing_address_city"]');
      const mailingStateInput = document.querySelector('input[name="mailing_address_state_province"]');
      const mailingPostalInput = document.querySelector('input[name="mailing_address_postal_zip"]');
      expect(mailingLine1Input).toBeTruthy();
      expect(mailingCityInput).toBeTruthy();
      expect(mailingStateInput).toBeTruthy();
      expect(mailingPostalInput).toBeTruthy();
      await userEvent.type(mailingLine1Input, '55 Mailing Rd');
      await userEvent.type(mailingCityInput, 'Winnipeg');
      await userEvent.type(mailingStateInput, 'MB');
      await userEvent.type(mailingPostalInput, 'R3C 0A1');
      await userEvent.click(screen.getAllByRole('radio', { name: /^no$/i })[1]);
      await userEvent.click(screen.getByRole('button', { name: /next/i }));

      await waitFor(() => {
        expect(createdAddresses.length).toBeGreaterThanOrEqual(2);
        const physicalId = patchedBody?.data?.relationships?.field_physical_address?.data?.id;
        const mailingId = patchedBody?.data?.relationships?.field_mailing_address?.data?.id;
        expect(physicalId).toBeTruthy();
        expect(mailingId).toBeTruthy();
        expect(physicalId).not.toBe(mailingId);
      });
    });

    it('fetches and hydrates step data when resuming a draft', async () => {
      server.use(
        rest.get('http://localhost:8080/jsonapi/node/application/:id', (req, res, ctx) => {
          return res(
            ctx.status(200),
            ctx.json({
              data: {
                id: req.params.id,
                type: 'node--application',
                attributes: {
                  field_status: 'pending',
                  field_student_first_name: 'Jane',
                  field_student_last_name: 'Doe',
                },
              },
            })
          );
        })
      );
      renderApp({
        initialPath: '/apply/student-info',
        preloadedApplication: {
          currentApplication: { id: 'draft-app-id', type: 'node--application', attributes: { field_status: 'pending' } },
        },
      });
      // Loading state while fetching
      expect(screen.getByText(/loading draft/i)).toBeInTheDocument();
      // After hydration, form renders with data from Drupal
      expect(await screen.findByLabelText(/^first name$/i)).toHaveValue('Jane');
      expect(screen.getByLabelText(/^last name$/i)).toHaveValue('Doe');
    });

    it('autosaves a field on blur when an application is active', async () => {
      let patchedBody;
      server.use(
        rest.patch('http://localhost:8080/jsonapi/node/application/:id', async (req, res, ctx) => {
          patchedBody = await req.json();
          return res(
            ctx.status(200),
            ctx.json({
              data: { id: req.params.id, type: 'node--application', attributes: patchedBody.data.attributes },
            })
          );
        })
      );
      renderApp({
        initialPath: '/apply/health-info',
        preloadedApplication: {
          currentApplication: { id: 'draft-app-id', type: 'node--application', attributes: { field_status: 'pending' } },
        },
      });
      // Wait for hydration to complete
      await screen.findByRole('heading', { name: /health information/i });
      await userEvent.type(screen.getByLabelText(/mb health.*9 digit/i), '123456789');
      await userEvent.tab();
      await waitFor(() => {
        expect(patchedBody?.data?.attributes?.field_mb_health_number_9_digit).toBe('123456789');
      });
    });

    it('allows jumping to later steps from top buttons after student info is complete', async () => {
      server.use(
        rest.get('http://localhost:8080/jsonapi/node/application/:id', (req, res, ctx) => {
          return res(
            ctx.status(200),
            ctx.json({
              data: {
                id: req.params.id,
                type: 'node--application',
                attributes: {
                  field_status: 'pending',
                  field_student_first_name: 'Jane',
                  field_student_last_name: 'Doe',
                  field_student_birth_date: '2011-02-03',
                  field_student_applying_for_grade: 'Grade 5',
                  field_primary_home_phone: '2045551234',
                  field_physical_address_line_1: '1 Main St',
                  field_physical_city: 'Steinbach',
                  field_physical_state_province: 'MB',
                  field_physical_postal_zip: 'R5G 1A1',
                  field_student_gender: 'female',
                  field_citizenship_status: 'canadian_citizen',
                  field_mailing_address_differs: 'no',
                  field_attended_mb_school_before: 'no',
                },
              },
            })
          );
        })
      );

      renderApp({
        initialPath: '/apply/student-info',
        preloadedApplication: {
          currentApplication: { id: 'draft-app-id', type: 'node--application', attributes: { field_status: 'pending' } },
        },
      });

      // Wait for hydration to complete before interacting with step buttons
      await screen.findByLabelText(/^first name$/i);

      await userEvent.click(screen.getByRole('button', { name: /questionnaire/i }));
      expect(await screen.findByRole('heading', { name: /parent questionnaire/i })).toBeInTheDocument();
    });

    it('shows student info as completed after hydration from Drupal', async () => {
      server.use(
        rest.get('http://localhost:8080/jsonapi/node/application/:id', (req, res, ctx) => {
          return res(
            ctx.status(200),
            ctx.json({
              data: {
                id: req.params.id,
                type: 'node--application',
                attributes: {
                  field_status: 'pending',
                  field_student_first_name: 'Jane',
                  field_student_last_name: 'Doe',
                  field_student_birth_date: '2011-02-03',
                  field_student_applying_for_grade: 'Grade 5',
                  field_primary_home_phone: '2045551234',
                  field_physical_address_line_1: '1 Main St',
                  field_physical_city: 'Steinbach',
                  field_physical_state_province: 'MB',
                  field_physical_postal_zip: 'R5G 1A1',
                  field_student_gender: 'female',
                  field_citizenship_status: 'canadian_citizen',
                  field_mailing_address_differs: 'no',
                  field_attended_mb_school_before: 'no',
                },
              },
            })
          );
        })
      );

      renderApp({
        initialPath: '/apply/student-info',
        preloadedApplication: {
          currentApplication: { id: 'draft-app-id', type: 'node--application', attributes: { field_status: 'pending' } },
        },
      });

      await screen.findByLabelText(/^first name$/i);
      const studentStep = screen.getByRole('button', { name: /student info - completed/i });
      expect(studentStep).toBeInTheDocument();
      expect(studentStep).not.toBeDisabled();
    });

    it('creates guardian address nodes and links them on parent info submit', async () => {
      const createdAddresses = [];
      let patchedBody;

      server.use(
        rest.post('http://localhost:8080/jsonapi/node/address', async (req, res, ctx) => {
          const body = await req.json();
          createdAddresses.push(body);
          return res(
            ctx.status(201),
            ctx.json({
              data: {
                id: `guardian-address-${createdAddresses.length}`,
                type: 'node--address',
                attributes: body.data.attributes,
              },
            })
          );
        }),
        rest.patch('http://localhost:8080/jsonapi/node/application/:id', async (req, res, ctx) => {
          patchedBody = await req.json();
          return res(
            ctx.status(200),
            ctx.json({
              data: {
                id: req.params.id,
                type: 'node--application',
                attributes: patchedBody.data.attributes || {},
                relationships: patchedBody.data.relationships || {},
              },
            })
          );
        })
      );

      renderApp({
        initialPath: '/apply/parent-info',
        preloadedApplication: {
          currentApplication: { id: 'draft-app-id', type: 'node--application', attributes: { field_status: 'pending' } },
        },
      });

      await screen.findByRole('heading', { name: /parent \/ guardian information/i });

      await userEvent.click(screen.getByRole('radio', { name: /^divorced$/i }));
      await userEvent.click(screen.getAllByRole('radio', { name: /^mother$/i })[0]);
      await userEvent.click(screen.getByRole('radio', { name: /^joint$/i }));

      const noRadios = screen.getAllByRole('radio', { name: /^no$/i });
      await userEvent.click(noRadios[0]);
      await userEvent.click(noRadios[1]);

      await userEvent.type(document.querySelector('input[name="father_address_line_1"]'), '10 Father Rd');
      await userEvent.type(document.querySelector('input[name="father_address_city"]'), 'Steinbach');
      await userEvent.type(document.querySelector('input[name="father_address_state_province"]'), 'MB');
      await userEvent.type(document.querySelector('input[name="father_address_postal_zip"]'), 'R5G 1A1');

      await userEvent.type(document.querySelector('input[name="mother_address_line_1"]'), '20 Mother Rd');
      await userEvent.type(document.querySelector('input[name="mother_address_city"]'), 'Winnipeg');
      await userEvent.type(document.querySelector('input[name="mother_address_state_province"]'), 'MB');
      await userEvent.type(document.querySelector('input[name="mother_address_postal_zip"]'), 'R3C 0A1');

      await userEvent.click(screen.getByRole('button', { name: /next/i }));

      await waitFor(() => {
        expect(createdAddresses).toHaveLength(2);
        expect(patchedBody?.data?.relationships?.field_father_address?.data?.id).toBe('guardian-address-1');
        expect(patchedBody?.data?.relationships?.field_mother_address?.data?.id).toBe('guardian-address-2');
      });
    });
  });
});
