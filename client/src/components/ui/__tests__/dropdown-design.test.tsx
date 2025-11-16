// @ts-nocheck
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Dropdown, DropdownItem, DropdownDivider, DropdownLabel } from '../dropdown-design';
import { Button } from '../button-design';

describe('Dropdown Component', () => {
  const renderDropdown = (props = {}) => {
    return render(
      <Dropdown trigger={<Button>Open Menu</Button>} {...props}>
        <DropdownItem>Option 1</DropdownItem>
        <DropdownItem>Option 2</DropdownItem>
        <DropdownItem>Option 3</DropdownItem>
      </Dropdown>
    );
  };

  describe('Render', () => {
    it('should render trigger', () => {
      renderDropdown();
      expect(screen.getByText('Open Menu')).toBeInTheDocument();
    });

    it('should not render menu content initially', () => {
      renderDropdown();
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });

    it('should render menu content when opened', async () => {
      renderDropdown();
      fireEvent.click(screen.getByText('Open Menu'));
      
      await waitFor(() => {
        expect(screen.getByRole('menu')).toBeInTheDocument();
      });
    });

    it('should render all menu items', async () => {
      renderDropdown();
      fireEvent.click(screen.getByText('Open Menu'));
      
      await waitFor(() => {
        expect(screen.getByText('Option 1')).toBeInTheDocument();
        expect(screen.getByText('Option 2')).toBeInTheDocument();
        expect(screen.getByText('Option 3')).toBeInTheDocument();
      });
    });
  });

  describe('Open/Close', () => {
    it('should open menu on trigger click', async () => {
      renderDropdown();
      const trigger = screen.getByText('Open Menu');
      
      fireEvent.click(trigger);
      
      await waitFor(() => {
        expect(screen.getByRole('menu')).toBeInTheDocument();
      });
    });

    it('should close menu on second click', async () => {
      renderDropdown();
      const trigger = screen.getByText('Open Menu');
      
      fireEvent.click(trigger);
      await waitFor(() => {
        expect(screen.getByRole('menu')).toBeInTheDocument();
      });
      
      fireEvent.click(trigger);
      
      await waitFor(() => {
        expect(screen.queryByRole('menu')).not.toBeInTheDocument();
      });
    });

    it('should close on item click when closeOnItemClick is true', async () => {
      renderDropdown({ closeOnItemClick: true });
      fireEvent.click(screen.getByText('Open Menu'));
      
      await waitFor(() => {
        expect(screen.getByRole('menu')).toBeInTheDocument();
      });
      
      fireEvent.click(screen.getByText('Option 1'));
      
      await waitFor(() => {
        expect(screen.queryByRole('menu')).not.toBeInTheDocument();
      });
    });

    it('should not close on item click when closeOnItemClick is false', async () => {
      renderDropdown({ closeOnItemClick: false });
      fireEvent.click(screen.getByText('Open Menu'));
      
      await waitFor(() => {
        expect(screen.getByRole('menu')).toBeInTheDocument();
      });
      
      fireEvent.click(screen.getByText('Option 1'));
      
      // Menu should still be visible
      expect(screen.getByRole('menu')).toBeInTheDocument();
    });

    it('should close on escape key', async () => {
      renderDropdown({ closeOnEscape: true });
      fireEvent.click(screen.getByText('Open Menu'));
      
      await waitFor(() => {
        expect(screen.getByRole('menu')).toBeInTheDocument();
      });
      
      fireEvent.keyDown(document, { key: 'Escape' });
      
      await waitFor(() => {
        expect(screen.queryByRole('menu')).not.toBeInTheDocument();
      });
    });

    it('should not close on escape when closeOnEscape is false', async () => {
      renderDropdown({ closeOnEscape: false });
      fireEvent.click(screen.getByText('Open Menu'));
      
      await waitFor(() => {
        expect(screen.getByRole('menu')).toBeInTheDocument();
      });
      
      fireEvent.keyDown(document, { key: 'Escape' });
      
      expect(screen.getByRole('menu')).toBeInTheDocument();
    });
  });

  describe('Click Outside', () => {
    it('should close menu on click outside', async () => {
      const { container } = render(
        <div>
          <Dropdown trigger={<Button>Open Menu</Button>}>
            <DropdownItem>Option 1</DropdownItem>
          </Dropdown>
          <div data-testid="outside">Outside element</div>
        </div>
      );
      
      fireEvent.click(screen.getByText('Open Menu'));
      
      await waitFor(() => {
        expect(screen.getByRole('menu')).toBeInTheDocument();
      });
      
      fireEvent.mouseDown(screen.getByTestId('outside'));
      
      await waitFor(() => {
        expect(screen.queryByRole('menu')).not.toBeInTheDocument();
      });
    });

    it('should not close when clicking inside menu', async () => {
      renderDropdown();
      fireEvent.click(screen.getByText('Open Menu'));
      
      await waitFor(() => {
        expect(screen.getByRole('menu')).toBeInTheDocument();
      });
      
      const menu = screen.getByRole('menu');
      fireEvent.mouseDown(menu);
      
      // Menu should still be visible
      expect(screen.getByRole('menu')).toBeInTheDocument();
    });
  });

  describe('Item Click Handler', () => {
    it('should call onClick when item clicked', async () => {
      const onClick = jest.fn();
      render(
        <Dropdown trigger={<Button>Open Menu</Button>}>
          <DropdownItem onClick={onClick}>Click me</DropdownItem>
        </Dropdown>
      );
      
      fireEvent.click(screen.getByText('Open Menu'));
      
      await waitFor(() => {
        expect(screen.getByText('Click me')).toBeInTheDocument();
      });
      
      fireEvent.click(screen.getByText('Click me'));
      expect(onClick).toHaveBeenCalled();
    });

    it('should not call onClick when item is disabled', async () => {
      const onClick = jest.fn();
      render(
        <Dropdown trigger={<Button>Open Menu</Button>}>
          <DropdownItem onClick={onClick} disabled={true}>Disabled</DropdownItem>
        </Dropdown>
      );
      
      fireEvent.click(screen.getByText('Open Menu'));
      
      await waitFor(() => {
        expect(screen.getByText('Disabled')).toBeInTheDocument();
      });
      
      fireEvent.click(screen.getByText('Disabled'));
      expect(onClick).not.toHaveBeenCalled();
    });
  });

  describe('Disabled Items', () => {
    it('should render disabled items with opacity', async () => {
      render(
        <Dropdown trigger={<Button>Open Menu</Button>}>
          <DropdownItem disabled={true}>Disabled Item</DropdownItem>
        </Dropdown>
      );
      
      fireEvent.click(screen.getByText('Open Menu'));
      
      await waitFor(() => {
        const disabledItem = screen.getByText('Disabled Item');
        expect(disabledItem.closest('button')).toBeDisabled();
      });
    });
  });

  describe('Divider', () => {
    it('should render divider', async () => {
      render(
        <Dropdown trigger={<Button>Open Menu</Button>}>
          <DropdownItem>Item 1</DropdownItem>
          <DropdownDivider />
          <DropdownItem>Item 2</DropdownItem>
        </Dropdown>
      );
      
      fireEvent.click(screen.getByText('Open Menu'));
      
      await waitFor(() => {
        const divider = screen.getByRole('separator');
        expect(divider).toBeInTheDocument();
      });
    });

    it('should have separator role', async () => {
      const { container } = render(
        <Dropdown trigger={<Button>Open Menu</Button>}>
          <DropdownDivider />
        </Dropdown>
      );
      
      fireEvent.click(screen.getByText('Open Menu'));
      
      await waitFor(() => {
        expect(container.querySelector('[role="separator"]')).toBeInTheDocument();
      });
    });
  });

  describe('Label', () => {
    it('should render label', async () => {
      render(
        <Dropdown trigger={<Button>Open Menu</Button>}>
          <DropdownLabel>Section 1</DropdownLabel>
          <DropdownItem>Item 1</DropdownItem>
        </Dropdown>
      );
      
      fireEvent.click(screen.getByText('Open Menu'));
      
      await waitFor(() => {
        expect(screen.getByText('Section 1')).toBeInTheDocument();
      });
    });

    it('should have presentation role', async () => {
      const { container } = render(
        <Dropdown trigger={<Button>Open Menu</Button>}>
          <DropdownLabel>Section</DropdownLabel>
        </Dropdown>
      );
      
      fireEvent.click(screen.getByText('Open Menu'));
      
      await waitFor(() => {
        const label = container.querySelector('[role="presentation"]');
        expect(label).toBeInTheDocument();
      });
    });
  });

  describe('Placement', () => {
    it('should accept placement prop', () => {
      renderDropdown({ placement: 'top' });
      expect(screen.getByText('Open Menu')).toBeInTheDocument();
    });

    it('should support bottom placement', () => {
      renderDropdown({ placement: 'bottom' });
      fireEvent.click(screen.getByText('Open Menu'));
      expect(screen.getByRole('menu')).toBeInTheDocument();
    });

    it('should support left placement', () => {
      renderDropdown({ placement: 'left' });
      fireEvent.click(screen.getByText('Open Menu'));
      expect(screen.getByRole('menu')).toBeInTheDocument();
    });

    it('should support right placement', () => {
      renderDropdown({ placement: 'right' });
      fireEvent.click(screen.getByText('Open Menu'));
      expect(screen.getByRole('menu')).toBeInTheDocument();
    });
  });

  describe('Alignment', () => {
    it('should support start alignment', () => {
      renderDropdown({ align: 'start' });
      expect(screen.getByText('Open Menu')).toBeInTheDocument();
    });

    it('should support center alignment', () => {
      renderDropdown({ align: 'center' });
      expect(screen.getByText('Open Menu')).toBeInTheDocument();
    });

    it('should support end alignment', () => {
      renderDropdown({ align: 'end' });
      expect(screen.getByText('Open Menu')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have menu role', async () => {
      renderDropdown();
      fireEvent.click(screen.getByText('Open Menu'));
      
      await waitFor(() => {
        expect(screen.getByRole('menu')).toBeInTheDocument();
      });
    });

    it('should have menuitem role on items', async () => {
      renderDropdown();
      fireEvent.click(screen.getByText('Open Menu'));
      
      await waitFor(() => {
        const items = screen.getAllByRole('menuitem');
        expect(items.length).toBeGreaterThan(0);
      });
    });
  });

  describe('State Management', () => {
    it('should work with controlled open state', async () => {
      const { rerender } = render(
        <Dropdown trigger={<Button>Open Menu</Button>} open={false} onOpenChange={() => {}}>
          <DropdownItem>Option</DropdownItem>
        </Dropdown>
      );
      
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
      
      rerender(
        <Dropdown trigger={<Button>Open Menu</Button>} open={true} onOpenChange={() => {}}>
          <DropdownItem>Option</DropdownItem>
        </Dropdown>
      );
      
      expect(screen.getByRole('menu')).toBeInTheDocument();
    });

    it('should call onOpenChange callback', async () => {
      const onOpenChange = jest.fn();
      renderDropdown({ onOpenChange });
      
      fireEvent.click(screen.getByText('Open Menu'));
      
      await waitFor(() => {
        expect(onOpenChange).toHaveBeenCalled();
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty menu', () => {
      render(
        <Dropdown trigger={<Button>Open Menu</Button>}>
        </Dropdown>
      );
      
      fireEvent.click(screen.getByText('Open Menu'));
      expect(screen.getByRole('menu')).toBeInTheDocument();
    });

    it('should handle many items', async () => {
      render(
        <Dropdown trigger={<Button>Open Menu</Button>}>
          {Array.from({ length: 20 }, (_, i) => (
            <DropdownItem key={i}>Item {i}</DropdownItem>
          ))}
        </Dropdown>
      );
      
      fireEvent.click(screen.getByText('Open Menu'));
      
      await waitFor(() => {
        expect(screen.getByText('Item 0')).toBeInTheDocument();
        expect(screen.getByText('Item 19')).toBeInTheDocument();
      });
    });
  });
});
