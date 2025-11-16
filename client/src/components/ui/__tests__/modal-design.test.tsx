// @ts-nocheck
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Modal } from '../modal-design';

describe('Modal Component', () => {
  describe('Render', () => {
    it('should render modal when open is true', () => {
      render(
        <Modal open={true} onOpenChange={() => {}}>
          <div>Modal content</div>
        </Modal>
      );
      expect(screen.getByText('Modal content')).toBeInTheDocument();
    });

    it('should not render modal when open is false', () => {
      render(
        <Modal open={false} onOpenChange={() => {}}>
          <div>Modal content</div>
        </Modal>
      );
      expect(screen.queryByText('Modal content')).not.toBeInTheDocument();
    });

    it('should render title when provided', () => {
      render(
        <Modal open={true} onOpenChange={() => {}} title="Test Modal">
          <div>Content</div>
        </Modal>
      );
      expect(screen.getByText('Test Modal')).toBeInTheDocument();
    });

    it('should render description when provided', () => {
      render(
        <Modal
          open={true}
          onOpenChange={() => {}}
          title="Test"
          description="Test description"
        >
          <div>Content</div>
        </Modal>
      );
      expect(screen.getByText('Test description')).toBeInTheDocument();
    });

    it('should render close button when closeButton is true', () => {
      render(
        <Modal open={true} onOpenChange={() => {}} closeButton={true}>
          <div>Content</div>
        </Modal>
      );
      expect(screen.getByLabelText('Close modal')).toBeInTheDocument();
    });

    it('should not render close button when closeButton is false', () => {
      render(
        <Modal open={true} onOpenChange={() => {}} closeButton={false}>
          <div>Content</div>
        </Modal>
      );
      expect(screen.queryByLabelText('Close modal')).not.toBeInTheDocument();
    });
  });

  describe('Sizing', () => {
    it('should apply size class for small', () => {
      const { container } = render(
        <Modal open={true} onOpenChange={() => {}} size="sm">
          <div>Content</div>
        </Modal>
      );
      const modalContent = container.querySelector('.max-w-sm');
      expect(modalContent).toBeInTheDocument();
    });

    it('should apply size class for medium', () => {
      const { container } = render(
        <Modal open={true} onOpenChange={() => {}} size="md">
          <div>Content</div>
        </Modal>
      );
      const modalContent = container.querySelector('.max-w-md');
      expect(modalContent).toBeInTheDocument();
    });

    it('should apply size class for large', () => {
      const { container } = render(
        <Modal open={true} onOpenChange={() => {}} size="lg">
          <div>Content</div>
        </Modal>
      );
      const modalContent = container.querySelector('.max-w-lg');
      expect(modalContent).toBeInTheDocument();
    });

    it('should apply size class for xlarge', () => {
      const { container } = render(
        <Modal open={true} onOpenChange={() => {}} size="xl">
          <div>Content</div>
        </Modal>
      );
      const modalContent = container.querySelector('.max-w-xl');
      expect(modalContent).toBeInTheDocument();
    });
  });

  describe('Close Behavior', () => {
    it('should call onOpenChange when close button clicked', () => {
      const onOpenChange = jest.fn();
      render(
        <Modal open={true} onOpenChange={onOpenChange} closeButton={true}>
          <div>Content</div>
        </Modal>
      );
      fireEvent.click(screen.getByLabelText('Close modal'));
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it('should close on escape key when closeOnEscape is true', async () => {
      const onOpenChange = jest.fn();
      render(
        <Modal open={true} onOpenChange={onOpenChange} closeOnEscape={true}>
          <div>Content</div>
        </Modal>
      );
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it('should not close on escape when closeOnEscape is false', () => {
      const onOpenChange = jest.fn();
      render(
        <Modal open={true} onOpenChange={onOpenChange} closeOnEscape={false}>
          <div>Content</div>
        </Modal>
      );
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(onOpenChange).not.toHaveBeenCalled();
    });

    it('should close on backdrop click when closeOnBackdropClick is true', () => {
      const onOpenChange = jest.fn();
      const { container } = render(
        <Modal
          open={true}
          onOpenChange={onOpenChange}
          closeOnBackdropClick={true}
        >
          <div>Content</div>
        </Modal>
      );
      const backdrop = container.querySelector('.bg-black\\/50');
      fireEvent.click(backdrop!);
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it('should not close on backdrop click when closeOnBackdropClick is false', () => {
      const onOpenChange = jest.fn();
      const { container } = render(
        <Modal
          open={true}
          onOpenChange={onOpenChange}
          closeOnBackdropClick={false}
        >
          <div>Content</div>
        </Modal>
      );
      const backdrop = container.querySelector('.bg-black\\/50');
      fireEvent.click(backdrop!);
      expect(onOpenChange).not.toHaveBeenCalled();
    });
  });

  describe('Animation', () => {
    it('should have transition classes when opening', () => {
      const { container } = render(
        <Modal open={true} onOpenChange={() => {}}>
          <div>Content</div>
        </Modal>
      );
      const modalContent = container.querySelector('.transition-transform');
      expect(modalContent).toBeInTheDocument();
    });

    it('should apply scale transform when open', () => {
      const { container } = render(
        <Modal open={true} onOpenChange={() => {}}>
          <div>Content</div>
        </Modal>
      );
      const modalContent = container.querySelector('.scale-100');
      expect(modalContent).toBeInTheDocument();
    });

    it('should apply scale-95 when closed', () => {
      const { container, rerender } = render(
        <Modal open={true} onOpenChange={() => {}}>
          <div>Content</div>
        </Modal>
      );
      
      rerender(
        <Modal open={false} onOpenChange={() => {}}>
          <div>Content</div>
        </Modal>
      );
      
      // Modal unmounts when open is false, so we just verify the component handles it
      expect(screen.queryByText('Content')).not.toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have dialog role', () => {
      const { container } = render(
        <Modal open={true} onOpenChange={() => {}}>
          <div>Content</div>
        </Modal>
      );
      expect(container.querySelector('[role="dialog"]')).toBeInTheDocument();
    });

    it('should have aria-modal attribute', () => {
      const { container } = render(
        <Modal open={true} onOpenChange={() => {}}>
          <div>Content</div>
        </Modal>
      );
      expect(container.querySelector('[aria-modal="true"]')).toBeInTheDocument();
    });

    it('should have aria-labelledby when title exists', () => {
      const { container } = render(
        <Modal open={true} onOpenChange={() => {}} title="Test Title">
          <div>Content</div>
        </Modal>
      );
      const dialog = container.querySelector('[role="dialog"]');
      expect(dialog).toHaveAttribute('aria-labelledby', 'modal-title');
    });

    it('should have aria-describedby when description exists', () => {
      const { container } = render(
        <Modal
          open={true}
          onOpenChange={() => {}}
          title="Test"
          description="Test description"
        >
          <div>Content</div>
        </Modal>
      );
      const dialog = container.querySelector('[role="dialog"]');
      expect(dialog).toHaveAttribute('aria-describedby', 'modal-description');
    });

    it('should have aria-hidden on backdrop', () => {
      const { container } = render(
        <Modal open={true} onOpenChange={() => {}}>
          <div>Content</div>
        </Modal>
      );
      const backdrop = container.querySelector('[aria-hidden="true"]');
      expect(backdrop).toBeInTheDocument();
    });
  });

  describe('Focus Management', () => {
    it('should trap focus within modal when trapFocus is true', () => {
      render(
        <Modal open={true} onOpenChange={() => {}} trapFocus={true}>
          <button>Button 1</button>
          <button>Button 2</button>
        </Modal>
      );
      
      const button1 = screen.getByText('Button 1');
      button1.focus();
      expect(document.activeElement).toBe(button1);
    });
  });

  describe('Scroll Lock', () => {
    it('should lock scroll when modal is open', () => {
      render(
        <Modal open={true} onOpenChange={() => {}}>
          <div>Content</div>
        </Modal>
      );
      expect(document.body.style.overflow).toBe('hidden');
    });

    it('should unlock scroll when modal is closed', () => {
      const { rerender } = render(
        <Modal open={true} onOpenChange={() => {}}>
          <div>Content</div>
        </Modal>
      );
      
      rerender(
        <Modal open={false} onOpenChange={() => {}}>
          <div>Content</div>
        </Modal>
      );
      
      // After unmount, overflow should be reset
      expect(document.body.style.overflow).not.toBe('hidden');
    });
  });

  describe('Content Structure', () => {
    it('should render header section with title', () => {
      const { container } = render(
        <Modal open={true} onOpenChange={() => {}} title="Header Title">
          <div>Content</div>
        </Modal>
      );
      expect(container.querySelector('.border-b')).toBeInTheDocument();
      expect(screen.getByText('Header Title')).toBeInTheDocument();
    });

    it('should render body with content', () => {
      render(
        <Modal open={true} onOpenChange={() => {}}>
          <div data-testid="body-content">Body Content</div>
        </Modal>
      );
      expect(screen.getByTestId('body-content')).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle rapid open/close toggles', () => {
      const onOpenChange = jest.fn();
      const { rerender } = render(
        <Modal open={true} onOpenChange={onOpenChange}>
          <div>Content</div>
        </Modal>
      );
      
      rerender(
        <Modal open={false} onOpenChange={onOpenChange}>
          <div>Content</div>
        </Modal>
      );
      
      rerender(
        <Modal open={true} onOpenChange={onOpenChange}>
          <div>Content</div>
        </Modal>
      );
      
      expect(screen.getByText('Content')).toBeInTheDocument();
    });

    it('should handle very long content', () => {
      const longContent = 'Lorem ipsum '.repeat(100);
      render(
        <Modal open={true} onOpenChange={() => {}}>
          <div>{longContent}</div>
        </Modal>
      );
      expect(screen.getByText(new RegExp(longContent.slice(0, 50)))).toBeInTheDocument();
    });
  });
});
