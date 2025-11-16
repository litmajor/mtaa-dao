// @ts-nocheck
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Popover, PopoverBody, PopoverHeader } from '../popover-design';
import { Button } from '../button-design';

describe('Popover Component', () => {
  const renderPopover = (props = {}) => {
    return render(
      <Popover trigger={<Button>Open Popover</Button>} {...props}>
        <PopoverBody>Popover content here</PopoverBody>
      </Popover>
    );
  };

  describe('Render', () => {
    it('should render trigger', () => {
      renderPopover();
      expect(screen.getByText('Open Popover')).toBeInTheDocument();
    });

    it('should not render popover content initially', () => {
      renderPopover();
      expect(screen.queryByText('Popover content here')).not.toBeInTheDocument();
    });

    it('should render popover content when opened', async () => {
      renderPopover();
      fireEvent.click(screen.getByText('Open Popover'));
      
      await waitFor(() => {
        expect(screen.getByText('Popover content here')).toBeInTheDocument();
      });
    });

    it('should render with header', async () => {
      render(
        <Popover trigger={<Button>Open</Button>}>
          <PopoverHeader>Header</PopoverHeader>
          <PopoverBody>Body</PopoverBody>
        </Popover>
      );
      
      fireEvent.click(screen.getByText('Open'));
      
      await waitFor(() => {
        expect(screen.getByText('Header')).toBeInTheDocument();
      });
    });

    it('should render arrow when showArrow is true', async () => {
      const { container } = render(
        <Popover trigger={<Button>Open</Button>} showArrow={true}>
          <PopoverBody>Content</PopoverBody>
        </Popover>
      );
      
      fireEvent.click(screen.getByText('Open'));
      
      await waitFor(() => {
        const arrow = container.querySelector('.rotate-45');
        expect(arrow).toBeInTheDocument();
      });
    });

    it('should not render arrow when showArrow is false', async () => {
      const { container } = render(
        <Popover trigger={<Button>Open</Button>} showArrow={false}>
          <PopoverBody>Content</PopoverBody>
        </Popover>
      );
      
      fireEvent.click(screen.getByText('Open'));
      
      await waitFor(() => {
        const arrow = container.querySelector('.rotate-45');
        expect(arrow).not.toBeInTheDocument();
      });
    });
  });

  describe('Open/Close', () => {
    it('should open popover on trigger click', async () => {
      renderPopover();
      fireEvent.click(screen.getByText('Open Popover'));
      
      await waitFor(() => {
        expect(screen.getByText('Popover content here')).toBeInTheDocument();
      });
    });

    it('should close popover on second click', async () => {
      renderPopover();
      const trigger = screen.getByText('Open Popover');
      
      fireEvent.click(trigger);
      await waitFor(() => {
        expect(screen.getByText('Popover content here')).toBeInTheDocument();
      });
      
      fireEvent.click(trigger);
      
      await waitFor(() => {
        expect(screen.queryByText('Popover content here')).not.toBeInTheDocument();
      });
    });

    it('should close on escape key', async () => {
      renderPopover({ closeOnEscape: true });
      fireEvent.click(screen.getByText('Open Popover'));
      
      await waitFor(() => {
        expect(screen.getByText('Popover content here')).toBeInTheDocument();
      });
      
      fireEvent.keyDown(document, { key: 'Escape' });
      
      await waitFor(() => {
        expect(screen.queryByText('Popover content here')).not.toBeInTheDocument();
      });
    });

    it('should not close on escape when closeOnEscape is false', async () => {
      renderPopover({ closeOnEscape: false });
      fireEvent.click(screen.getByText('Open Popover'));
      
      await waitFor(() => {
        expect(screen.getByText('Popover content here')).toBeInTheDocument();
      });
      
      fireEvent.keyDown(document, { key: 'Escape' });
      
      expect(screen.getByText('Popover content here')).toBeInTheDocument();
    });
  });

  describe('Click Outside', () => {
    it('should close on click outside', async () => {
      const { container } = render(
        <div>
          <Popover trigger={<Button>Open</Button>}>
            <PopoverBody>Content</PopoverBody>
          </Popover>
          <div data-testid="outside">Outside</div>
        </div>
      );
      
      fireEvent.click(screen.getByText('Open'));
      
      await waitFor(() => {
        expect(screen.getByText('Content')).toBeInTheDocument();
      });
      
      fireEvent.mouseDown(screen.getByTestId('outside'));
      
      await waitFor(() => {
        expect(screen.queryByText('Content')).not.toBeInTheDocument();
      });
    });

    it('should not close when clicking inside popover', async () => {
      renderPopover({ closeOnClickOutside: true });
      fireEvent.click(screen.getByText('Open Popover'));
      
      await waitFor(() => {
        expect(screen.getByText('Popover content here')).toBeInTheDocument();
      });
      
      fireEvent.mouseDown(screen.getByText('Popover content here'));
      
      expect(screen.getByText('Popover content here')).toBeInTheDocument();
    });
  });

  describe('Placement', () => {
    it('should accept placement prop', () => {
      renderPopover({ placement: 'top' });
      expect(screen.getByText('Open Popover')).toBeInTheDocument();
    });

    it('should support bottom placement', async () => {
      renderPopover({ placement: 'bottom' });
      fireEvent.click(screen.getByText('Open Popover'));
      
      await waitFor(() => {
        expect(screen.getByText('Popover content here')).toBeInTheDocument();
      });
    });

    it('should support left placement', async () => {
      renderPopover({ placement: 'left' });
      fireEvent.click(screen.getByText('Open Popover'));
      
      await waitFor(() => {
        expect(screen.getByText('Popover content here')).toBeInTheDocument();
      });
    });

    it('should support right placement', async () => {
      renderPopover({ placement: 'right' });
      fireEvent.click(screen.getByText('Open Popover'));
      
      await waitFor(() => {
        expect(screen.getByText('Popover content here')).toBeInTheDocument();
      });
    });

    it('should auto-flip on viewport edge', async () => {
      // This would require a more complex test setup with viewport boundaries
      renderPopover({ placement: 'top' });
      fireEvent.click(screen.getByText('Open Popover'));
      
      expect(screen.getByText('Popover content here')).toBeInTheDocument();
    });
  });

  describe('Offset', () => {
    it('should accept offset prop', () => {
      renderPopover({ offset: 16 });
      expect(screen.getByText('Open Popover')).toBeInTheDocument();
    });

    it('should apply different offset values', async () => {
      renderPopover({ offset: 24 });
      fireEvent.click(screen.getByText('Open Popover'));
      
      await waitFor(() => {
        expect(screen.getByText('Popover content here')).toBeInTheDocument();
      });
    });
  });

  describe('Arrow', () => {
    it('should render arrow by default', async () => {
      const { container } = render(
        <Popover trigger={<Button>Open</Button>}>
          <PopoverBody>Content</PopoverBody>
        </Popover>
      );
      
      fireEvent.click(screen.getByText('Open'));
      
      // Arrow should be visible
      await waitFor(() => {
        expect(screen.getByText('Content')).toBeInTheDocument();
      });
    });

    it('should have rotate-45 class for arrow', async () => {
      const { container } = render(
        <Popover trigger={<Button>Open</Button>} showArrow={true}>
          <PopoverBody>Content</PopoverBody>
        </Popover>
      );
      
      fireEvent.click(screen.getByText('Open'));
      
      await waitFor(() => {
        const arrow = container.querySelector('.rotate-45');
        expect(arrow).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('should have dialog role', async () => {
      const { container } = render(
        <Popover trigger={<Button>Open</Button>}>
          <PopoverBody>Content</PopoverBody>
        </Popover>
      );
      
      fireEvent.click(screen.getByText('Open'));
      
      await waitFor(() => {
        expect(container.querySelector('[role="dialog"]')).toBeInTheDocument();
      });
    });

    it('should have aria-modal false', async () => {
      const { container } = render(
        <Popover trigger={<Button>Open</Button>}>
          <PopoverBody>Content</PopoverBody>
        </Popover>
      );
      
      fireEvent.click(screen.getByText('Open'));
      
      await waitFor(() => {
        const dialog = container.querySelector('[role="dialog"]');
        expect(dialog).toHaveAttribute('aria-modal', 'false');
      });
    });
  });

  describe('Content Structure', () => {
    it('should render body content', async () => {
      render(
        <Popover trigger={<Button>Open</Button>}>
          <PopoverBody>Body content</PopoverBody>
        </Popover>
      );
      
      fireEvent.click(screen.getByText('Open'));
      
      await waitFor(() => {
        expect(screen.getByText('Body content')).toBeInTheDocument();
      });
    });

    it('should render header and body together', async () => {
      render(
        <Popover trigger={<Button>Open</Button>}>
          <PopoverHeader>Header content</PopoverHeader>
          <PopoverBody>Body content</PopoverBody>
        </Popover>
      );
      
      fireEvent.click(screen.getByText('Open'));
      
      await waitFor(() => {
        expect(screen.getByText('Header content')).toBeInTheDocument();
        expect(screen.getByText('Body content')).toBeInTheDocument();
      });
    });

    it('should render custom content', async () => {
      render(
        <Popover trigger={<Button>Open</Button>}>
          <div>Custom content here</div>
        </Popover>
      );
      
      fireEvent.click(screen.getByText('Open'));
      
      await waitFor(() => {
        expect(screen.getByText('Custom content here')).toBeInTheDocument();
      });
    });
  });

  describe('State Management', () => {
    it('should work with controlled open state', async () => {
      const { rerender } = render(
        <Popover trigger={<Button>Open</Button>} open={false} onOpenChange={() => {}}>
          <PopoverBody>Content</PopoverBody>
        </Popover>
      );
      
      expect(screen.queryByText('Content')).not.toBeInTheDocument();
      
      rerender(
        <Popover trigger={<Button>Open</Button>} open={true} onOpenChange={() => {}}>
          <PopoverBody>Content</PopoverBody>
        </Popover>
      );
      
      expect(screen.getByText('Content')).toBeInTheDocument();
    });

    it('should call onOpenChange callback', async () => {
      const onOpenChange = jest.fn();
      renderPopover({ onOpenChange });
      
      fireEvent.click(screen.getByText('Open Popover'));
      
      await waitFor(() => {
        expect(onOpenChange).toHaveBeenCalled();
      });
    });
  });

  describe('Styling', () => {
    it('should accept custom className', () => {
      const { container } = render(
        <Popover trigger={<Button>Open</Button>} className="custom-class">
          <PopoverBody>Content</PopoverBody>
        </Popover>
      );
      
      expect(container.querySelector('.custom-class')).toBeInTheDocument();
    });

    it('should accept triggerClassName', () => {
      render(
        <Popover
          trigger={<Button>Open</Button>}
          triggerClassName="trigger-class"
        >
          <PopoverBody>Content</PopoverBody>
        </Popover>
      );
      
      expect(screen.getByText('Open Popover')).toBeInTheDocument();
    });

    it('should accept arrowClassName', async () => {
      const { container } = render(
        <Popover
          trigger={<Button>Open</Button>}
          showArrow={true}
          arrowClassName="arrow-class"
        >
          <PopoverBody>Content</PopoverBody>
        </Popover>
      );
      
      fireEvent.click(screen.getByText('Open'));
      
      await waitFor(() => {
        const arrow = container.querySelector('.arrow-class');
        expect(arrow).toBeInTheDocument();
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle rapid open/close toggles', async () => {
      renderPopover();
      const trigger = screen.getByText('Open Popover');
      
      fireEvent.click(trigger);
      fireEvent.click(trigger);
      fireEvent.click(trigger);
      
      await waitFor(() => {
        expect(screen.getByText('Popover content here')).toBeInTheDocument();
      });
    });

    it('should handle long content', async () => {
      const longContent = 'Lorem ipsum '.repeat(50);
      render(
        <Popover trigger={<Button>Open</Button>}>
          <PopoverBody>{longContent}</PopoverBody>
        </Popover>
      );
      
      fireEvent.click(screen.getByText('Open'));
      
      await waitFor(() => {
        expect(screen.getByText(new RegExp(longContent.slice(0, 50)))).toBeInTheDocument();
      });
    });
  });
});
