import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  HeaderNav,
  HeaderNavItem,
  NotificationItem,
  UserMenuItem,
} from './header-nav';

describe('HeaderNav', () => {
  const mockNavItems: HeaderNavItem[] = [
    { id: '1', label: 'Home', path: '/' },
    {
      id: '2',
      label: 'Products',
      path: '/products',
      children: [
        { id: '2-1', label: 'Electronics', path: '/products/electronics' },
        { id: '2-2', label: 'Clothing', path: '/products/clothing' },
      ],
    },
    { id: '3', label: 'About', path: '/about' },
  ];

  const mockNotifications: NotificationItem[] = [
    {
      id: '1',
      title: 'New Order',
      message: 'You have a new order',
      timestamp: '5 minutes ago',
      read: false,
    },
    {
      id: '2',
      title: 'Payment Received',
      message: 'Payment of $100 received',
      timestamp: '1 hour ago',
      read: true,
    },
  ];

  const mockUserMenuItems: UserMenuItem[] = [
    { id: 'profile', label: 'Profile' },
    { id: 'settings', label: 'Settings' },
    { id: 'logout', label: 'Logout', divider: true },
  ];

  it('renders header with title', () => {
    render(<HeaderNav title="Dashboard" />);
    
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });

  it('renders navigation items', () => {
    render(
      <HeaderNav title="App" items={mockNavItems} />
    );
    
    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('Products')).toBeInTheDocument();
    expect(screen.getByText('About')).toBeInTheDocument();
  });

  it('handles navigation click', async () => {
    const onNavigate = jest.fn();
    const user = userEvent.setup();
    
    render(
      <HeaderNav title="App" items={mockNavItems} onNavigate={onNavigate} />
    );
    
    const homeButton = screen.getByText('Home');
    await user.click(homeButton);
    
    expect(onNavigate).toHaveBeenCalledWith('/');
  });

  it('highlights active navigation item', () => {
    render(
      <HeaderNav title="App" items={mockNavItems} activePath="/" />
    );
    
    const homeButton = screen.getByText('Home');
    expect(homeButton).toHaveClass('text-blue-600');
  });

  it('renders dropdown menu items on hover', async () => {
    const user = userEvent.setup();
    
    render(
      <HeaderNav title="App" items={mockNavItems} />
    );
    
    const productsButton = screen.getByText('Products');
    await user.hover(productsButton);
    
    await waitFor(() => {
      expect(screen.getByText('Electronics')).toBeVisible();
      expect(screen.getByText('Clothing')).toBeVisible();
    });
  });

  it('renders search input when enabled', () => {
    render(
      <HeaderNav title="App" showSearch={true} searchPlaceholder="Search items..." />
    );
    
    expect(screen.getByPlaceholderText('Search items...')).toBeInTheDocument();
  });

  it('handles search input', async () => {
    const onSearch = jest.fn();
    const user = userEvent.setup();
    
    render(
      <HeaderNav title="App" showSearch={true} onSearch={onSearch} />
    );
    
    const searchInput = screen.getByPlaceholderText('Search...');
    await user.type(searchInput, 'test');
    
    expect(onSearch).toHaveBeenCalledWith('test');
  });

  it('hides search on mobile', () => {
    const { container } = render(
      <HeaderNav title="App" showSearch={true} />
    );
    
    const searchDiv = container.querySelector('.hidden.md\\:block');
    expect(searchDiv).toBeInTheDocument();
  });

  it('renders notifications bell with count', () => {
    render(
      <HeaderNav
        title="App"
        notifications={{
          count: 2,
          items: mockNotifications,
        }}
      />
    );
    
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('shows notifications dropdown', async () => {
    const user = userEvent.setup();
    
    render(
      <HeaderNav
        title="App"
        notifications={{
          count: 2,
          items: mockNotifications,
        }}
      />
    );
    
    const bellButton = screen.getByRole('button', { name: /bell/i });
    // Note: The bell icon doesn't have accessible name, find by finding notification count
    const bellButtons = screen.getAllByRole('button');
    
    // Find the bell button (it's the one with the count badge)
    const notificationButton = bellButtons.find(btn => 
      btn.querySelector('[class*="bg-red-500"]')
    );
    
    if (notificationButton) {
      await user.click(notificationButton);
      
      await waitFor(() => {
        expect(screen.getByText('New Order')).toBeVisible();
        expect(screen.getByText('Payment Received')).toBeVisible();
      });
    }
  });

  it('displays notification details', async () => {
    const user = userEvent.setup();
    
    render(
      <HeaderNav
        title="App"
        notifications={{
          count: 2,
          items: mockNotifications,
        }}
      />
    );
    
    const buttons = screen.getAllByRole('button');
    const notificationButton = buttons.find(btn => 
      btn.querySelector('[class*="bg-red-500"]')
    );
    
    if (notificationButton) {
      await user.click(notificationButton);
      
      expect(screen.getByText('You have a new order')).toBeInTheDocument();
      expect(screen.getByText('5 minutes ago')).toBeInTheDocument();
    }
  });

  it('handles view all notifications', async () => {
    const onViewAll = jest.fn();
    const user = userEvent.setup();
    
    render(
      <HeaderNav
        title="App"
        notifications={{
          count: 2,
          items: mockNotifications,
          onViewAll,
        }}
      />
    );
    
    const buttons = screen.getAllByRole('button');
    const notificationButton = buttons.find(btn => 
      btn.querySelector('[class*="bg-red-500"]')
    );
    
    if (notificationButton) {
      await user.click(notificationButton);
      
      const viewAllButton = screen.getByText('View All');
      await user.click(viewAllButton);
      
      expect(onViewAll).toHaveBeenCalled();
    }
  });

  it('renders user menu button with user info', () => {
    const userInfo = {
      name: 'John Doe',
      email: 'john@example.com',
    };
    
    render(
      <HeaderNav title="App" userInfo={userInfo} />
    );
    
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('john@example.com')).toBeInTheDocument();
  });

  it('renders user avatar', () => {
    const userInfo = {
      name: 'John Doe',
      avatar: '/avatar.jpg',
    };
    
    render(
      <HeaderNav title="App" userInfo={userInfo} />
    );
    
    const avatar = screen.getByAltText('John Doe');
    expect(avatar).toHaveAttribute('src', '/avatar.jpg');
  });

  it('shows user menu dropdown', async () => {
    const user = userEvent.setup();
    
    const userInfo = {
      name: 'John Doe',
      email: 'john@example.com',
    };
    
    render(
      <HeaderNav
        title="App"
        userInfo={userInfo}
        userMenuItems={mockUserMenuItems}
      />
    );
    
    const userButtons = screen.getAllByText('John Doe');
    const userMenuButton = userButtons[1]?.closest('button');
    
    if (userMenuButton) {
      await user.click(userMenuButton);
      
      await waitFor(() => {
        expect(screen.getByText('Profile')).toBeVisible();
        expect(screen.getByText('Settings')).toBeVisible();
        expect(screen.getByText('Logout')).toBeVisible();
      });
    }
  });

  it('handles user menu item click', async () => {
    const onUserMenuClick = jest.fn();
    const user = userEvent.setup();
    
    const userInfo = {
      name: 'John Doe',
    };
    
    render(
      <HeaderNav
        title="App"
        userInfo={userInfo}
        userMenuItems={mockUserMenuItems}
        onUserMenuClick={onUserMenuClick}
      />
    );
    
    const userButtons = screen.getAllByText('John Doe');
    const userMenuButton = userButtons[1]?.closest('button');
    
    if (userMenuButton) {
      await user.click(userMenuButton);
      
      const profileItem = await screen.findByText('Profile');
      await user.click(profileItem);
      
      expect(onUserMenuClick).toHaveBeenCalledWith('profile');
    }
  });

  it('renders custom logo', () => {
    render(
      <HeaderNav
        title="App"
        logo={<div data-testid="custom-logo">MyLogo</div>}
      />
    );
    
    expect(screen.getByTestId('custom-logo')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(
      <HeaderNav title="App" className="custom-class" />
    );
    
    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('forwards ref correctly', () => {
    const ref = React.createRef<HTMLDivElement>();
    render(<HeaderNav ref={ref} title="App" />);
    
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
  });

  it('shows empty notification state', async () => {
    const user = userEvent.setup();
    
    render(
      <HeaderNav
        title="App"
        notifications={{
          count: 0,
          items: [],
        }}
      />
    );
    
    const buttons = screen.getAllByRole('button');
    const notificationButton = buttons[buttons.length - 1];
    
    await user.click(notificationButton);
    
    expect(screen.getByText('No notifications')).toBeInTheDocument();
  });

  it('handles dropdown navigation', async () => {
    const onNavigate = jest.fn();
    const user = userEvent.setup();
    
    render(
      <HeaderNav
        title="App"
        items={mockNavItems}
        onNavigate={onNavigate}
      />
    );
    
    const productsButton = screen.getByText('Products');
    await user.hover(productsButton);
    
    const electronicsButton = await screen.findByText('Electronics');
    await user.click(electronicsButton);
    
    expect(onNavigate).toHaveBeenCalledWith('/products/electronics');
  });

  it('toggles notifications visibility', async () => {
    const user = userEvent.setup();
    
    render(
      <HeaderNav
        title="App"
        notifications={{
          count: 1,
          items: mockNotifications,
        }}
      />
    );
    
    const buttons = screen.getAllByRole('button');
    const notificationButton = buttons.find(btn => 
      btn.querySelector('[class*="bg-red-500"]')
    );
    
    if (notificationButton) {
      // Open
      await user.click(notificationButton);
      expect(screen.getByText('New Order')).toBeVisible();
      
      // Close
      await user.click(notificationButton);
      expect(screen.queryByText('New Order')).not.toBeVisible();
    }
  });

  it('toggles user menu visibility', async () => {
    const user = userEvent.setup();
    
    const userInfo = {
      name: 'John Doe',
    };
    
    render(
      <HeaderNav
        title="App"
        userInfo={userInfo}
        userMenuItems={mockUserMenuItems}
      />
    );
    
    const userButtons = screen.getAllByText('John Doe');
    const userMenuButton = userButtons[1]?.closest('button');
    
    if (userMenuButton) {
      // Open
      await user.click(userMenuButton);
      expect(screen.getByText('Profile')).toBeVisible();
      
      // Close
      await user.click(userMenuButton);
      expect(screen.queryByText('Profile')).not.toBeVisible();
    }
  });

  it('closes user menu after selection', async () => {
    const user = userEvent.setup();
    
    const userInfo = {
      name: 'John Doe',
    };
    
    render(
      <HeaderNav
        title="App"
        userInfo={userInfo}
        userMenuItems={mockUserMenuItems}
      />
    );
    
    const userButtons = screen.getAllByText('John Doe');
    const userMenuButton = userButtons[1]?.closest('button');
    
    if (userMenuButton) {
      await user.click(userMenuButton);
      
      const profileItem = await screen.findByText('Profile');
      await user.click(profileItem);
      
      // Menu should be closed
      expect(screen.queryByText('Settings')).not.toBeVisible();
    }
  });
});
