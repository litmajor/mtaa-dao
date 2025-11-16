// @ts-nocheck
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Select } from '../select-design';

describe('Select Component', () => {
  const options = [
    { value: 'apple', label: 'Apple' },
    { value: 'banana', label: 'Banana' },
    { value: 'orange', label: 'Orange' },
    { value: 'disabled', label: 'Disabled Option', disabled: true },
  ];

  describe('Render', () => {
    it('should render select trigger with placeholder', () => {
      render(<Select options={options} placeholder="Choose fruit" />);
      expect(screen.getByText('Choose fruit')).toBeInTheDocument();
    });

    it('should render selected value', () => {
      render(<Select options={options} defaultValue="apple" />);
      expect(screen.getByText('Apple')).toBeInTheDocument();
    });

    it('should render dropdown content when opened', async () => {
      render(<Select options={options} />);
      const trigger = screen.getByRole('button');
      fireEvent.click(trigger);
      
      await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeInTheDocument();
      });
    });

    it('should render all options in dropdown', async () => {
      render(<Select options={options} />);
      fireEvent.click(screen.getByRole('button'));
      
      await waitFor(() => {
        expect(screen.getByText('Apple')).toBeInTheDocument();
        expect(screen.getByText('Banana')).toBeInTheDocument();
        expect(screen.getByText('Orange')).toBeInTheDocument();
      });
    });
  });

  describe('Selection', () => {
    it('should select option on click', async () => {
      const onValueChange = jest.fn();
      render(<Select options={options} onValueChange={onValueChange} />);
      
      fireEvent.click(screen.getByRole('button'));
      const appleOption = screen.getAllByText('Apple')[1];
      fireEvent.click(appleOption);
      
      expect(onValueChange).toHaveBeenCalledWith('apple');
    });

    it('should update display value after selection', async () => {
      const { rerender } = render(
        <Select options={options} defaultValue="" onValueChange={() => {}} />
      );
      
      fireEvent.click(screen.getByRole('button'));
      const appleOption = screen.getAllByText('Apple')[1];
      fireEvent.click(appleOption);
      
      rerender(<Select options={options} defaultValue="apple" onValueChange={() => {}} />);
      expect(screen.getByText('Apple')).toBeInTheDocument();
    });

    it('should close dropdown after selection', async () => {
      render(<Select options={options} />);
      fireEvent.click(screen.getByRole('button'));
      
      const appleOption = screen.getAllByText('Apple')[1];
      fireEvent.click(appleOption);
      
      await waitFor(() => {
        expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
      });
    });

    it('should not select disabled options', async () => {
      const onValueChange = jest.fn();
      render(<Select options={options} onValueChange={onValueChange} />);
      
      fireEvent.click(screen.getByRole('button'));
      const disabledOption = screen.getByText('Disabled Option').parentElement;
      fireEvent.click(disabledOption!);
      
      expect(onValueChange).not.toHaveBeenCalled();
    });

    it('should handle controlled value', () => {
      const { rerender } = render(
        <Select options={options} value="apple" onValueChange={() => {}} />
      );
      expect(screen.getByText('Apple')).toBeInTheDocument();
      
      rerender(<Select options={options} value="banana" onValueChange={() => {}} />);
      expect(screen.getByText('Banana')).toBeInTheDocument();
    });
  });

  describe('Search', () => {
    it('should filter options based on search', async () => {
      render(<Select options={options} searchable={true} />);
      fireEvent.click(screen.getByRole('button'));
      
      const input = screen.getByPlaceholderText('Search...');
      await userEvent.type(input, 'apple');
      
      await waitFor(() => {
        expect(screen.getByText('Apple')).toBeInTheDocument();
        expect(screen.queryByText('Banana')).not.toBeInTheDocument();
      });
    });

    it('should show no results message', async () => {
      render(<Select options={options} searchable={true} />);
      fireEvent.click(screen.getByRole('button'));
      
      const input = screen.getByPlaceholderText('Search...');
      await userEvent.type(input, 'xyz');
      
      await waitFor(() => {
        expect(screen.getByText('No options found')).toBeInTheDocument();
      });
    });

    it('should be case insensitive', async () => {
      render(<Select options={options} searchable={true} />);
      fireEvent.click(screen.getByRole('button'));
      
      const input = screen.getByPlaceholderText('Search...');
      await userEvent.type(input, 'APPLE');
      
      await waitFor(() => {
        expect(screen.getByText('Apple')).toBeInTheDocument();
      });
    });
  });

  describe('Clear', () => {
    it('should show clear button when clearable and selected', async () => {
      render(<Select options={options} defaultValue="apple" clearable={true} />);
      
      fireEvent.click(screen.getByRole('button'));
      
      await waitFor(() => {
        expect(screen.getByText('Clear selection')).toBeInTheDocument();
      });
    });

    it('should clear selection on clear button click', async () => {
      const onValueChange = jest.fn();
      render(
        <Select
          options={options}
          defaultValue="apple"
          clearable={true}
          onValueChange={onValueChange}
        />
      );
      
      fireEvent.click(screen.getByRole('button'));
      const clearBtn = screen.getByText('Clear selection');
      fireEvent.click(clearBtn);
      
      expect(onValueChange).toHaveBeenCalledWith('');
    });
  });

  describe('State Management', () => {
    it('should work as controlled component', () => {
      const onValueChange = jest.fn();
      const { rerender } = render(
        <Select options={options} value="" onValueChange={onValueChange} />
      );
      
      expect(screen.getByRole('button')).toHaveTextContent('Select an option');
      
      rerender(
        <Select options={options} value="apple" onValueChange={onValueChange} />
      );
      
      expect(screen.getByRole('button')).toHaveTextContent('Apple');
    });

    it('should work as uncontrolled component', async () => {
      render(<Select options={options} defaultValue="banana" />);
      expect(screen.getByRole('button')).toHaveTextContent('Banana');
    });
  });

  describe('Keyboard Navigation', () => {
    it('should close on escape key', async () => {
      render(<Select options={options} />);
      fireEvent.click(screen.getByRole('button'));
      
      await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeInTheDocument();
      });
      
      fireEvent.keyDown(document, { key: 'Escape' });
      
      await waitFor(() => {
        expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('should have listbox role', async () => {
      render(<Select options={options} />);
      fireEvent.click(screen.getByRole('button'));
      
      await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeInTheDocument();
      });
    });

    it('should have option role for each item', async () => {
      render(<Select options={options} />);
      fireEvent.click(screen.getByRole('button'));
      
      await waitFor(() => {
        const options = screen.getAllByRole('option');
        expect(options.length).toBeGreaterThan(0);
      });
    });

    it('should indicate selected option with aria-selected', async () => {
      render(<Select options={options} defaultValue="apple" />);
      fireEvent.click(screen.getByRole('button'));
      
      await waitFor(() => {
        const selectedOption = screen.getAllByRole('option').find(opt =>
          opt.getAttribute('aria-selected') === 'true'
        );
        expect(selectedOption).toBeInTheDocument();
      });
    });
  });

  describe('Disabled State', () => {
    it('should disable select when disabled prop is true', () => {
      render(<Select options={options} disabled={true} />);
      expect(screen.getByRole('button')).toBeDisabled();
    });

    it('should not open dropdown when disabled', () => {
      render(<Select options={options} disabled={true} />);
      fireEvent.click(screen.getByRole('button'));
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });
  });

  describe('Click Outside', () => {
    it('should close dropdown on click outside', async () => {
      const { container } = render(
        <div>
          <Select options={options} />
          <div data-testid="outside">Outside element</div>
        </div>
      );
      
      fireEvent.click(screen.getByRole('button'));
      await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeInTheDocument();
      });
      
      fireEvent.mouseDown(screen.getByTestId('outside'));
      
      await waitFor(() => {
        expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty options list', () => {
      render(<Select options={[]} />);
      fireEvent.click(screen.getByRole('button'));
      expect(screen.getByText('No options found')).toBeInTheDocument();
    });

    it('should handle options with React nodes as labels', () => {
      const customOptions = [
        { value: 'custom', label: <span data-testid="custom-label">Custom</span> },
      ];
      render(<Select options={customOptions} defaultValue="custom" />);
      expect(screen.getByTestId('custom-label')).toBeInTheDocument();
    });
  });
});
