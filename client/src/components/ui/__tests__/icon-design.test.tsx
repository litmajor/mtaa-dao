// @ts-nocheck
import React from 'react';
import { render, screen } from '@testing-library/react';
import { Icon } from '../icon-design';

describe('<Icon />', () => {
  // Render tests
  test('renders icon element', () => {
    render(<Icon name="star" />);
    expect(screen.getByRole('img', { hidden: true })).toBeInTheDocument();
  });

  test('renders with specific name', () => {
    const { container } = render(<Icon name="user" />);
    const icon = container.querySelector('[data-icon]');
    expect(icon).toHaveAttribute('data-icon', 'user');
  });

  test('renders SVG icon', () => {
    render(<Icon name="star" />);
    expect(screen.getByRole('img', { hidden: true })).toBeInTheDocument();
  });

  // Size tests
  test('renders small icon', () => {
    const { container } = render(<Icon name="star" size="small" />);
    const icon = container.firstChild as HTMLElement;
    expect(icon).toHaveClass('icon-small');
  });

  test('renders medium icon (default)', () => {
    const { container } = render(<Icon name="star" />);
    const icon = container.firstChild as HTMLElement;
    expect(icon).toHaveClass('icon');
  });

  test('renders large icon', () => {
    const { container } = render(<Icon name="star" size="large" />);
    const icon = container.firstChild as HTMLElement;
    expect(icon).toHaveClass('icon-large');
  });

  test('renders custom size number', () => {
    const { container } = render(<Icon name="star" size={32} />);
    const icon = container.firstChild as HTMLElement;
    expect(icon).toHaveStyle({ width: '32px', height: '32px' });
  });

  // Color tests
  test('renders with default color', () => {
    const { container } = render(<Icon name="star" />);
    const icon = container.firstChild as HTMLElement;
    expect(icon).toHaveClass('icon');
  });

  test('renders with primary color', () => {
    const { container } = render(<Icon name="star" color="primary" />);
    const icon = container.firstChild as HTMLElement;
    expect(icon).toHaveClass('icon-primary');
  });

  test('renders with success color', () => {
    const { container } = render(<Icon name="star" color="success" />);
    const icon = container.firstChild as HTMLElement;
    expect(icon).toHaveClass('icon-success');
  });

  test('renders with warning color', () => {
    const { container } = render(<Icon name="star" color="warning" />);
    const icon = container.firstChild as HTMLElement;
    expect(icon).toHaveClass('icon-warning');
  });

  test('renders with danger color', () => {
    const { container } = render(<Icon name="star" color="danger" />);
    const icon = container.firstChild as HTMLElement;
    expect(icon).toHaveClass('icon-danger');
  });

  test('renders with custom hex color', () => {
    const { container } = render(<Icon name="star" color="#FF5733" />);
    const icon = container.firstChild as HTMLElement;
    expect(icon).toHaveStyle({ color: '#FF5733' });
  });

  test('renders with RGB color', () => {
    const { container } = render(<Icon name="star" color="rgb(255, 87, 51)" />);
    const icon = container.firstChild as HTMLElement;
    expect(icon).toHaveStyle({ color: 'rgb(255, 87, 51)' });
  });

  // Rotation tests
  test('renders with rotation', () => {
    const { container } = render(<Icon name="star" rotate={90} />);
    const icon = container.firstChild as HTMLElement;
    expect(icon).toHaveStyle({ transform: 'rotate(90deg)' });
  });

  test('renders with 180 degree rotation', () => {
    const { container } = render(<Icon name="star" rotate={180} />);
    const icon = container.firstChild as HTMLElement;
    expect(icon).toHaveStyle({ transform: 'rotate(180deg)' });
  });

  // Animation tests
  test('renders with spin animation', () => {
    const { container } = render(<Icon name="star" animation="spin" />);
    const icon = container.firstChild as HTMLElement;
    expect(icon).toHaveClass('icon-spin');
  });

  test('renders with pulse animation', () => {
    const { container } = render(<Icon name="star" animation="pulse" />);
    const icon = container.firstChild as HTMLElement;
    expect(icon).toHaveClass('icon-pulse');
  });

  test('renders with bounce animation', () => {
    const { container } = render(<Icon name="star" animation="bounce" />);
    const icon = container.firstChild as HTMLElement;
    expect(icon).toHaveClass('icon-bounce');
  });

  test('renders with no animation by default', () => {
    const { container } = render(<Icon name="star" />);
    const icon = container.firstChild as HTMLElement;
    expect(icon).not.toHaveClass('icon-spin');
    expect(icon).not.toHaveClass('icon-pulse');
    expect(icon).not.toHaveClass('icon-bounce');
  });

  // Flip tests
  test('renders with horizontal flip', () => {
    const { container } = render(<Icon name="star" flip="horizontal" />);
    const icon = container.firstChild as HTMLElement;
    expect(icon).toHaveClass('icon-flip-horizontal');
  });

  test('renders with vertical flip', () => {
    const { container } = render(<Icon name="star" flip="vertical" />);
    const icon = container.firstChild as HTMLElement;
    expect(icon).toHaveClass('icon-flip-vertical');
  });

  test('renders with both flip', () => {
    const { container } = render(<Icon name="star" flip="both" />);
    const icon = container.firstChild as HTMLElement;
    expect(icon).toHaveClass('icon-flip-both');
  });

  // Accessibility tests
  test('has proper role attribute', () => {
    render(<Icon name="star" />);
    expect(screen.getByRole('img', { hidden: true })).toBeInTheDocument();
  });

  test('includes aria-label when title provided', () => {
    render(<Icon name="star" title="Star Icon" />);
    const icon = screen.getByRole('img', { hidden: true });
    expect(icon).toHaveAttribute('aria-label', 'Star Icon');
  });

  test('has aria-hidden when decorative', () => {
    render(<Icon name="star" aria-hidden />);
    const icon = screen.getByRole('img', { hidden: true });
    expect(icon).toHaveAttribute('aria-hidden', 'true');
  });

  // Style and className tests
  test('accepts custom className', () => {
    const { container } = render(<Icon name="star" className="custom-icon" />);
    const icon = container.firstChild as HTMLElement;
    expect(icon).toHaveClass('custom-icon');
  });

  test('accepts custom style', () => {
    const customStyle = { marginRight: '8px' };
    const { container } = render(
      <Icon name="star" style={customStyle} />
    );
    const icon = container.firstChild as HTMLElement;
    expect(icon).toHaveStyle({ marginRight: '8px' });
  });

  // Data attributes tests
  test('forwards data attributes', () => {
    render(
      <Icon name="star" data-testid="custom-icon" data-size="large" />
    );
    const icon = screen.getByTestId('custom-icon');
    expect(icon).toHaveAttribute('data-size', 'large');
  });

  // Combination tests
  test('combines size, color, and rotation', () => {
    const { container } = render(
      <Icon name="star" size="large" color="primary" rotate={45} />
    );
    const icon = container.firstChild as HTMLElement;
    expect(icon).toHaveClass('icon-large');
    expect(icon).toHaveClass('icon-primary');
    expect(icon).toHaveStyle({ transform: 'rotate(45deg)' });
  });

  test('combines animation, flip, and custom className', () => {
    const { container } = render(
      <Icon
        name="star"
        animation="spin"
        flip="horizontal"
        className="custom"
      />
    );
    const icon = container.firstChild as HTMLElement;
    expect(icon).toHaveClass('icon-spin');
    expect(icon).toHaveClass('icon-flip-horizontal');
    expect(icon).toHaveClass('custom');
  });

  // Event handling tests
  test('handles click events', () => {
    const handleClick = jest.fn();
    render(<Icon name="star" onClick={handleClick} />);
    const icon = screen.getByRole('img', { hidden: true });
    icon.parentElement?.click();
    expect(handleClick).toHaveBeenCalled();
  });

  test('forwards ref', () => {
    const ref = React.createRef<SVGElement>();
    render(<Icon name="star" ref={ref} />);
    expect(ref.current).toBeInstanceOf(SVGElement);
  });
});
