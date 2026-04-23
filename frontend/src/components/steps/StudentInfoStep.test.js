import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { rest } from 'msw';
import { server } from '../../mocks/server';
import StudentInfoStep from './StudentInfoStep';

const BASE_URL = 'http://localhost:8080';
process.env.REACT_APP_DRUPAL_BASE_URL = BASE_URL;

describe('StudentInfoStep', () => {
  it('shows validation errors when required fields are empty', async () => {
    const onComplete = jest.fn();
    render(<StudentInfoStep onComplete={onComplete} />);

    await userEvent.click(screen.getByRole('button', { name: /next/i }));

    expect(await screen.findByText(/first name is required/i)).toBeInTheDocument();
    expect(screen.getByText(/last name is required/i)).toBeInTheDocument();
    expect(screen.getByText(/date of birth is required/i)).toBeInTheDocument();
    expect(screen.getByText(/applying for grade is required/i)).toBeInTheDocument();
    expect(screen.getByText(/please correct the highlighted fields before continuing/i)).toBeInTheDocument();
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('calls post with correct payload on valid submission', async () => {
    let capturedBody;
    server.use(
      rest.post(`${BASE_URL}/jsonapi/node/student_profile`, async (req, res, ctx) => {
        capturedBody = await req.json();
        return res(
          ctx.status(201),
          ctx.json({ data: { id: 'new-id', type: 'node--student_profile', attributes: capturedBody.data.attributes } })
        );
      }),
      rest.get(`${BASE_URL}/session/token`, (req, res, ctx) => res(ctx.text('t')))
    );

    const onComplete = jest.fn();
    render(<StudentInfoStep onComplete={onComplete} />);

    await userEvent.type(screen.getByLabelText(/^first name$/i), 'Alice');
    await userEvent.type(screen.getByLabelText(/^last name$/i), 'Smith');
    await userEvent.type(screen.getByLabelText(/date of birth/i), '2010-01-15');
    await userEvent.type(screen.getByLabelText(/applying for grade/i), 'Grade 5');
    await userEvent.type(screen.getByLabelText(/primary.*phone/i), '2045551234');
    await userEvent.type(screen.getByLabelText(/^street address$/i), '1 Main St');
    await userEvent.type(screen.getByLabelText(/city/i), 'Steinbach');
    await userEvent.type(screen.getByLabelText(/province/i), 'MB');
    await userEvent.type(screen.getByLabelText(/postal/i), 'R5G 1A1');
    await userEvent.click(screen.getByRole('radio', { name: /^female$/i }));
    await userEvent.click(screen.getAllByRole('radio', { name: /^no$/i })[0]);
    await userEvent.click(screen.getAllByRole('radio', { name: /^no$/i })[1]);
    await userEvent.click(screen.getByRole('radio', { name: /canadian citizen/i }));
    await userEvent.click(screen.getByRole('button', { name: /next/i }));

    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
    expect(capturedBody.data.attributes.field_first_name).toBe('Alice');
    expect(capturedBody.data.attributes.field_last_name).toBe('Smith');
    // onComplete receives { profile, formData }
    const [callArg] = onComplete.mock.calls[0];
    expect(callArg).toHaveProperty('profile');
    expect(callArg).toHaveProperty('formData');
  });
});
