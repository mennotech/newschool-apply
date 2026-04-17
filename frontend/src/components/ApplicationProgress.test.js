import React from 'react';
import { render, screen } from '@testing-library/react';
import ApplicationProgress from './ApplicationProgress';

const STEPS = ['student-info', 'documents', 'review'];

describe('ApplicationProgress', () => {
  it('renders all step labels', () => {
    render(<ApplicationProgress steps={STEPS} activeStep={0} />);
    expect(screen.getByText(/student info/i)).toBeInTheDocument();
    expect(screen.getByText(/documents/i)).toBeInTheDocument();
    expect(screen.getByText(/review/i)).toBeInTheDocument();
  });

  it('marks the active step with aria-current="step"', () => {
    render(<ApplicationProgress steps={STEPS} activeStep={1} />);
    const items = screen.getAllByRole('listitem');
    expect(items[1]).toHaveAttribute('aria-current', 'step');
  });

  it('marks completed steps with a check indicator', () => {
    render(<ApplicationProgress steps={STEPS} activeStep={2} />);
    // First two steps should be completed — they get "✓ " prefix
    const items = screen.getAllByRole('listitem');
    expect(items[0].textContent).toMatch(/✓/);
    expect(items[1].textContent).toMatch(/✓/);
    expect(items[2].textContent).not.toMatch(/✓/);
  });
});
