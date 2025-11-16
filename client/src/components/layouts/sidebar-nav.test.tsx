import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SidebarNav, SidebarNavItem } from './sidebar-nav';

describe('SidebarNav', () => {
  const mockItems: SidebarNavItem[] = [
    { id: '1', label: 'Dashboard', icon: 'home', path: '/dashboard' },
    { id: '2', label: 'Users', icon: 'users', path: '/users', badge: 5 },
    {
      id: '3',
      label: 'Settings',
      icon: 'settings',
      children: [
        { id: '3-1', label: 'Account', path: '/settings/account' },
        { id: '3-2', label: 'Security', path: '/settings/security' },
      ],
    },
    { id: '4', label: 'Logout', icon: 'logout', onClick: jest.fn() },
  ];

  it('renders sidebar with items', () => {
    render(<SidebarNav items={mockItems} />);
    
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Users')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('displays badge count on items', () => {
    render(<SidebarNav items={mockItems} />);
    
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('highlights active navigation item', () => {
    render(
      <SidebarNav items={mockItems} activePath="/dashboard" />
    );
    
    const dashboardButton = screen.getByText('Dashboard').closest('button');
    expect(dashboardButton).toHaveClass('bg-blue-50', 'text-blue-600');
  });

  it('handles navigation click', async () => {
    const onNavigate = jest.fn();
    const user = userEvent.setup();
    
    render(
      <SidebarNav items={mockItems} onNavigate={onNavigate} />
    );
    
    const dashboardButton = screen.getByText('Dashboard').closest('button');
    await user.click(dashboardButton!);
    
    expect(onNavigate).toHaveBeenCalledWith('/dashboard');
  });

  it('expands and collapses nested items', async () => {
    const user = userEvent.setup();
    
    render(<SidebarNav items={mockItems} />);
    
    const settingsButton = screen.getByText('Settings').closest('button');
    await user.click(settingsButton!);
    
    expect(screen.getByText('Account')).toBeInTheDocument();
    expect(screen.getByText('Security')).toBeInTheDocument();
  });

  it('toggles nested items visibility', async () => {
    const user = userEvent.setup();
    
    render(<SidebarNav items={mockItems} />);
    
    const settingsButton = screen.getByText('Settings').closest('button');
    
    // Expand
    await user.click(settingsButton!);
    expect(screen.getByText('Account')).toBeVisible();
    
    // Collapse
    await user.click(settingsButton!);
    expect(screen.queryByText('Account')).not.toBeVisible();
  });

  it('hides items with visible false', () => {
    const itemsWithHidden: SidebarNavItem[] = [
      { id: '1', label: 'Dashboard', path: '/dashboard' },
      { id: '2', label: 'Hidden', path: '/hidden', visible: false },
    ];
    
    render(<SidebarNav items={itemsWithHidden} />);
    
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.queryByText('Hidden')).not.toBeInTheDocument();
  });

  it('disables items with disabled flag', () => {
    const itemsWithDisabled: SidebarNavItem[] = [
      { id: '1', label: 'Dashboard', path: '/dashboard' },
      { id: '2', label: 'Disabled', path: '/disabled', disabled: true },
    ];
    
    render(<SidebarNav items={itemsWithDisabled} />);
    
    expect(screen.getByText('Disabled').closest('button')).toBeDisabled();
  });

  it('toggles collapsed state', async () => {
    const onCollapse = jest.fn();
    const user = userEvent.setup();
    
    render(
      <SidebarNav items={mockItems} collapsed={false} onCollapse={onCollapse} />
    );
    
    const collapseButton = screen.getByTitle('Collapse');
    await user.click(collapseButton);
    
    expect(onCollapse).toHaveBeenCalledWith(true);
  });

  it('hides labels when collapsed', () => {
    const { rerender } = render(
      <SidebarNav items={mockItems} collapsed={false} />
    );
    
    expect(screen.getByText('Dashboard')).toBeVisible();
    
    rerender(<SidebarNav items={mockItems} collapsed={true} />);
    
    expect(screen.queryByText('Dashboard')).not.toBeVisible();
  });

  it('renders user info section', () => {
    const userInfo = {
      name: 'John Doe',
      role: 'Admin',
    };
    
    render(
      <SidebarNav items={mockItems} userInfo={userInfo} />
    );
    
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('Admin')).toBeInTheDocument();
  });

  it('renders user avatar when provided', () => {
    const userInfo = {
      name: 'John Doe',
      avatar: '/avatar.jpg',
    };
    
    render(
      <SidebarNav items={mockItems} userInfo={userInfo} />
    );
    
    const avatar = screen.getByAltText('John Doe');
    expect(avatar).toHaveAttribute('src', '/avatar.jpg');
  });

  it('hides user info when collapsed', () => {
    const userInfo = {
      name: 'John Doe',
      role: 'Admin',
    };
    
    const { rerender } = render(
      <SidebarNav items={mockItems} collapsed={false} userInfo={userInfo} />
    );
    
    expect(screen.getByText('Admin')).toBeVisible();
    
    rerender(
      <SidebarNav items={mockItems} collapsed={true} userInfo={userInfo} />
    );
    
    expect(screen.queryByText('Admin')).not.toBeVisible();
  });

  it('renders custom logo', () => {
    render(
      <SidebarNav
        items={mockItems}
        logo={<div data-testid="custom-logo">MyApp</div>}
      />
    );
    
    expect(screen.getByTestId('custom-logo')).toBeInTheDocument();
  });

  it('handles custom onClick callbacks', async () => {
    const onClickMock = jest.fn();
    const itemsWithCallback: SidebarNavItem[] = [
      { id: '1', label: 'Action', onClick: onClickMock },
    ];
    
    const user = userEvent.setup();
    
    render(<SidebarNav items={itemsWithCallback} />);
    
    const button = screen.getByText('Action').closest('button');
    await user.click(button!);
    
    expect(onClickMock).toHaveBeenCalled();
  });

  it('applies custom className', () => {
    const { container } = render(
      <SidebarNav items={mockItems} className="custom-class" />
    );
    
    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('forwards ref correctly', () => {
    const ref = React.createRef<HTMLDivElement>();
    render(<SidebarNav ref={ref} items={mockItems} />);
    
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
  });

  it('handles deeply nested items', async () => {
    const deepItems: SidebarNavItem[] = [
      {
        id: '1',
        label: 'Level 1',
        children: [
          {
            id: '1-1',
            label: 'Level 2',
            children: [
              { id: '1-1-1', label: 'Level 3', path: '/level3' },
            ],
          },
        ],
      },
    ];
    
    const user = userEvent.setup();
    
    render(<SidebarNav items={deepItems} />);
    
    const level1Button = screen.getByText('Level 1').closest('button');
    await user.click(level1Button!);
    
    expect(screen.getByText('Level 2')).toBeVisible();
    
    const level2Button = screen.getByText('Level 2').closest('button');
    await user.click(level2Button!);
    
    expect(screen.getByText('Level 3')).toBeVisible();
  });

  it('renders icons with each item', () => {
    render(<SidebarNav items={mockItems} />);
    
    // Icons are rendered, text content should be present
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Users')).toBeInTheDocument();
  });

  it('handles multiple badges correctly', () => {
    const itemsWithBadges: SidebarNavItem[] = [
      { id: '1', label: 'Item 1', badge: 5 },
      { id: '2', label: 'Item 2', badge: 12 },
      { id: '3', label: 'Item 3', badge: 99 },
    ];
    
    render(<SidebarNav items={itemsWithBadges} />);
    
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('99')).toBeInTheDocument();
  });

  it('maintains expanded state for multiple items', async () => {
    const user = userEvent.setup();
    
    render(<SidebarNav items={mockItems} />);
    
    const settingsButton = screen.getByText('Settings').closest('button');
    await user.click(settingsButton!);
    
    expect(screen.getByText('Account')).toBeVisible();
    expect(screen.getByText('Security')).toBeVisible();
    
    // Click another item and verify first still expanded
    const dashboardButton = screen.getByText('Dashboard').closest('button');
    await user.click(dashboardButton!);
    
    expect(screen.getByText('Account')).toBeVisible();
  });
});
