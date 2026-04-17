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
    expect(screen.getByText(/grade is required/i)).toBeInTheDocument();
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

    await userEvent.type(screen.getByLabelText(/first name/i), 'Alice');
    await userEvent.type(screen.getByLabelText(/last name/i), 'Smith');
    await userEvent.type(screen.getByLabelText(/date of birth/i), '2010-01-15');
    await userEvent.type(screen.getByLabelText(/grade applying for/i), '5');
    await userEvent.click(screen.getByRole('button', { name: /next/i }));

    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
    expect(capturedBody.data.attributes.field_first_name).toBe('Alice');
    expect(capturedBody.data.attributes.field_last_name).toBe('Smith');
  });
});
