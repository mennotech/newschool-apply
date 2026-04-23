import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { post } from '../../api/drupalClient';
import StudentInfoStep from './StudentInfoStep';

jest.mock('../../api/drupalClient', () => ({
  post: jest.fn(),
}));

describe('StudentInfoStep', () => {
  it('shows validation errors when required fields are empty', async () => {
    const user = userEvent.setup();
    const onComplete = jest.fn();
    render(<StudentInfoStep onComplete={onComplete} />);

    await user.click(screen.getByRole('button', { name: /next/i }));

    expect(await screen.findByText(/first name is required/i)).toBeInTheDocument();
    expect(screen.getByText(/last name is required/i)).toBeInTheDocument();
    expect(screen.getByText(/date of birth is required/i)).toBeInTheDocument();
    expect(screen.getByText(/applying for grade is required/i)).toBeInTheDocument();
    expect(screen.getByText(/please correct the highlighted fields before continuing/i)).toBeInTheDocument();
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('calls post with correct payload on valid submission', async () => {
    const user = userEvent.setup();
    post.mockResolvedValue({
      data: {
        id: 'new-id',
        type: 'node--student_profile',
        attributes: {
          field_first_name: 'Alice',
          field_last_name: 'Smith',
        },
      },
    });

    const onComplete = jest.fn();
    render(
      <StudentInfoStep
        onComplete={onComplete}
        initialData={{
          student_first_name: 'Alice',
          student_last_name: 'Smith',
          student_gender: 'female',
          student_birth_date: '2010-01-15',
          student_current_grade: 'Grade 6',
          student_applying_for_grade: 'Grade 7',
          primary_home_phone: '2045551234',
          physical_address_line_1: '1 Main St',
          physical_city: 'Steinbach',
          physical_state_province: 'MB',
          physical_postal_zip: 'R5G 1A1',
          mailing_address_differs: 'no',
          citizenship_status: 'canadian_citizen',
          attended_mb_school_before: 'no',
        }}
      />
    );
    
    // Submit form
    await user.click(screen.getByRole('button', { name: /next/i }));

    // Wait for callback
    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1), { timeout: 5000 });

    // Verify the API payload sent to drupalClient.post
    expect(post).toHaveBeenCalledWith('/jsonapi/node/student_profile', {
      data: {
        type: 'node--student_profile',
        attributes: {
          title: 'Alice Smith',
          field_first_name: 'Alice',
          field_last_name: 'Smith',
          field_date_of_birth: '2010-01-15',
          field_grade_applying_for: 'Grade 7',
        },
      },
    });
    
    // Verify callback payload
    const [callArg] = onComplete.mock.calls[0];
    expect(callArg).toHaveProperty('profile');
    expect(callArg).toHaveProperty('formData');
  }, 15000);

  it('requires mailing address fields only when mailing address differs is yes', async () => {
    const user = userEvent.setup();
    const onComplete = jest.fn();
    render(<StudentInfoStep onComplete={onComplete} />);

    await user.type(screen.getByLabelText(/^first name$/i), 'Alice');
    await user.type(screen.getByLabelText(/^last name$/i), 'Smith');
    fireEvent.change(screen.getByLabelText(/date of birth/i), { target: { value: '2010-01-15' } });
    await user.type(screen.getByLabelText(/current grade/i), 'Grade 6');
    await user.type(screen.getByLabelText(/applying for grade/i), 'Grade 7');
    await user.type(screen.getByLabelText(/primary.*phone/i), '2045551234');
    await user.type(screen.getByLabelText(/street address/i), '1 Main St');
    await user.type(screen.getByLabelText(/^city/i), 'Steinbach');
    await user.type(screen.getByLabelText(/province.*state/i), 'MB');
    await user.type(screen.getByLabelText(/postal.*zip/i), 'R5G 1A1');

    await user.click(screen.getByRole('radio', { name: /^female$/i }));
    await user.click(screen.getByRole('radio', { name: /canadian citizen/i }));
    const yesRadios = screen.getAllByRole('radio', { name: /^yes$/i });
    await user.click(yesRadios[0]); // mailing_address_differs = yes
    await user.click(yesRadios[1]); // attended_mb_school_before = yes

    await user.click(screen.getByRole('button', { name: /next/i }));

    expect(await screen.findByText(/street address is required\./i)).toBeInTheDocument();
    expect(screen.getByText(/city is required\./i)).toBeInTheDocument();
    expect(screen.getByText(/province is required\./i)).toBeInTheDocument();
    expect(screen.getByText(/postal code is required\./i)).toBeInTheDocument();
    expect(onComplete).not.toHaveBeenCalled();
  });
});
