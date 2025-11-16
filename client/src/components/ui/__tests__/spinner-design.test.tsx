// @ts-nocheck
import React from 'react';
import { render, screen } from '@testing-library/react';
import { Spinner } from '../spinner-design';

describe('<Spinner />', () => {
  // Render tests
  test('renders spinner element', () => {
    render(<Spinner />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  test('renders with loading text', () => {
    render(<Spinner />);
    expect(screen.getByText(/loading|loading.../i)).toBeInTheDocument();
  });

  test('renders with custom label', () => {
    render(<Spinner label="Processing..." />);
    expect(screen.getByText('Processing...')).toBeInTheDocument();
  });

  // Size tests
  test('renders small spinner', () => {
    const { container } = render(<Spinner size="small" />);
    const spinner = container.querySelector('[role="status"]');
    expect(spinner).toHaveClass('spinner-small');
  });

  test('renders medium spinner (default)', () => {
    const { container } = render(<Spinner />);
    const spinner = container.querySelector('[role="status"]');
    expect(spinner).toHaveClass('spinner');
  });

  test('renders large spinner', () => {
    const { container } = render(<Spinner size="large" />);
    const spinner = container.querySelector('[role="status"]');
    expect(spinner).toHaveClass('spinner-large');
  });

  test('renders custom size number', () => {
    const { container } = render(<Spinner size={50} />);
    const spinner = container.querySelector('[role="status"]');
    expect(spinner).toHaveStyle({ width: '50px', height: '50px' });
  });

  // Color tests
  test('renders with primary color', () => {
    const { container } = render(<Spinner color="primary" />);
    const spinner = container.querySelector('[role="status"]');
    expect(spinner).toHaveClass('spinner-primary');
  });

  test('renders with success color', () => {
    const { container } = render(<Spinner color="success" />);
    const spinner = container.querySelector('[role="status"]');
    expect(spinner).toHaveClass('spinner-success');
  });

  test('renders with warning color', () => {
    const { container } = render(<Spinner color="warning" />);
    const spinner = container.querySelector('[role="status"]');
    expect(spinner).toHaveClass('spinner-warning');
  });

  test('renders with danger color', () => {
    const { container } = render(<Spinner color="danger" />);
    const spinner = container.querySelector('[role="status"]');
    expect(spinner).toHaveClass('spinner-danger');
  });

  test('renders with custom hex color', () => {
    const { container } = render(<Spinner color="#FF5733" />);
    const spinner = container.querySelector('[role="status"]');
    expect(spinner).toHaveStyle({ borderColor: '#FF5733' });
  });

  // Variant tests
  test('renders default (ring) variant', () => {
    const { container } = render(<Spinner />);
    const spinner = container.querySelector('[role="status"]');
    expect(spinner).toHaveClass('spinner-ring');
  });

  test('renders dots variant', () => {
    const { container } = render(<Spinner variant="dots" />);
    const spinner = container.querySelector('[role="status"]');
    expect(spinner).toHaveClass('spinner-dots');
  });

  test('renders bars variant', () => {
    const { container } = render(<Spinner variant="bars" />);
    const spinner = container.querySelector('[role="status"]');
    expect(spinner).toHaveClass('spinner-bars');
  });

  test('renders pulse variant', () => {
    const { container } = render(<Spinner variant="pulse" />);
    const spinner = container.querySelector('[role="status"]');
    expect(spinner).toHaveClass('spinner-pulse');
  });

  test('renders bounce variant', () => {
    const { container } = render(<Spinner variant="bounce" />);
    const spinner = container.querySelector('[role="status"]');
    expect(spinner).toHaveClass('spinner-bounce');
  });

  // Speed tests
  test('renders with slow speed', () => {
    const { container } = render(<Spinner speed="slow" />);
    const spinner = container.querySelector('[role="status"]');
    expect(spinner).toHaveClass('spinner-slow');
  });

  test('renders with normal speed (default)', () => {
    const { container } = render(<Spinner />);
    const spinner = container.querySelector('[role="status"]');
    expect(spinner).toHaveClass('spinner-normal');
  });

  test('renders with fast speed', () => {
    const { container } = render(<Spinner speed="fast" />);
    const spinner = container.querySelector('[role="status"]');
    expect(spinner).toHaveClass('spinner-fast');
  });

  // Label position tests
  test('renders label below spinner', () => {
    const { container } = render(<Spinner label="Loading" labelPosition="bottom" />);
    const spinner = container.querySelector('[role="status"]');
    const label = screen.getByText('Loading');
    expect(label).toBeInTheDocument();
    // Label should be a sibling (comes after spinner in DOM)
    expect(spinner?.parentElement?.children[1]).toContainElement(label);
  });

  test('renders label to the right of spinner', () => {
    const { container } = render(<Spinner label="Loading" labelPosition="right" />);
    expect(screen.getByText('Loading')).toBeInTheDocument();
    expect(container.querySelector('[role="status"]')).toBeInTheDocument();
  });

  test('renders label above spinner', () => {
    const { container } = render(<Spinner label="Loading" labelPosition="top" />);
    expect(screen.getByText('Loading')).toBeInTheDocument();
    expect(container.querySelector('[role="status"]')).toBeInTheDocument();
  });

  // Fullscreen tests
  test('renders fullscreen overlay', () => {
    const { container } = render(<Spinner fullscreen />);
    const overlay = container.querySelector('.spinner-fullscreen');
    expect(overlay).toBeInTheDocument();
  });

  test('fullscreen spinner is centered', () => {
    const { container } = render(<Spinner fullscreen />);
    const overlay = container.querySelector('.spinner-fullscreen');
    expect(overlay).toHaveClass('spinner-fullscreen');
  });

  test('fullscreen spinner has backdrop', () => {
    const { container } = render(<Spinner fullscreen backdrop />);
    const backdrop = container.querySelector('.spinner-backdrop');
    expect(backdrop).toBeInTheDocument();
  });

  test('does not render fullscreen by default', () => {
    const { container } = render(<Spinner />);
    const fullscreen = container.querySelector('.spinner-fullscreen');
    expect(fullscreen).not.toBeInTheDocument();
  });

  // Accessibility tests
  test('has status role for screen readers', () => {
    render(<Spinner />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  test('includes aria-live="polite" attribute', () => {
    render(<Spinner />);
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');
  });

  test('includes aria-label when label provided', () => {
    render(<Spinner label="Processing data" />);
    expect(screen.getByRole('status')).toHaveAttribute(
      'aria-label',
      'Processing data'
    );
  });

  test('has aria-busy="true"', () => {
    render(<Spinner />);
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
  });

  // Style and className tests
  test('accepts custom className', () => {
    const { container } = render(
      <Spinner className="custom-spinner" />
    );
    const spinner = container.querySelector('[role="status"]');
    expect(spinner).toHaveClass('custom-spinner');
  });

  test('accepts custom style', () => {
    const customStyle = { margin: '20px auto' };
    const { container } = render(
      <Spinner style={customStyle} />
    );
    const spinner = container.querySelector('[role="status"]');
    expect(spinner).toHaveStyle({ margin: '20px auto' });
  });

  // Data attributes tests
  test('forwards data attributes', () => {
    render(
      <Spinner data-testid="custom-spinner" data-loading="true" />
    );
    const spinner = screen.getByTestId('custom-spinner');
    expect(spinner).toHaveAttribute('data-loading', 'true');
  });

  // Combination tests
  test('combines size, color, and variant', () => {
    const { container } = render(
      <Spinner size="large" color="success" variant="dots" />
    );
    const spinner = container.querySelector('[role="status"]');
    expect(spinner).toHaveClass('spinner-large');
    expect(spinner).toHaveClass('spinner-success');
    expect(spinner).toHaveClass('spinner-dots');
  });

  test('combines speed, label, and custom style', () => {
    const { container } = render(
      <Spinner
        speed="fast"
        label="Loading..."
        style={{ padding: '20px' }}
      />
    );
    const spinner = container.querySelector('[role="status"]');
    expect(spinner).toHaveClass('spinner-fast');
    expect(screen.getByText('Loading...')).toBeInTheDocument();
    expect(spinner).toHaveStyle({ padding: '20px' });
  });

  test('fullscreen spinner with all props', () => {
    const { container } = render(
      <Spinner
        fullscreen
        backdrop
        size="large"
        color="primary"
        label="Loading"
        speed="fast"
      />
    );
    const fullscreen = container.querySelector('.spinner-fullscreen');
    expect(fullscreen).toBeInTheDocument();
    expect(container.querySelector('.spinner-backdrop')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveClass('spinner-large');
    expect(screen.getByRole('status')).toHaveClass('spinner-primary');
    expect(screen.getByText('Loading')).toBeInTheDocument();
  });

  // Ref forwarding test
  test('forwards ref', () => {
    const ref = React.createRef<HTMLDivElement>();
    render(<Spinner ref={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
  });
});
