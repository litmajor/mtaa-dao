// @ts-nocheck
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from '../button-design';

describe('<Button />', () => {
  // Render tests
  test('renders with text content', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole('button', { name: /click me/i })).toBeInTheDocument();
  });

  test('renders all variants', () => {
    const variants = ['primary', 'secondary', 'danger', 'ghost', 'outline', 'link'];
    const { rerender } = render(<Button variant="primary">Test</Button>);

    variants.forEach((variant) => {
      rerender(<Button variant={variant as any}>Test</Button>);
      expect(screen.getByRole('button')).toBeInTheDocument();
    });
  });

  test('renders all sizes', () => {
    const sizes = ['sm', 'md', 'lg'];
    const { rerender } = render(<Button size="sm">Test</Button>);

    sizes.forEach((size) => {
      rerender(<Button size={size as any}>Test</Button>);
      expect(screen.getByRole('button')).toBeInTheDocument();
    });
  });

  // Props tests
  test('applies fullWidth prop', () => {
    const { container } = render(<Button fullWidth>Test</Button>);
    const button = container.querySelector('button');
    expect(button?.className).toContain('w-full');
  });

  test('handles disabled state', () => {
    render(<Button disabled>Click me</Button>);
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
  });

  test('shows loading state', () => {
    render(<Button isLoading>Save</Button>);
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    expect(screen.getByRole('img', { hidden: true })).toHaveClass('animate-spin');
  });

  test('renders with icon', () => {
    const icon = <span data-testid="test-icon">📝</span>;
    render(<Button icon={icon}>Click me</Button>);
    expect(screen.getByTestId('test-icon')).toBeInTheDocument();
  });

  test('renders icon on left by default', () => {
    const icon = <span data-testid="test-icon">📝</span>;
    const { container } = render(<Button icon={icon}>Click me</Button>);
    const iconElement = screen.getByTestId('test-icon');
    const span = container.querySelector('span');
    expect(span?.children[0]).toEqual(iconElement);
  });

  test('renders icon on right when specified', () => {
    const icon = <span data-testid="test-icon">📝</span>;
    render(<Button icon={icon} iconPosition="right">Click me</Button>);
    expect(screen.getByTestId('test-icon')).toBeInTheDocument();
  });

  // Event tests
  test('handles click events', () => {
    const handleClick = jest.fn();
    render(<Button onClick={handleClick}>Click me</Button>);
    fireEvent.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  test('prevents click when disabled', () => {
    const handleClick = jest.fn();
    render(
      <Button disabled onClick={handleClick}>
        Click me
      </Button>
    );
    fireEvent.click(screen.getByRole('button'));
    expect(handleClick).not.toHaveBeenCalled();
  });

  test('prevents click when loading', () => {
    const handleClick = jest.fn();
    render(
      <Button isLoading onClick={handleClick}>
        Click me
      </Button>
    );
    fireEvent.click(screen.getByRole('button'));
    expect(handleClick).not.toHaveBeenCalled();
  });

  // Accessibility tests
  test('is keyboard accessible', async () => {
    const handleClick = jest.fn();
    const user = userEvent.setup();
    render(<Button onClick={handleClick}>Click me</Button>);

    const button = screen.getByRole('button');
    button.focus();
    expect(button).toHaveFocus();

    await user.keyboard('{Enter}');
    expect(handleClick).toHaveBeenCalled();
  });

  test('has proper button role', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  test('supports custom className', () => {
    const { container } = render(
      <Button className="custom-class">Test</Button>
    );
    expect(container.querySelector('button')).toHaveClass('custom-class');
  });

  test('forwards ref', () => {
    const ref = React.createRef<HTMLButtonElement>();
    render(<Button ref={ref}>Test</Button>);
    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
  });

  test('spreads additional HTML attributes', () => {
    render(
      <Button data-testid="custom-button" aria-label="Custom label">
        Test
      </Button>
    );
    expect(screen.getByTestId('custom-button')).toHaveAttribute(
      'aria-label',
      'Custom label'
    );
  });
});
