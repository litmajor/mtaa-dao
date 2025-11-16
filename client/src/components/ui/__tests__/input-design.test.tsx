// @ts-nocheck
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Input } from '../input-design';

describe('<Input />', () => {
  // Render tests
  test('renders input element', () => {
    render(<Input />);
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  test('renders with label', () => {
    render(<Input label="Username" />);
    expect(screen.getByLabelText('Username')).toBeInTheDocument();
  });

  test('renders required indicator', () => {
    render(<Input label="Password" required />);
    expect(screen.getByText('*')).toBeInTheDocument();
  });

  test('renders different input types', () => {
    const types = ['text', 'email', 'password', 'number', 'date'];
    const { rerender } = render(<Input type="text" />);

    types.forEach((type) => {
      rerender(<Input type={type as any} />);
      expect(screen.getByRole('textbox')).toHaveAttribute('type', type);
    });
  });

  // Validation tests
  test('shows error state', () => {
    const { container } = render(
      <Input error errorMessage="Field is required" />
    );
    expect(container.querySelector('input')).toHaveAttribute('aria-invalid', 'true');
  });

  test('displays error message', () => {
    render(<Input error errorMessage="Field is required" />);
    expect(screen.getByText('Field is required')).toBeInTheDocument();
  });

  test('displays helper text', () => {
    render(<Input helperText="Enter a valid email" />);
    expect(screen.getByText('Enter a valid email')).toBeInTheDocument();
  });

  test('does not show error message when error is false', () => {
    render(<Input error={false} errorMessage="Error message" />);
    expect(screen.queryByText('Error message')).not.toBeInTheDocument();
  });

  // Disabled state tests
  test('renders disabled input', () => {
    render(<Input disabled />);
    expect(screen.getByRole('textbox')).toBeDisabled();
  });

  test('prevents input when disabled', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<Input disabled />);
    const input = screen.getByRole('textbox');

    await user.type(input, 'test');
    expect(input).toHaveValue('');
  });

  // Icon tests
  test('renders icon on left side', () => {
    render(<Input icon={<span data-testid="icon">📧</span>} />);
    expect(screen.getByTestId('icon')).toBeInTheDocument();
  });

  test('renders icon on right side', () => {
    render(
      <Input
        icon={<span data-testid="icon">✓</span>}
        iconPosition="right"
      />
    );
    expect(screen.getByTestId('icon')).toBeInTheDocument();
  });

  // Accessibility tests
  test('has unique id and proper label association', () => {
    render(<Input label="Email" />);
    const input = screen.getByRole('textbox');
    const label = screen.getByText('Email');
    expect(label).toHaveAttribute('htmlFor', input.id);
  });

  test('associates aria-describedby with error message', () => {
    render(<Input error errorMessage="Required" />);
    const input = screen.getByRole('textbox');
    expect(input).toHaveAttribute('aria-describedby');
  });

  test('associates aria-describedby with helper text', () => {
    render(<Input helperText="Helper text" />);
    const input = screen.getByRole('textbox');
    expect(input).toHaveAttribute('aria-describedby');
  });

  // Event tests
  test('handles input changes', async () => {
    const user = userEvent.setup();
    const handleChange = jest.fn();
    render(<Input onChange={handleChange} />);

    await user.type(screen.getByRole('textbox'), 'test');
    expect(handleChange).toHaveBeenCalled();
  });

  test('handles focus events', () => {
    const handleFocus = jest.fn();
    render(<Input onFocus={handleFocus} />);
    fireEvent.focus(screen.getByRole('textbox'));
    expect(handleFocus).toHaveBeenCalled();
  });

  test('handles blur events', () => {
    const handleBlur = jest.fn();
    render(<Input onBlur={handleBlur} />);
    const input = screen.getByRole('textbox');
    fireEvent.focus(input);
    fireEvent.blur(input);
    expect(handleBlur).toHaveBeenCalled();
  });

  test('forwards ref', () => {
    const ref = React.createRef<HTMLInputElement>();
    render(<Input ref={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLInputElement);
  });

  test('spreads additional HTML attributes', () => {
    render(
      <Input
        data-testid="custom-input"
        placeholder="Enter text"
        maxLength={10}
      />
    );
    const input = screen.getByTestId('custom-input');
    expect(input).toHaveAttribute('placeholder', 'Enter text');
    expect(input).toHaveAttribute('maxLength', '10');
  });
});
