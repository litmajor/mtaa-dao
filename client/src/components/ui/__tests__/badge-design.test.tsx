// @ts-nocheck
import React from 'react';
import { render, screen } from '@testing-library/react';
import { Badge } from '../badge-design';

describe('<Badge />', () => {
  // Render tests
  test('renders badge element', () => {
    render(<Badge>New</Badge>);
    expect(screen.getByText('New')).toBeInTheDocument();
  });

  test('renders with children text', () => {
    render(<Badge>5 items</Badge>);
    expect(screen.getByText('5 items')).toBeInTheDocument();
  });

  test('renders with custom content', () => {
    render(
      <Badge>
        <span data-testid="custom-content">Badge Content</span>
      </Badge>
    );
    expect(screen.getByTestId('custom-content')).toBeInTheDocument();
  });

  // Variant tests
  test('renders default variant', () => {
    const { container } = render(<Badge>Default</Badge>);
    const badge = container.querySelector('[role="status"]') || container.firstChild;
    expect(badge).toHaveClass('badge');
  });

  test('renders primary variant', () => {
    const { container } = render(<Badge variant="primary">Primary</Badge>);
    const badge = container.firstChild as HTMLElement;
    expect(badge).toHaveClass('badge-primary');
  });

  test('renders success variant', () => {
    const { container } = render(<Badge variant="success">Success</Badge>);
    const badge = container.firstChild as HTMLElement;
    expect(badge).toHaveClass('badge-success');
  });

  test('renders warning variant', () => {
    const { container } = render(<Badge variant="warning">Warning</Badge>);
    const badge = container.firstChild as HTMLElement;
    expect(badge).toHaveClass('badge-warning');
  });

  test('renders danger variant', () => {
    const { container } = render(<Badge variant="danger">Danger</Badge>);
    const badge = container.firstChild as HTMLElement;
    expect(badge).toHaveClass('badge-danger');
  });

  test('renders info variant', () => {
    const { container } = render(<Badge variant="info">Info</Badge>);
    const badge = container.firstChild as HTMLElement;
    expect(badge).toHaveClass('badge-info');
  });

  // Size tests
  test('renders small size', () => {
    const { container } = render(<Badge size="small">SM</Badge>);
    const badge = container.firstChild as HTMLElement;
    expect(badge).toHaveClass('badge-small');
  });

  test('renders medium size (default)', () => {
    const { container } = render(<Badge>MD</Badge>);
    const badge = container.firstChild as HTMLElement;
    expect(badge).toHaveClass('badge');
  });

  test('renders large size', () => {
    const { container } = render(<Badge size="large">LG</Badge>);
    const badge = container.firstChild as HTMLElement;
    expect(badge).toHaveClass('badge-large');
  });

  // Shape tests
  test('renders rounded shape', () => {
    const { container } = render(<Badge shape="rounded">Rounded</Badge>);
    const badge = container.firstChild as HTMLElement;
    expect(badge).toHaveClass('badge-rounded');
  });

  test('renders pill shape', () => {
    const { container } = render(<Badge shape="pill">Pill</Badge>);
    const badge = container.firstChild as HTMLElement;
    expect(badge).toHaveClass('badge-pill');
  });

  test('renders square shape', () => {
    const { container } = render(<Badge shape="square">Square</Badge>);
    const badge = container.firstChild as HTMLElement;
    expect(badge).toHaveClass('badge-square');
  });

  // Icon tests
  test('renders with icon', () => {
    render(
      <Badge icon={<span data-testid="badge-icon">⭐</span>}>
        Featured
      </Badge>
    );
    expect(screen.getByTestId('badge-icon')).toBeInTheDocument();
  });

  test('renders icon before text', () => {
    const { container } = render(
      <Badge icon={<span>Icon</span>}>Text</Badge>
    );
    const icon = container.querySelector('span');
    const badge = container.firstChild as HTMLElement;
    expect(badge.firstChild).toEqual(icon);
  });

  // Dismissible tests
  test('renders dismiss button when dismissible', () => {
    render(<Badge dismissible>Dismissible</Badge>);
    expect(screen.getByRole('button', { name: /close|dismiss/i })).toBeInTheDocument();
  });

  test('calls onDismiss handler', () => {
    const handleDismiss = jest.fn();
    render(<Badge dismissible onDismiss={handleDismiss}>Dismissible</Badge>);
    const dismissButton = screen.getByRole('button');
    dismissButton.click();
    expect(handleDismiss).toHaveBeenCalled();
  });

  test('no dismiss button when not dismissible', () => {
    render(<Badge>Non-dismissible</Badge>);
    expect(screen.queryByRole('button', { name: /close|dismiss/i })).not.toBeInTheDocument();
  });

  // Accessibility tests
  test('has proper semantic structure', () => {
    render(<Badge>Status Badge</Badge>);
    expect(screen.getByText('Status Badge')).toBeInTheDocument();
  });

  test('dismissible button is accessible', () => {
    render(<Badge dismissible>Dismissible</Badge>);
    const button = screen.getByRole('button');
    expect(button).toHaveAccessibleName();
  });

  // Custom className tests
  test('accepts custom className', () => {
    const { container } = render(
      <Badge className="custom-class">Badge</Badge>
    );
    const badge = container.firstChild as HTMLElement;
    expect(badge).toHaveClass('custom-class');
  });

  // Combination tests
  test('combines variant, size, and shape', () => {
    const { container } = render(
      <Badge variant="success" size="large" shape="pill">
        Success
      </Badge>
    );
    const badge = container.firstChild as HTMLElement;
    expect(badge).toHaveClass('badge-success');
    expect(badge).toHaveClass('badge-large');
    expect(badge).toHaveClass('badge-pill');
  });

  test('renders with icon, variant, and dismissible', () => {
    render(
      <Badge
        icon={<span data-testid="icon">✓</span>}
        variant="success"
        dismissible
      >
        Success
      </Badge>
    );
    expect(screen.getByTestId('icon')).toBeInTheDocument();
    expect(screen.getByText('Success')).toBeInTheDocument();
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  // Data attributes tests
  test('forwards data attributes', () => {
    render(
      <Badge data-testid="custom-badge" data-id="123">
        Badge
      </Badge>
    );
    const badge = screen.getByTestId('custom-badge');
    expect(badge).toHaveAttribute('data-id', '123');
  });
});
