import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ListLayout, ColumnDefinition, ActionDefinition } from './list-layout';

describe('ListLayout', () => {
  const mockColumns: ColumnDefinition[] = [
    { key: 'name', label: 'Name' },
    { key: 'email', label: 'Email' },
    { key: 'status', label: 'Status' },
  ];

  const mockItems = [
    { name: 'John Doe', email: 'john@example.com', status: 'Active' },
    { name: 'Jane Smith', email: 'jane@example.com', status: 'Inactive' },
  ];

  const mockActions: ActionDefinition[] = [
    { id: 'edit', label: 'Edit' },
    { id: 'delete', label: 'Delete', variant: 'danger' },
  ];

  it('renders list layout with title', () => {
    render(
      <ListLayout
        title="Users"
        items={mockItems}
        columns={mockColumns}
      />
    );
    expect(screen.getByText('Users')).toBeInTheDocument();
  });

  it('displays subtitle when provided', () => {
    render(
      <ListLayout
        title="Users"
        subtitle="Manage your users"
        items={mockItems}
        columns={mockColumns}
      />
    );
    expect(screen.getByText('Manage your users')).toBeInTheDocument();
  });

  it('renders table view with columns and data', () => {
    render(
      <ListLayout
        title="Users"
        items={mockItems}
        columns={mockColumns}
        viewMode="table"
      />
    );
    
    // Check headers
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Email')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();
    
    // Check data
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('jane@example.com')).toBeInTheDocument();
  });

  it('renders grid view with multiple cards', () => {
    render(
      <ListLayout
        title="Users"
        items={mockItems}
        columns={mockColumns}
        viewMode="grid"
      />
    );
    
    expect(screen.getAllByText('Name')).toHaveLength(mockItems.length);
  });

  it('renders list view with item details', () => {
    render(
      <ListLayout
        title="Users"
        items={mockItems}
        columns={mockColumns}
        viewMode="list"
      />
    );
    
    expect(screen.getByText('John Doe')).toBeInTheDocument();
  });

  it('toggles between view modes', async () => {
    const { rerender } = render(
      <ListLayout
        title="Users"
        items={mockItems}
        columns={mockColumns}
        viewMode="table"
      />
    );
    
    expect(screen.getByRole('table')).toBeInTheDocument();
    
    rerender(
      <ListLayout
        title="Users"
        items={mockItems}
        columns={mockColumns}
        viewMode="grid"
      />
    );
    
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('handles search input', async () => {
    const onSearch = jest.fn();
    const user = userEvent.setup();
    
    render(
      <ListLayout
        title="Users"
        items={mockItems}
        columns={mockColumns}
        onSearch={onSearch}
        searchDelay={0}
      />
    );
    
    const searchInput = screen.getByPlaceholderText('Search...');
    await user.type(searchInput, 'john');
    
    await waitFor(() => {
      expect(onSearch).toHaveBeenCalledWith('john');
    });
  });

  it('filters items based on active filters', async () => {
    const onFilterChange = jest.fn();
    const user = userEvent.setup();
    
    render(
      <ListLayout
        title="Users"
        items={mockItems}
        columns={mockColumns}
        filters={[
          { id: 'status', label: 'Status', type: 'select', options: [
            { label: 'Active', value: 'active' },
            { label: 'Inactive', value: 'inactive' },
          ] },
        ]}
        onFilterChange={onFilterChange}
      />
    );
    
    const select = screen.getByRole('combobox');
    await user.selectOptions(select, 'active');
    
    await waitFor(() => {
      expect(onFilterChange).toHaveBeenCalled();
    });
  });

  it('renders action buttons', () => {
    render(
      <ListLayout
        title="Users"
        items={mockItems}
        columns={mockColumns}
        actions={mockActions}
        viewMode="table"
      />
    );
    
    expect(screen.getAllByText('Edit')).toHaveLength(mockItems.length);
    expect(screen.getAllByText('Delete')).toHaveLength(mockItems.length);
  });

  it('handles action clicks', async () => {
    const onAction = jest.fn();
    const user = userEvent.setup();
    
    render(
      <ListLayout
        title="Users"
        items={mockItems}
        columns={mockColumns}
        actions={mockActions}
        onAction={onAction}
        viewMode="table"
      />
    );
    
    const editButtons = screen.getAllByText('Edit');
    await user.click(editButtons[0]);
    
    expect(onAction).toHaveBeenCalledWith('edit', mockItems[0]);
  });

  it('renders pagination controls', () => {
    render(
      <ListLayout
        title="Users"
        items={mockItems}
        columns={mockColumns}
        page={1}
        pageSize={10}
        total={25}
      />
    );
    
    expect(screen.getByText('Previous')).toBeInTheDocument();
    expect(screen.getByText('Next')).toBeInTheDocument();
  });

  it('handles pagination changes', async () => {
    const onPageChange = jest.fn();
    const user = userEvent.setup();
    
    render(
      <ListLayout
        title="Users"
        items={mockItems}
        columns={mockColumns}
        page={1}
        pageSize={10}
        total={25}
        onPageChange={onPageChange}
      />
    );
    
    const nextButton = screen.getByText('Next');
    await user.click(nextButton);
    
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it('disables previous button on first page', () => {
    render(
      <ListLayout
        title="Users"
        items={mockItems}
        columns={mockColumns}
        page={1}
        pageSize={10}
        total={25}
      />
    );
    
    expect(screen.getByText('Previous')).toBeDisabled();
  });

  it('disables next button on last page', () => {
    render(
      <ListLayout
        title="Users"
        items={mockItems}
        columns={mockColumns}
        page={3}
        pageSize={10}
        total={25}
      />
    );
    
    expect(screen.getByText('Next')).toBeDisabled();
  });

  it('shows loading state', () => {
    render(
      <ListLayout
        title="Users"
        items={[]}
        columns={mockColumns}
        isLoading={true}
      />
    );
    
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('shows empty message when no items', () => {
    render(
      <ListLayout
        title="Users"
        items={[]}
        columns={mockColumns}
        emptyMessage="No users found"
      />
    );
    
    expect(screen.getByText('No users found')).toBeInTheDocument();
  });

  it('renders column with custom render function', () => {
    const customColumns: ColumnDefinition[] = [
      {
        key: 'status',
        label: 'Status',
        render: (value) => `Status: ${value}`,
      },
    ];
    
    render(
      <ListLayout
        title="Users"
        items={mockItems}
        columns={customColumns}
        viewMode="table"
      />
    );
    
    expect(screen.getByText('Status: Active')).toBeInTheDocument();
  });

  it('renders with custom className', () => {
    const { container } = render(
      <ListLayout
        title="Users"
        items={mockItems}
        columns={mockColumns}
        className="custom-class"
      />
    );
    
    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('forwards ref correctly', () => {
    const ref = React.createRef<HTMLDivElement>();
    render(
      <ListLayout
        ref={ref}
        title="Users"
        items={mockItems}
        columns={mockColumns}
      />
    );
    
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
  });

  it('displays total item count in pagination', () => {
    render(
      <ListLayout
        title="Users"
        items={mockItems}
        columns={mockColumns}
        page={1}
        pageSize={10}
        total={35}
      />
    );
    
    expect(screen.getByText(/of 35 items/)).toBeInTheDocument();
  });

  it('handles multiple filters', async () => {
    const onFilterChange = jest.fn();
    
    render(
      <ListLayout
        title="Users"
        items={mockItems}
        columns={mockColumns}
        filters={[
          { id: 'status', label: 'Status', type: 'text' },
          { id: 'role', label: 'Role', type: 'select', options: [
            { label: 'Admin', value: 'admin' },
            { label: 'User', value: 'user' },
          ] },
        ]}
        onFilterChange={onFilterChange}
      />
    );
    
    expect(screen.getByText('Status:')).toBeInTheDocument();
    expect(screen.getByText('Role:')).toBeInTheDocument();
  });
});
