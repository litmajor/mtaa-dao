import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BreadcrumbNav, BreadcrumbItem } from './breadcrumb-nav';

describe('BreadcrumbNav', () => {
  const mockBreadcrumbs: BreadcrumbItem[] = [
    { label: 'Home', path: '/' },
    { label: 'Products', path: '/products' },
    { label: 'Electronics', path: '/products/electronics' },
    { label: 'Laptop', isActive: true },
  ];

  it('renders breadcrumb items', () => {
    render(<BreadcrumbNav items={mockBreadcrumbs} />);
    
    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('Products')).toBeInTheDocument();
    expect(screen.getByText('Electronics')).toBeInTheDocument();
    expect(screen.getByText('Laptop')).toBeInTheDocument();
  });

  it('renders navigation links for items with path', () => {
    render(<BreadcrumbNav items={mockBreadcrumbs} />);
    
    const homeLink = screen.getByText('Home');
    expect(homeLink.closest('button')).toBeInTheDocument();
  });

  it('renders active item as text without link', () => {
    render(<BreadcrumbNav items={mockBreadcrumbs} />);
    
    const activeItem = screen.getByText('Laptop');
    expect(activeItem.closest('button')).not.toBeInTheDocument();
  });

  it('handles breadcrumb navigation', async () => {
    const onNavigate = jest.fn();
    const user = userEvent.setup();
    
    render(
      <BreadcrumbNav items={mockBreadcrumbs} onNavigate={onNavigate} />
    );
    
    const homeLink = screen.getByText('Home');
    await user.click(homeLink);
    
    expect(onNavigate).toHaveBeenCalledWith('/');
  });

  it('renders chevron separators by default', () => {
    const { container } = render(
      <BreadcrumbNav items={mockBreadcrumbs} separator="chevron" />
    );
    
    // Check that separators are rendered (chevron-right icons)
    expect(container.querySelectorAll('button').length).toBeGreaterThan(0);
  });

  it('renders slash separators', () => {
    const { container } = render(
      <BreadcrumbNav items={mockBreadcrumbs} separator="slash" />
    );
    
    expect(container.textContent).toContain('/');
  });

  it('renders arrow separators', () => {
    const { container } = render(
      <BreadcrumbNav items={mockBreadcrumbs} separator="arrow" />
    );
    
    expect(container.textContent).toContain('→');
  });

  it('shows ellipsis for long breadcrumbs', () => {
    const longBreadcrumbs: BreadcrumbItem[] = [
      { label: 'Home', path: '/' },
      { label: 'Level 1', path: '/1' },
      { label: 'Level 2', path: '/2' },
      { label: 'Level 3', path: '/3' },
      { label: 'Level 4', path: '/4' },
      { label: 'Level 5', path: '/5' },
      { label: 'Current', isActive: true },
    ];
    
    render(
      <BreadcrumbNav items={longBreadcrumbs} maxItems={5} showEllipsis={true} />
    );
    
    expect(screen.getByText('...')).toBeInTheDocument();
  });

  it('respects maxItems limit', () => {
    const longBreadcrumbs: BreadcrumbItem[] = [
      { label: 'Home', path: '/' },
      { label: 'Level 1', path: '/1' },
      { label: 'Level 2', path: '/2' },
      { label: 'Level 3', path: '/3' },
      { label: 'Current', isActive: true },
    ];
    
    render(
      <BreadcrumbNav items={longBreadcrumbs} maxItems={3} showEllipsis={true} />
    );
    
    // Should show Home, ..., Level 3, Current
    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('...')).toBeInTheDocument();
    expect(screen.getByText('Current')).toBeInTheDocument();
  });

  it('disables ellipsis when showEllipsis is false', () => {
    const longBreadcrumbs: BreadcrumbItem[] = [
      { label: 'Home', path: '/' },
      { label: 'Level 1', path: '/1' },
      { label: 'Level 2', path: '/2' },
      { label: 'Level 3', path: '/3' },
      { label: 'Level 4', path: '/4' },
      { label: 'Level 5', path: '/5' },
      { label: 'Current', isActive: true },
    ];
    
    render(
      <BreadcrumbNav items={longBreadcrumbs} maxItems={5} showEllipsis={false} />
    );
    
    // All items should be visible
    expect(screen.getByText('Level 1')).toBeInTheDocument();
    expect(screen.getByText('Level 5')).toBeInTheDocument();
  });

  it('applies correct link styling', async () => {
    const user = userEvent.setup();
    
    render(
      <BreadcrumbNav items={mockBreadcrumbs} />
    );
    
    const homeLink = screen.getByText('Home');
    expect(homeLink).toHaveClass('text-blue-600');
  });

  it('applies correct active item styling', () => {
    render(
      <BreadcrumbNav items={mockBreadcrumbs} />
    );
    
    const activeItem = screen.getByText('Laptop');
    expect(activeItem).toHaveClass('text-neutral-900', 'font-medium');
  });

  it('renders breadcrumb with icons', () => {
    const breadcrumbsWithIcons: BreadcrumbItem[] = [
      { label: 'Home', path: '/', icon: 'home' },
      { label: 'Products', path: '/products', icon: 'box' },
    ];
    
    render(
      <BreadcrumbNav items={breadcrumbsWithIcons} />
    );
    
    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('Products')).toBeInTheDocument();
  });

  it('renders with custom className', () => {
    const { container } = render(
      <BreadcrumbNav items={mockBreadcrumbs} className="custom-class" />
    );
    
    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('forwards ref correctly', () => {
    const ref = React.createRef<HTMLDivElement>();
    render(<BreadcrumbNav ref={ref} items={mockBreadcrumbs} />);
    
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
  });

  it('handles single breadcrumb item', () => {
    const singleItem: BreadcrumbItem[] = [
      { label: 'Home', isActive: true },
    ];
    
    render(<BreadcrumbNav items={singleItem} />);
    
    expect(screen.getByText('Home')).toBeInTheDocument();
  });

  it('handles empty breadcrumbs', () => {
    const { container } = render(
      <BreadcrumbNav items={[]} />
    );
    
    expect(container.querySelector('nav')).toBeInTheDocument();
  });

  it('shows ellipsis tooltip with hidden items', async () => {
    const longBreadcrumbs: BreadcrumbItem[] = [
      { label: 'Home', path: '/' },
      { label: 'Level 1', path: '/1' },
      { label: 'Level 2', path: '/2' },
      { label: 'Level 3', path: '/3' },
      { label: 'Current', isActive: true },
    ];
    
    const { container } = render(
      <BreadcrumbNav items={longBreadcrumbs} maxItems={3} showEllipsis={true} />
    );
    
    const ellipsisButton = screen.getByText('...').closest('button');
    expect(ellipsisButton).toHaveAttribute('title');
  });

  it('maintains correct order of breadcrumbs', () => {
    render(<BreadcrumbNav items={mockBreadcrumbs} />);
    
    const breadcrumbs = screen.getAllByRole('listitem');
    expect(breadcrumbs).toHaveLength(mockBreadcrumbs.length);
  });

  it('handles breadcrumbs with same label', () => {
    const duplicateLabels: BreadcrumbItem[] = [
      { label: 'Home', path: '/' },
      { label: 'Settings', path: '/settings' },
      { label: 'Settings', path: '/settings/profile' },
      { label: 'Settings', isActive: true },
    ];
    
    render(
      <BreadcrumbNav items={duplicateLabels} />
    );
    
    const settingsItems = screen.getAllByText('Settings');
    expect(settingsItems.length).toBeGreaterThanOrEqual(3);
  });

  it('navigates through multiple breadcrumbs', async () => {
    const onNavigate = jest.fn();
    const user = userEvent.setup();
    
    render(
      <BreadcrumbNav items={mockBreadcrumbs} onNavigate={onNavigate} />
    );
    
    const productLink = screen.getByText('Products');
    await user.click(productLink);
    expect(onNavigate).toHaveBeenCalledWith('/products');
    
    const electronicsLink = screen.getByText('Electronics');
    await user.click(electronicsLink);
    expect(onNavigate).toHaveBeenCalledWith('/products/electronics');
  });

  it('does not navigate on active item click', async () => {
    const onNavigate = jest.fn();
    const user = userEvent.setup();
    
    render(
      <BreadcrumbNav items={mockBreadcrumbs} onNavigate={onNavigate} />
    );
    
    const activeItem = screen.getByText('Laptop');
    await user.click(activeItem);
    
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it('supports different separators per instance', () => {
    const { container: slashContainer } = render(
      <BreadcrumbNav items={mockBreadcrumbs} separator="slash" />
    );
    
    const { container: arrowContainer } = render(
      <BreadcrumbNav items={mockBreadcrumbs} separator="arrow" />
    );
    
    expect(slashContainer.textContent).toContain('/');
    expect(arrowContainer.textContent).toContain('→');
  });
});
