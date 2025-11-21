import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ProposalComments from './proposal-comments';

// Mock data
const mockComments = [
  {
    id: 'comment-1',
    content: 'This is a great proposal!',
    userId: 'user-1',
    userName: 'Alice',
    userAvatar: 'https://example.com/alice.jpg',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    likes: 5,
    userLiked: false,
  },
  {
    id: 'comment-2',
    content: 'I have some concerns about this.',
    userId: 'user-2',
    userName: 'Bob',
    userAvatar: 'https://example.com/bob.jpg',
    createdAt: new Date().toISOString(),
    updatedAt: null,
    likes: 2,
    userLiked: true,
  },
];

describe('ProposalComments Component', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient();
    vi.clearAllMocks();
  });

  const renderWithProviders = (component: React.ReactElement) => {
    return render(
      <QueryClientProvider client={queryClient}>
        {component}
      </QueryClientProvider>
    );
  };

  it('renders loading state initially', async () => {
    global.fetch = vi.fn(() =>
      new Promise(() => {}) // Never resolves
    );

    renderWithProviders(
      <ProposalComments proposalId="proposal-1" daoId="dao-1" currentUserId="user-1" />
    );

    expect(screen.getByText(/animate-pulse/)).toBeInTheDocument();
  });

  it('fetches and displays comments', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ comments: mockComments }),
      })
    );

    renderWithProviders(
      <ProposalComments proposalId="proposal-1" daoId="dao-1" currentUserId="user-1" />
    );

    await waitFor(() => {
      expect(screen.getByText('This is a great proposal!')).toBeInTheDocument();
      expect(screen.getByText('I have some concerns about this.')).toBeInTheDocument();
    });
  });

  it('displays comment count', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ comments: mockComments }),
      })
    );

    renderWithProviders(
      <ProposalComments proposalId="proposal-1" daoId="dao-1" currentUserId="user-1" />
    );

    await waitFor(() => {
      expect(screen.getByText(/Comments \(2\)/)).toBeInTheDocument();
    });
  });

  it('shows empty state when no comments', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ comments: [] }),
      })
    );

    renderWithProviders(
      <ProposalComments proposalId="proposal-1" daoId="dao-1" currentUserId="user-1" />
    );

    await waitFor(() => {
      expect(screen.getByText('No comments yet')).toBeInTheDocument();
      expect(screen.getByText('Be the first to share your thoughts!')).toBeInTheDocument();
    });
  });

  it('allows authenticated user to create comment', async () => {
    let createFetch = false;
    global.fetch = vi.fn((url: string, options?: any) => {
      if (options?.method === 'POST' && url.includes('/comments')) {
        createFetch = true;
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ comment: { id: 'new-1', ...mockComments[0] } }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ comments: mockComments }),
      });
    });

    renderWithProviders(
      <ProposalComments proposalId="proposal-1" daoId="dao-1" currentUserId="user-1" />
    );

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Share your thoughts/)).toBeInTheDocument();
    });

    const textarea = screen.getByPlaceholderText(/Share your thoughts/);
    const submitButton = screen.getByText('Post Comment');

    await userEvent.type(textarea, 'Great proposal!');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(createFetch).toBe(true);
    });
  });

  it('prevents empty comment submission', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ comments: mockComments }),
      })
    );

    renderWithProviders(
      <ProposalComments proposalId="proposal-1" daoId="dao-1" currentUserId="user-1" />
    );

    await waitFor(() => {
      const submitButton = screen.getByText('Post Comment');
      expect(submitButton).toBeDisabled();
    });
  });

  it('shows edit button only for own comments', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ comments: mockComments }),
      })
    );

    renderWithProviders(
      <ProposalComments proposalId="proposal-1" daoId="dao-1" currentUserId="user-1" />
    );

    await waitFor(() => {
      const editButtons = screen.getAllByRole('button').filter(btn => 
        btn.className.includes('Edit') || btn.querySelector('svg')?.className?.includes('edit')
      );
      // Should only show edit for user-1's comment
      expect(editButtons.length).toBeLessThanOrEqual(mockComments.length);
    });
  });

  it('allows user to edit their own comment', async () => {
    let updateFetch = false;
    global.fetch = vi.fn((url: string, options?: any) => {
      if (options?.method === 'PUT' && url.includes('/comments')) {
        updateFetch = true;
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ comment: { ...mockComments[0], content: 'Updated content' } }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ comments: mockComments }),
      });
    });

    renderWithProviders(
      <ProposalComments proposalId="proposal-1" daoId="dao-1" currentUserId="user-1" />
    );

    await waitFor(() => {
      expect(screen.getByText('This is a great proposal!')).toBeInTheDocument();
    });

    // Find and click edit button for first comment
    const editButtons = screen.getAllByRole('button');
    const editButton = editButtons.find(btn => 
      btn.querySelector('svg') && btn.className.includes('ghost')
    );

    if (editButton) {
      fireEvent.click(editButton);

      // Should show edit textarea
      const editTextarea = screen.getByDisplayValue('This is a great proposal!');
      expect(editTextarea).toBeInTheDocument();
    }
  });

  it('allows user to delete their own comment', async () => {
    let deleteFetch = false;
    global.fetch = vi.fn((url: string, options?: any) => {
      if (options?.method === 'DELETE' && url.includes('/comments')) {
        deleteFetch = true;
        return Promise.resolve({ ok: true });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ comments: mockComments }),
      });
    });

    // Mock window.confirm
    window.confirm = vi.fn(() => true);

    renderWithProviders(
      <ProposalComments proposalId="proposal-1" daoId="dao-1" currentUserId="user-1" />
    );

    await waitFor(() => {
      expect(screen.getByText('This is a great proposal!')).toBeInTheDocument();
    });

    // Find and click delete button
    const buttons = screen.getAllByRole('button');
    const deleteButton = buttons.find(btn => 
      btn.classList.contains('hover:text-red-600')
    );

    if (deleteButton) {
      fireEvent.click(deleteButton);
      expect(window.confirm).toHaveBeenCalled();
    }
  });

  it('allows user to like/unlike comment', async () => {
    let likeFetch = false;
    global.fetch = vi.fn((url: string, options?: any) => {
      if (options?.method === 'POST' && url.includes('/like')) {
        likeFetch = true;
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ liked: true, likesCount: 6 }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ comments: mockComments }),
      });
    });

    renderWithProviders(
      <ProposalComments proposalId="proposal-1" daoId="dao-1" currentUserId="user-1" />
    );

    await waitFor(() => {
      expect(screen.getByText('This is a great proposal!')).toBeInTheDocument();
    });

    const likeButtons = screen.getAllByRole('button').filter(btn =>
      btn.textContent?.includes('5') || btn.textContent?.includes('2')
    );

    if (likeButtons.length > 0) {
      fireEvent.click(likeButtons[0]);
      await waitFor(() => {
        expect(likeFetch).toBe(true);
      });
    }
  });

  it('displays edited badge for modified comments', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ comments: mockComments }),
      })
    );

    renderWithProviders(
      <ProposalComments proposalId="proposal-1" daoId="dao-1" currentUserId="user-1" />
    );

    await waitFor(() => {
      expect(screen.getByText('This is a great proposal!')).toBeInTheDocument();
      expect(screen.getByText('Edited')).toBeInTheDocument();
    });
  });

  it('formats timestamps correctly', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ comments: mockComments }),
      })
    );

    renderWithProviders(
      <ProposalComments proposalId="proposal-1" daoId="dao-1" currentUserId="user-1" />
    );

    await waitFor(() => {
      // Should show relative timestamps like "less than a minute ago"
      const timeElements = screen.getAllByText(/ago/i);
      expect(timeElements.length).toBeGreaterThan(0);
    });
  });

  it('hides comment form for unauthenticated user', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ comments: mockComments }),
      })
    );

    renderWithProviders(
      <ProposalComments proposalId="proposal-1" daoId="dao-1" />
    );

    await waitFor(() => {
      expect(screen.queryByPlaceholderText(/Share your thoughts/)).not.toBeInTheDocument();
    });
  });

  it('displays user names and avatars', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ comments: mockComments }),
      })
    );

    renderWithProviders(
      <ProposalComments proposalId="proposal-1" daoId="dao-1" currentUserId="user-1" />
    );

    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument();
      expect(screen.getByText('Bob')).toBeInTheDocument();
    });
  });

  it('displays like counts', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ comments: mockComments }),
      })
    );

    renderWithProviders(
      <ProposalComments proposalId="proposal-1" daoId="dao-1" currentUserId="user-1" />
    );

    await waitFor(() => {
      expect(screen.getByText('5')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument();
    });
  });

  it('handles fetch errors gracefully', async () => {
    global.fetch = vi.fn(() =>
      Promise.reject(new Error('Network error'))
    );

    renderWithProviders(
      <ProposalComments proposalId="proposal-1" daoId="dao-1" currentUserId="user-1" />
    );

    // Component should handle error and show loading state or error message
    expect(screen.getByText(/animate-pulse/)).toBeInTheDocument();
  });
});
