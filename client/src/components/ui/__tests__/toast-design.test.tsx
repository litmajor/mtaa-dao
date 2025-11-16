// @ts-nocheck
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToastProvider, useToast } from '../toast-design';

const ToastConsumer = () => {
  const toast = useToast();
  
  return (
    <div>
      <button onClick={() => toast.success('Success message')}>Show Success</button>
      <button onClick={() => toast.error('Error message')}>Show Error</button>
      <button onClick={() => toast.warning('Warning message')}>Show Warning</button>
      <button onClick={() => toast.info('Info message')}>Show Info</button>
      <button onClick={() => toast.toast('Custom message')}>Show Custom</button>
    </div>
  );
};

describe('Toast Component', () => {
  const renderWithToast = (component = <ToastConsumer />) => {
    return render(
      <ToastProvider>
        {component}
      </ToastProvider>
    );
  };

  describe('Render', () => {
    it('should render toast provider', () => {
      renderWithToast();
      expect(screen.getByText('Show Success')).toBeInTheDocument();
    });

    it('should not render toast initially', () => {
      renderWithToast();
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    it('should render toast when added', async () => {
      renderWithToast();
      fireEvent.click(screen.getByText('Show Success'));
      
      await waitFor(() => {
        expect(screen.getByText('Success message')).toBeInTheDocument();
      });
    });

    it('should render multiple toasts', async () => {
      renderWithToast();
      fireEvent.click(screen.getByText('Show Success'));
      fireEvent.click(screen.getByText('Show Error'));
      
      await waitFor(() => {
        expect(screen.getByText('Success message')).toBeInTheDocument();
        expect(screen.getByText('Error message')).toBeInTheDocument();
      });
    });
  });

  describe('Toast Types', () => {
    it('should render success toast', async () => {
      renderWithToast();
      fireEvent.click(screen.getByText('Show Success'));
      
      await waitFor(() => {
        expect(screen.getByText('Success message')).toBeInTheDocument();
      });
    });

    it('should render error toast', async () => {
      renderWithToast();
      fireEvent.click(screen.getByText('Show Error'));
      
      await waitFor(() => {
        expect(screen.getByText('Error message')).toBeInTheDocument();
      });
    });

    it('should render warning toast', async () => {
      renderWithToast();
      fireEvent.click(screen.getByText('Show Warning'));
      
      await waitFor(() => {
        expect(screen.getByText('Warning message')).toBeInTheDocument();
      });
    });

    it('should render info toast', async () => {
      renderWithToast();
      fireEvent.click(screen.getByText('Show Info'));
      
      await waitFor(() => {
        expect(screen.getByText('Info message')).toBeInTheDocument();
      });
    });

    it('should apply different colors for each type', async () => {
      const { container } = render(
        <ToastProvider>
          <ToastConsumer />
        </ToastProvider>
      );
      
      fireEvent.click(screen.getByText('Show Success'));
      
      await waitFor(() => {
        const toast = container.querySelector('.bg-green-50');
        expect(toast).toBeInTheDocument();
      });
    });
  });

  describe('Close', () => {
    it('should close toast on close button click', async () => {
      renderWithToast();
      fireEvent.click(screen.getByText('Show Success'));
      
      await waitFor(() => {
        expect(screen.getByText('Success message')).toBeInTheDocument();
      });
      
      const closeButton = screen.getByLabelText('Dismiss notification');
      fireEvent.click(closeButton);
      
      await waitFor(() => {
        expect(screen.queryByText('Success message')).not.toBeInTheDocument();
      });
    });

    it('should auto-dismiss toast after duration', async () => {
      const CustomToastConsumer = () => {
        const toast = useToast();
        return (
          <button onClick={() => toast.toast('Auto-dismiss', { duration: 100 })}>
            Show Toast
          </button>
        );
      };
      
      renderWithToast(<CustomToastConsumer />);
      fireEvent.click(screen.getByText('Show Toast'));
      
      await waitFor(() => {
        expect(screen.getByText('Auto-dismiss')).toBeInTheDocument();
      });
      
      await waitFor(
        () => {
          expect(screen.queryByText('Auto-dismiss')).not.toBeInTheDocument();
        },
        { timeout: 300 }
      );
    });

    it('should not auto-dismiss with zero duration', async () => {
      const CustomToastConsumer = () => {
        const toast = useToast();
        return (
          <button onClick={() => toast.toast('No dismiss', { duration: 0 })}>
            Show Toast
          </button>
        );
      };
      
      renderWithToast(<CustomToastConsumer />);
      fireEvent.click(screen.getByText('Show Toast'));
      
      await waitFor(() => {
        expect(screen.getByText('No dismiss')).toBeInTheDocument();
      });
      
      // Wait a bit then verify toast still exists
      await new Promise(resolve => setTimeout(resolve, 200));
      expect(screen.getByText('No dismiss')).toBeInTheDocument();
    });
  });

  describe('Action Button', () => {
    it('should render action button when provided', async () => {
      const CustomToastConsumer = () => {
        const toast = useToast();
        return (
          <button
            onClick={() =>
              toast.toast('Message', {
                action: { label: 'Undo', onClick: jest.fn() },
              })
            }
          >
            Show Toast
          </button>
        );
      };
      
      renderWithToast(<CustomToastConsumer />);
      fireEvent.click(screen.getByText('Show Toast'));
      
      await waitFor(() => {
        expect(screen.getByText('Undo')).toBeInTheDocument();
      });
    });

    it('should call action onClick handler', async () => {
      const actionHandler = jest.fn();
      const CustomToastConsumer = () => {
        const toast = useToast();
        return (
          <button
            onClick={() =>
              toast.toast('Message', {
                action: { label: 'Click me', onClick: actionHandler },
              })
            }
          >
            Show Toast
          </button>
        );
      };
      
      renderWithToast(<CustomToastConsumer />);
      fireEvent.click(screen.getByText('Show Toast'));
      
      await waitFor(() => {
        expect(screen.getByText('Click me')).toBeInTheDocument();
      });
      
      fireEvent.click(screen.getByText('Click me'));
      expect(actionHandler).toHaveBeenCalled();
    });
  });

  describe('Queue Management', () => {
    it('should respect maxToasts limit', async () => {
      const CustomToastConsumer = () => {
        const toast = useToast();
        return (
          <button
            onClick={() => {
              toast.info('Toast 1');
              toast.info('Toast 2');
              toast.info('Toast 3');
              toast.info('Toast 4');
            }}
          >
            Show Many
          </button>
        );
      };
      
      render(
        <ToastProvider maxToasts={3}>
          <CustomToastConsumer />
        </ToastProvider>
      );
      
      fireEvent.click(screen.getByText('Show Many'));
      
      await waitFor(() => {
        const toasts = screen.getAllByRole('status');
        expect(toasts).toHaveLength(3);
      });
    });

    it('should remove oldest toast when exceeding maxToasts', async () => {
      const CustomToastConsumer = () => {
        const toast = useToast();
        return (
          <div>
            <button onClick={() => toast.info('Toast 1')}>Toast 1</button>
            <button onClick={() => toast.info('Toast 2')}>Toast 2</button>
            <button onClick={() => toast.info('Toast 3')}>Toast 3</button>
            <button onClick={() => toast.info('Toast 4')}>Toast 4</button>
          </div>
        );
      };
      
      render(
        <ToastProvider maxToasts={3}>
          <CustomToastConsumer />
        </ToastProvider>
      );
      
      fireEvent.click(screen.getByText('Toast 1'));
      fireEvent.click(screen.getByText('Toast 2'));
      fireEvent.click(screen.getByText('Toast 3'));
      
      await waitFor(() => {
        expect(screen.getByText('Toast 1')).toBeInTheDocument();
      });
      
      fireEvent.click(screen.getByText('Toast 4'));
      
      await waitFor(() => {
        expect(screen.queryByText('Toast 1')).not.toBeInTheDocument();
        expect(screen.getByText('Toast 4')).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('should have status role', async () => {
      renderWithToast();
      fireEvent.click(screen.getByText('Show Success'));
      
      await waitFor(() => {
        expect(screen.getByRole('status')).toBeInTheDocument();
      });
    });

    it('should have aria-live polite on container', () => {
      const { container } = renderWithToast();
      const toastContainer = container.querySelector('[role="region"]');
      expect(toastContainer).toHaveAttribute('aria-live', 'polite');
    });

    it('should have aria-label on container', () => {
      const { container } = renderWithToast();
      const toastContainer = container.querySelector('[role="region"]');
      expect(toastContainer).toHaveAttribute('aria-label', 'Notifications');
    });

    it('should have close button with aria-label', async () => {
      renderWithToast();
      fireEvent.click(screen.getByText('Show Success'));
      
      await waitFor(() => {
        expect(screen.getByLabelText('Dismiss notification')).toBeInTheDocument();
      });
    });
  });

  describe('Position', () => {
    it('should render toasts at top-right by default', () => {
      const { container } = renderWithToast();
      const toastContainer = container.querySelector('[role="region"]');
      expect(toastContainer).toHaveClass('top-4');
      expect(toastContainer).toHaveClass('right-4');
    });

    it('should support top-left position', () => {
      const { container } = render(
        <ToastProvider position="top-left">
          <ToastConsumer />
        </ToastProvider>
      );
      
      const toastContainer = container.querySelector('[role="region"]');
      expect(toastContainer).toHaveClass('top-4');
      expect(toastContainer).toHaveClass('left-4');
    });

    it('should support bottom-right position', () => {
      const { container } = render(
        <ToastProvider position="bottom-right">
          <ToastConsumer />
        </ToastProvider>
      );
      
      const toastContainer = container.querySelector('[role="region"]');
      expect(toastContainer).toHaveClass('bottom-4');
      expect(toastContainer).toHaveClass('right-4');
    });

    it('should support bottom-left position', () => {
      const { container } = render(
        <ToastProvider position="bottom-left">
          <ToastConsumer />
        </ToastProvider>
      );
      
      const toastContainer = container.querySelector('[role="region"]');
      expect(toastContainer).toHaveClass('bottom-4');
      expect(toastContainer).toHaveClass('left-4');
    });
  });

  describe('useToast Hook', () => {
    it('should throw error when used outside ToastProvider', () => {
      const BadComponent = () => {
        useToast();
        return null;
      };
      
      // Suppress console.error for this test
      jest.spyOn(console, 'error').mockImplementation(() => {});
      
      expect(() => render(<BadComponent />)).toThrow();
      
      console.error.mockRestore();
    });

    it('should return toast methods', () => {
      const HookConsumer = () => {
        const toast = useToast();
        return (
          <div>
            <button onClick={() => toast.success('msg')}>success</button>
            <button onClick={() => toast.error('msg')}>error</button>
            <button onClick={() => toast.warning('msg')}>warning</button>
            <button onClick={() => toast.info('msg')}>info</button>
            <button onClick={() => toast.toast('msg')}>toast</button>
          </div>
        );
      };
      
      renderWithToast(<HookConsumer />);
      
      expect(screen.getByText('success')).toBeInTheDocument();
      expect(screen.getByText('error')).toBeInTheDocument();
    });
  });

  describe('Animation', () => {
    it('should have transition classes', async () => {
      const { container } = renderWithToast();
      fireEvent.click(screen.getByText('Show Success'));
      
      await waitFor(() => {
        const toast = container.querySelector('[role="status"]');
        expect(toast).toHaveClass('transition-all');
      });
    });

    it('should apply exit animation on close', async () => {
      const { container } = renderWithToast();
      fireEvent.click(screen.getByText('Show Success'));
      
      await waitFor(() => {
        expect(screen.getByText('Success message')).toBeInTheDocument();
      });
      
      const closeButton = screen.getByLabelText('Dismiss notification');
      fireEvent.click(closeButton);
      
      // Toast should be in exiting state
      const toast = container.querySelector('[role="status"]');
      expect(toast).toHaveClass('opacity-0');
    });
  });

  describe('Edge Cases', () => {
    it('should handle rapid toast additions', async () => {
      const CustomToastConsumer = () => {
        const toast = useToast();
        return (
          <button
            onClick={() => {
              for (let i = 0; i < 5; i++) {
                toast.info(`Toast ${i}`);
              }
            }}
          >
            Rapid
          </button>
        );
      };
      
      render(
        <ToastProvider maxToasts={5}>
          <CustomToastConsumer />
        </ToastProvider>
      );
      
      fireEvent.click(screen.getByText('Rapid'));
      
      await waitFor(() => {
        expect(screen.getByText('Toast 0')).toBeInTheDocument();
      });
    });

    it('should handle empty message', async () => {
      const CustomToastConsumer = () => {
        const toast = useToast();
        return (
          <button onClick={() => toast.toast('')}>Empty</button>
        );
      };
      
      renderWithToast(<CustomToastConsumer />);
      fireEvent.click(screen.getByText('Empty'));
      
      await waitFor(() => {
        const toasts = screen.getAllByRole('status');
        expect(toasts.length).toBeGreaterThan(0);
      });
    });
  });
});
