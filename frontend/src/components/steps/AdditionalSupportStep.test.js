import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AdditionalSupportStep from './AdditionalSupportStep';

describe('AdditionalSupportStep', () => {
  it('requires review confirmation before continuing', async () => {
    const onComplete = jest.fn();
    render(<AdditionalSupportStep onComplete={onComplete} onBack={jest.fn()} />);

    await userEvent.click(screen.getByRole('button', { name: /next/i }));

    expect(
      await screen.findByText(/please confirm that you reviewed the support declaration fields/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/please correct the highlighted fields before continuing/i)
    ).toBeInTheDocument();
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('allows continuing once review confirmation is checked', async () => {
    const onComplete = jest.fn();
    render(<AdditionalSupportStep onComplete={onComplete} onBack={jest.fn()} />);

    await userEvent.click(
      screen.getByRole('checkbox', {
        name: /i have reviewed the additional support declaration fields/i,
      })
    );
    await userEvent.click(screen.getByRole('button', { name: /next/i }));

    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});