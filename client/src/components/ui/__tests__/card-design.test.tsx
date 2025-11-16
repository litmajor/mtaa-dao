// @ts-nocheck
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Card } from '../card-design';

describe('<Card />', () => {
  // Render tests
  test('renders card element', () => {
    const { container } = render(<Card>Content</Card>);
    expect(container.querySelector('.card')).toBeInTheDocument();
  });

  test('renders with children', () => {
    render(
      <Card>
        <p>Card content</p>
      </Card>
    );
    expect(screen.getByText('Card content')).toBeInTheDocument();
  });

  test('renders with custom className', () => {
    const { container } = render(
      <Card className="custom-card">Content</Card>
    );
    const card = container.querySelector('.card');
    expect(card).toHaveClass('custom-card');
  });

  // Elevation/Shadow tests
  test('renders with default elevation', () => {
    const { container } = render(<Card>Content</Card>);
    const card = container.querySelector('.card');
    expect(card).toHaveClass('card');
  });

  test('renders with shadow elevation level 1', () => {
    const { container } = render(<Card elevation={1}>Content</Card>);
    const card = container.querySelector('.card');
    expect(card).toHaveClass('card-elevation-1');
  });

  test('renders with shadow elevation level 2', () => {
    const { container } = render(<Card elevation={2}>Content</Card>);
    const card = container.querySelector('.card');
    expect(card).toHaveClass('card-elevation-2');
  });

  test('renders with shadow elevation level 3', () => {
    const { container } = render(<Card elevation={3}>Content</Card>);
    const card = container.querySelector('.card');
    expect(card).toHaveClass('card-elevation-3');
  });

  test('renders with shadow elevation level 4', () => {
    const { container } = render(<Card elevation={4}>Content</Card>);
    const card = container.querySelector('.card');
    expect(card).toHaveClass('card-elevation-4');
  });

  test('renders without elevation', () => {
    const { container } = render(<Card elevation={0}>Content</Card>);
    const card = container.querySelector('.card');
    expect(card).not.toHaveClass('card-elevation-1');
  });

  // Interactive/Hoverable tests
  test('renders as interactive card', () => {
    const { container } = render(
      <Card interactive>Interactive Card</Card>
    );
    const card = container.querySelector('.card');
    expect(card).toHaveClass('card-interactive');
  });

  test('applies hover styles when interactive', () => {
    const { container } = render(
      <Card interactive>Hoverable</Card>
    );
    const card = container.querySelector('.card') as HTMLElement;
    expect(card).toHaveClass('card-interactive');
  });

  // Clickable tests
  test('renders as clickable card', () => {
    const handleClick = jest.fn();
    render(
      <Card onClick={handleClick}>Clickable Card</Card>
    );
    screen.getByText('Clickable Card').click();
    expect(handleClick).toHaveBeenCalled();
  });

  test('interactive card is keyboard accessible', async () => {
    const user = userEvent.setup();
    const handleClick = jest.fn();
    const { container } = render(
      <Card interactive onClick={handleClick}>
        Interactive Card
      </Card>
    );
    const card = container.querySelector('.card') as HTMLElement;
    card.focus();
    expect(card).toHaveFocus();
  });

  // Header/Title tests
  test('renders with header prop', () => {
    render(
      <Card header="Card Title">
        Card content
      </Card>
    );
    expect(screen.getByText('Card Title')).toBeInTheDocument();
  });

  test('renders header with custom content', () => {
    render(
      <Card
        header={
          <div data-testid="custom-header">Custom Header</div>
        }
      >
        Content
      </Card>
    );
    expect(screen.getByTestId('custom-header')).toBeInTheDocument();
  });

  // Footer tests
  test('renders with footer prop', () => {
    render(
      <Card footer="Card Footer">
        Card content
      </Card>
    );
    expect(screen.getByText('Card Footer')).toBeInTheDocument();
  });

  test('renders footer with custom content', () => {
    render(
      <Card
        footer={
          <div data-testid="custom-footer">Custom Footer</div>
        }
      >
        Content
      </Card>
    );
    expect(screen.getByTestId('custom-footer')).toBeInTheDocument();
  });

  // Image tests
  test('renders with image prop', () => {
    render(
      <Card image="https://example.com/image.jpg">
        Content
      </Card>
    );
    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('src', 'https://example.com/image.jpg');
  });

  test('renders image at top', () => {
    const { container } = render(
      <Card image="https://example.com/image.jpg" imagePosition="top">
        Content
      </Card>
    );
    const img = container.querySelector('img');
    expect(img).toBeInTheDocument();
  });

  test('renders image at bottom', () => {
    const { container } = render(
      <Card image="https://example.com/image.jpg" imagePosition="bottom">
        Content
      </Card>
    );
    const img = container.querySelector('img');
    expect(img).toBeInTheDocument();
  });

  // Padding/Spacing tests
  test('renders with default padding', () => {
    const { container } = render(<Card>Content</Card>);
    const card = container.querySelector('.card');
    expect(card).toHaveClass('card');
  });

  test('renders with custom padding', () => {
    const { container } = render(
      <Card padding="20px">Content</Card>
    );
    const card = container.querySelector('.card');
    expect(card).toHaveStyle({ padding: '20px' });
  });

  // Border tests
  test('renders with default border', () => {
    const { container } = render(<Card>Content</Card>);
    const card = container.querySelector('.card');
    expect(card).toBeInTheDocument();
  });

  test('renders with custom border color', () => {
    const { container } = render(
      <Card borderColor="#FF5733">Content</Card>
    );
    const card = container.querySelector('.card');
    expect(card).toHaveStyle({ borderColor: '#FF5733' });
  });

  test('renders with disabled border', () => {
    const { container } = render(
      <Card border={false}>Content</Card>
    );
    const card = container.querySelector('.card');
    expect(card).toHaveClass('card-no-border');
  });

  // Color/Variant tests
  test('renders with primary color variant', () => {
    const { container } = render(
      <Card color="primary">Content</Card>
    );
    const card = container.querySelector('.card');
    expect(card).toHaveClass('card-primary');
  });

  test('renders with success color variant', () => {
    const { container } = render(
      <Card color="success">Content</Card>
    );
    const card = container.querySelector('.card');
    expect(card).toHaveClass('card-success');
  });

  test('renders with warning color variant', () => {
    const { container } = render(
      <Card color="warning">Content</Card>
    );
    const card = container.querySelector('.card');
    expect(card).toHaveClass('card-warning');
  });

  test('renders with danger color variant', () => {
    const { container } = render(
      <Card color="danger">Content</Card>
    );
    const card = container.querySelector('.card');
    expect(card).toHaveClass('card-danger');
  });

  // Disabled state tests
  test('renders as disabled card', () => {
    const { container } = render(
      <Card disabled>Content</Card>
    );
    const card = container.querySelector('.card');
    expect(card).toHaveClass('card-disabled');
  });

  test('prevents clicks when disabled', () => {
    const handleClick = jest.fn();
    const { container } = render(
      <Card disabled onClick={handleClick}>
        Content
      </Card>
    );
    const card = container.querySelector('.card') as HTMLElement;
    fireEvent.click(card);
    expect(handleClick).not.toHaveBeenCalled();
  });

  // Rounded corners tests
  test('renders with default rounded corners', () => {
    const { container } = render(<Card>Content</Card>);
    const card = container.querySelector('.card');
    expect(card).toHaveClass('card');
  });

  test('renders with custom border radius', () => {
    const { container } = render(
      <Card borderRadius="8px">Content</Card>
    );
    const card = container.querySelector('.card');
    expect(card).toHaveStyle({ borderRadius: '8px' });
  });

  // Full width tests
  test('renders with default width', () => {
    const { container } = render(<Card>Content</Card>);
    const card = container.querySelector('.card');
    expect(card).toBeInTheDocument();
  });

  test('renders as full width', () => {
    const { container } = render(
      <Card fullWidth>Content</Card>
    );
    const card = container.querySelector('.card');
    expect(card).toHaveClass('card-full-width');
  });

  // Accessibility tests
  test('has semantic structure', () => {
    const { container } = render(
      <Card header="Title">Content</Card>
    );
    expect(container.querySelector('.card')).toBeInTheDocument();
    expect(screen.getByText('Title')).toBeInTheDocument();
  });

  test('forwards ref', () => {
    const ref = React.createRef<HTMLDivElement>();
    render(<Card ref={ref}>Content</Card>);
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
  });

  // Complex composition tests
  test('renders with header, footer, and image', () => {
    render(
      <Card
        header="Title"
        footer="Footer"
        image="https://example.com/image.jpg"
      >
        Content
      </Card>
    );
    expect(screen.getByText('Title')).toBeInTheDocument();
    expect(screen.getByText('Footer')).toBeInTheDocument();
    expect(screen.getByRole('img')).toBeInTheDocument();
  });

  test('combines multiple properties', () => {
    const { container } = render(
      <Card
        elevation={3}
        interactive
        color="primary"
        header="Title"
        padding="16px"
      >
        Content
      </Card>
    );
    const card = container.querySelector('.card');
    expect(card).toHaveClass('card-elevation-3');
    expect(card).toHaveClass('card-interactive');
    expect(card).toHaveClass('card-primary');
  });

  // Data attributes tests
  test('forwards data attributes', () => {
    render(
      <Card data-testid="custom-card" data-id="123">
        Content
      </Card>
    );
    const card = screen.getByTestId('custom-card');
    expect(card).toHaveAttribute('data-id', '123');
  });

  // Style tests
  test('accepts custom style', () => {
    const customStyle = { margin: '20px' };
    const { container } = render(
      <Card style={customStyle}>Content</Card>
    );
    const card = container.querySelector('.card');
    expect(card).toHaveStyle({ margin: '20px' });
  });
});
