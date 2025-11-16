import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  DetailLayout,
  DetailSection,
  DetailField,
  DetailRow,
  DetailAction,
  TabDefinition,
} from './detail-layout';

describe('DetailLayout', () => {
  const mockActions: DetailAction[] = [
    { id: 'edit', label: 'Edit', variant: 'primary' },
    { id: 'delete', label: 'Delete', variant: 'danger' },
  ];

  const mockTabs: TabDefinition[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'details', label: 'Details' },
    { id: 'history', label: 'History', badge: 5 },
  ];

  const mockBreadcrumbs = [
    { label: 'Home', path: '/' },
    { label: 'Users', path: '/users' },
    { label: 'John Doe', isActive: true },
  ];

  it('renders detail layout with title', () => {
    render(
      <DetailLayout title="User Details">
        <p>Content</p>
      </DetailLayout>
    );
    
    expect(screen.getByText('User Details')).toBeInTheDocument();
  });

  it('displays subtitle when provided', () => {
    render(
      <DetailLayout title="User Details" subtitle="Manage user information">
        <p>Content</p>
      </DetailLayout>
    );
    
    expect(screen.getByText('Manage user information')).toBeInTheDocument();
  });

  it('renders status badge with correct color', () => {
    render(
      <DetailLayout
        title="User Details"
        status="Active"
        statusColor="success"
      >
        <p>Content</p>
      </DetailLayout>
    );
    
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('renders action buttons', () => {
    render(
      <DetailLayout title="User Details" actions={mockActions}>
        <p>Content</p>
      </DetailLayout>
    );
    
    expect(screen.getByText('Edit')).toBeInTheDocument();
    expect(screen.getByText('Delete')).toBeInTheDocument();
  });

  it('handles action clicks', async () => {
    const onAction = jest.fn();
    const user = userEvent.setup();
    
    render(
      <DetailLayout title="User Details" actions={mockActions} onAction={onAction}>
        <p>Content</p>
      </DetailLayout>
    );
    
    const editButton = screen.getByText('Edit');
    await user.click(editButton);
    
    expect(onAction).toHaveBeenCalledWith('edit');
  });

  it('renders tabs navigation', () => {
    render(
      <DetailLayout title="User Details" tabs={mockTabs} activeTab="overview">
        <p>Content</p>
      </DetailLayout>
    );
    
    expect(screen.getByText('Overview')).toBeInTheDocument();
    expect(screen.getByText('Details')).toBeInTheDocument();
    expect(screen.getByText('History')).toBeInTheDocument();
  });

  it('shows badge count on tabs', () => {
    render(
      <DetailLayout title="User Details" tabs={mockTabs} activeTab="overview">
        <p>Content</p>
      </DetailLayout>
    );
    
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('handles tab changes', async () => {
    const onTabChange = jest.fn();
    const user = userEvent.setup();
    
    render(
      <DetailLayout
        title="User Details"
        tabs={mockTabs}
        activeTab="overview"
        onTabChange={onTabChange}
      >
        <p>Content</p>
      </DetailLayout>
    );
    
    const detailsTab = screen.getByText('Details');
    await user.click(detailsTab);
    
    expect(onTabChange).toHaveBeenCalledWith('details');
  });

  it('highlights active tab', () => {
    render(
      <DetailLayout title="User Details" tabs={mockTabs} activeTab="overview">
        <p>Content</p>
      </DetailLayout>
    );
    
    const overviewTab = screen.getByText('Overview').closest('button');
    expect(overviewTab).toHaveClass('text-blue-600');
  });

  it('renders breadcrumb navigation', () => {
    render(
      <DetailLayout title="User Details" breadcrumbs={mockBreadcrumbs}>
        <p>Content</p>
      </DetailLayout>
    );
    
    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('Users')).toBeInTheDocument();
    expect(screen.getByText('John Doe')).toBeInTheDocument();
  });

  it('handles breadcrumb navigation', async () => {
    const onBreadcrumbClick = jest.fn();
    const user = userEvent.setup();
    
    render(
      <DetailLayout
        title="User Details"
        breadcrumbs={mockBreadcrumbs}
        onBreadcrumbClick={onBreadcrumbClick}
      >
        <p>Content</p>
      </DetailLayout>
    );
    
    const usersLink = screen.getByText('Users');
    await user.click(usersLink);
    
    expect(onBreadcrumbClick).toHaveBeenCalledWith('/users');
  });

  it('renders back button', async () => {
    const onBack = jest.fn();
    const user = userEvent.setup();
    
    render(
      <DetailLayout title="User Details" onBack={onBack}>
        <p>Content</p>
      </DetailLayout>
    );
    
    const backButton = screen.getByText('Back');
    await user.click(backButton);
    
    expect(onBack).toHaveBeenCalled();
  });

  it('renders children content', () => {
    render(
      <DetailLayout title="User Details">
        <div data-testid="detail-content">Custom Content</div>
      </DetailLayout>
    );
    
    expect(screen.getByTestId('detail-content')).toBeInTheDocument();
  });

  it('renders sidebar when provided', () => {
    render(
      <DetailLayout title="User Details" sidebar={<div>Sidebar Content</div>}>
        <div>Main Content</div>
      </DetailLayout>
    );
    
    expect(screen.getByText('Sidebar Content')).toBeInTheDocument();
    expect(screen.getByText('Main Content')).toBeInTheDocument();
  });

  it('shows loading state', () => {
    render(
      <DetailLayout title="User Details" isLoading={true}>
        <p>Content</p>
      </DetailLayout>
    );
    
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('renders with custom className', () => {
    const { container } = render(
      <DetailLayout title="User Details" className="custom-class">
        <p>Content</p>
      </DetailLayout>
    );
    
    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('forwards ref correctly', () => {
    const ref = React.createRef<HTMLDivElement>();
    render(
      <DetailLayout ref={ref} title="User Details">
        <p>Content</p>
      </DetailLayout>
    );
    
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
  });

  it('disables disabled actions', () => {
    const actionsWithDisabled: DetailAction[] = [
      { id: 'edit', label: 'Edit' },
      { id: 'delete', label: 'Delete', disabled: true },
    ];
    
    render(
      <DetailLayout title="User Details" actions={actionsWithDisabled}>
        <p>Content</p>
      </DetailLayout>
    );
    
    expect(screen.getByText('Delete')).toBeDisabled();
  });

  it('applies different status colors', () => {
    const { rerender } = render(
      <DetailLayout title="User Details" status="Active" statusColor="success">
        <p>Content</p>
      </DetailLayout>
    );
    
    expect(screen.getByText('Active')).toHaveClass('bg-green-100');
    
    rerender(
      <DetailLayout title="User Details" status="Error" statusColor="error">
        <p>Content</p>
      </DetailLayout>
    );
    
    expect(screen.getByText('Error')).toHaveClass('bg-red-100');
  });
});

describe('DetailSection', () => {
  it('renders section with title', () => {
    render(
      <DetailSection title="Personal Information">
        <p>Content</p>
      </DetailSection>
    );
    
    expect(screen.getByText('Personal Information')).toBeInTheDocument();
  });

  it('renders section with subtitle', () => {
    render(
      <DetailSection title="Personal Information" subtitle="Update your details">
        <p>Content</p>
      </DetailSection>
    );
    
    expect(screen.getByText('Update your details')).toBeInTheDocument();
  });

  it('renders children content', () => {
    render(
      <DetailSection title="Section">
        <div data-testid="section-content">Content</div>
      </DetailSection>
    );
    
    expect(screen.getByTestId('section-content')).toBeInTheDocument();
  });

  it('forwards ref correctly', () => {
    const ref = React.createRef<HTMLDivElement>();
    render(
      <DetailSection ref={ref} title="Section">
        Content
      </DetailSection>
    );
    
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
  });
});

describe('DetailField', () => {
  it('renders field with label and value', () => {
    render(<DetailField label="Email" value="john@example.com" />);
    
    expect(screen.getByText('Email')).toBeInTheDocument();
    expect(screen.getByText('john@example.com')).toBeInTheDocument();
  });

  it('renders field with children', () => {
    render(
      <DetailField label="Email">
        <div data-testid="field-content">Custom Content</div>
      </DetailField>
    );
    
    expect(screen.getByTestId('field-content')).toBeInTheDocument();
  });

  it('shows "Not provided" when no value', () => {
    render(<DetailField label="Phone" />);
    
    expect(screen.getByText('Not provided')).toBeInTheDocument();
  });

  it('forwards ref correctly', () => {
    const ref = React.createRef<HTMLDivElement>();
    render(<DetailField ref={ref} label="Email" value="john@example.com" />);
    
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
  });
});

describe('DetailRow', () => {
  it('renders multiple fields in a row', () => {
    render(
      <DetailRow>
        <DetailField label="First Name" value="John" />
        <DetailField label="Last Name" value="Doe" />
      </DetailRow>
    );
    
    expect(screen.getByText('First Name')).toBeInTheDocument();
    expect(screen.getByText('Last Name')).toBeInTheDocument();
  });

  it('renders with custom className', () => {
    const { container } = render(
      <DetailRow className="custom-class">
        <DetailField label="Field" value="Value" />
      </DetailRow>
    );
    
    expect(container.querySelector('.custom-class')).toBeInTheDocument();
  });

  it('forwards ref correctly', () => {
    const ref = React.createRef<HTMLDivElement>();
    render(
      <DetailRow ref={ref}>
        <DetailField label="Field" value="Value" />
      </DetailRow>
    );
    
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
  });
});
