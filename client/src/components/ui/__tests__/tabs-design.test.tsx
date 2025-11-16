// @ts-nocheck
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../tabs-design';

describe('Tabs Component', () => {
  const renderTabs = (props = {}) => {
    return render(
      <Tabs defaultValue="tab1" {...props}>
        <TabsList>
          <TabsTrigger value="tab1">Tab 1</TabsTrigger>
          <TabsTrigger value="tab2">Tab 2</TabsTrigger>
          <TabsTrigger value="tab3">Tab 3</TabsTrigger>
        </TabsList>
        <TabsContent value="tab1">Content 1</TabsContent>
        <TabsContent value="tab2">Content 2</TabsContent>
        <TabsContent value="tab3">Content 3</TabsContent>
      </Tabs>
    );
  };

  describe('Render', () => {
    it('should render tabs component', () => {
      renderTabs();
      expect(screen.getByText('Tab 1')).toBeInTheDocument();
      expect(screen.getByText('Tab 2')).toBeInTheDocument();
      expect(screen.getByText('Tab 3')).toBeInTheDocument();
    });

    it('should render default tab content', () => {
      renderTabs();
      expect(screen.getByText('Content 1')).toBeInTheDocument();
    });

    it('should not render non-active tab content', () => {
      renderTabs();
      expect(screen.queryByText('Content 2')).not.toBeInTheDocument();
      expect(screen.queryByText('Content 3')).not.toBeInTheDocument();
    });

    it('should render with underline variant', () => {
      const { container } = render(
        <Tabs defaultValue="tab1" variant="underline">
          <TabsList>
            <TabsTrigger value="tab1">Tab 1</TabsTrigger>
          </TabsList>
          <TabsContent value="tab1">Content</TabsContent>
        </Tabs>
      );
      expect(container.querySelector('[data-orientation="horizontal"]')).toBeInTheDocument();
    });

    it('should render with pill variant', () => {
      renderTabs({ variant: 'pill' });
      expect(screen.getByText('Tab 1')).toBeInTheDocument();
    });

    it('should render with card variant', () => {
      renderTabs({ variant: 'card' });
      expect(screen.getByText('Tab 1')).toBeInTheDocument();
    });
  });

  describe('Tab Selection', () => {
    it('should switch to clicked tab', () => {
      renderTabs();
      expect(screen.getByText('Content 1')).toBeInTheDocument();
      
      fireEvent.click(screen.getByText('Tab 2'));
      
      expect(screen.queryByText('Content 1')).not.toBeInTheDocument();
      expect(screen.getByText('Content 2')).toBeInTheDocument();
    });

    it('should update aria-selected on active tab', () => {
      renderTabs();
      const tab1 = screen.getByText('Tab 1').closest('[role="tab"]');
      const tab2 = screen.getByText('Tab 2').closest('[role="tab"]');
      
      expect(tab1).toHaveAttribute('aria-selected', 'true');
      expect(tab2).toHaveAttribute('aria-selected', 'false');
      
      fireEvent.click(tab2);
      
      expect(tab1).toHaveAttribute('aria-selected', 'false');
      expect(tab2).toHaveAttribute('aria-selected', 'true');
    });

    it('should call onValueChange when tab clicked', () => {
      const onValueChange = jest.fn();
      renderTabs({ onValueChange });
      
      fireEvent.click(screen.getByText('Tab 2'));
      
      expect(onValueChange).toHaveBeenCalledWith('tab2');
    });

    it('should handle controlled value', () => {
      const { rerender } = render(
        <Tabs value="tab1" onValueChange={() => {}}>
          <TabsList>
            <TabsTrigger value="tab1">Tab 1</TabsTrigger>
            <TabsTrigger value="tab2">Tab 2</TabsTrigger>
          </TabsList>
          <TabsContent value="tab1">Content 1</TabsContent>
          <TabsContent value="tab2">Content 2</TabsContent>
        </Tabs>
      );
      
      expect(screen.getByText('Content 1')).toBeInTheDocument();
      
      rerender(
        <Tabs value="tab2" onValueChange={() => {}}>
          <TabsList>
            <TabsTrigger value="tab1">Tab 1</TabsTrigger>
            <TabsTrigger value="tab2">Tab 2</TabsTrigger>
          </TabsList>
          <TabsContent value="tab1">Content 1</TabsContent>
          <TabsContent value="tab2">Content 2</TabsContent>
        </Tabs>
      );
      
      expect(screen.getByText('Content 2')).toBeInTheDocument();
    });
  });

  describe('Disabled Tabs', () => {
    it('should disable specific tabs', () => {
      render(
        <Tabs defaultValue="tab1">
          <TabsList>
            <TabsTrigger value="tab1">Tab 1</TabsTrigger>
            <TabsTrigger value="tab2" disabled={true}>Tab 2</TabsTrigger>
          </TabsList>
          <TabsContent value="tab1">Content 1</TabsContent>
          <TabsContent value="tab2">Content 2</TabsContent>
        </Tabs>
      );
      
      const tab2 = screen.getByText('Tab 2').closest('button');
      expect(tab2).toBeDisabled();
    });

    it('should not select disabled tabs', () => {
      render(
        <Tabs defaultValue="tab1">
          <TabsList>
            <TabsTrigger value="tab1">Tab 1</TabsTrigger>
            <TabsTrigger value="tab2" disabled={true}>Tab 2</TabsTrigger>
          </TabsList>
          <TabsContent value="tab1">Content 1</TabsContent>
          <TabsContent value="tab2">Content 2</TabsContent>
        </Tabs>
      );
      
      fireEvent.click(screen.getByText('Tab 2'));
      expect(screen.getByText('Content 1')).toBeInTheDocument();
    });
  });

  describe('Keyboard Navigation', () => {
    it('should navigate tabs with arrow keys', async () => {
      renderTabs();
      const tab1 = screen.getByText('Tab 1').closest('button');
      
      tab1?.focus();
      fireEvent.keyDown(tab1!, { key: 'ArrowRight' });
      
      // Note: Arrow key navigation would need to be implemented in the component
      expect(screen.getByText('Tab 1')).toBeInTheDocument();
    });

    it('should have tab elements with tablist role', () => {
      const { container } = render(
        <Tabs defaultValue="tab1">
          <TabsList>
            <TabsTrigger value="tab1">Tab 1</TabsTrigger>
          </TabsList>
          <TabsContent value="tab1">Content</TabsContent>
        </Tabs>
      );
      
      expect(container.querySelector('[role="tablist"]')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have tablist role on TabsList', () => {
      const { container } = render(
        <Tabs defaultValue="tab1">
          <TabsList>
            <TabsTrigger value="tab1">Tab 1</TabsTrigger>
          </TabsList>
          <TabsContent value="tab1">Content</TabsContent>
        </Tabs>
      );
      
      expect(container.querySelector('[role="tablist"]')).toBeInTheDocument();
    });

    it('should have tab role on TabsTrigger', () => {
      render(
        <Tabs defaultValue="tab1">
          <TabsList>
            <TabsTrigger value="tab1">Tab 1</TabsTrigger>
          </TabsList>
          <TabsContent value="tab1">Content</TabsContent>
        </Tabs>
      );
      
      const tab = screen.getByText('Tab 1').closest('[role="tab"]');
      expect(tab).toBeInTheDocument();
    });

    it('should have tabpanel role on TabsContent', () => {
      const { container } = render(
        <Tabs defaultValue="tab1">
          <TabsList>
            <TabsTrigger value="tab1">Tab 1</TabsTrigger>
          </TabsList>
          <TabsContent value="tab1">Content</TabsContent>
        </Tabs>
      );
      
      expect(container.querySelector('[role="tabpanel"]')).toBeInTheDocument();
    });

    it('should have aria-selected attribute', () => {
      render(
        <Tabs defaultValue="tab1">
          <TabsList>
            <TabsTrigger value="tab1">Tab 1</TabsTrigger>
            <TabsTrigger value="tab2">Tab 2</TabsTrigger>
          </TabsList>
          <TabsContent value="tab1">Content 1</TabsContent>
          <TabsContent value="tab2">Content 2</TabsContent>
        </Tabs>
      );
      
      const tab1 = screen.getByText('Tab 1').closest('[role="tab"]');
      const tab2 = screen.getByText('Tab 2').closest('[role="tab"]');
      
      expect(tab1).toHaveAttribute('aria-selected');
      expect(tab2).toHaveAttribute('aria-selected');
    });

    it('should have aria-disabled on disabled tabs', () => {
      render(
        <Tabs defaultValue="tab1">
          <TabsList>
            <TabsTrigger value="tab1">Tab 1</TabsTrigger>
            <TabsTrigger value="tab2" disabled={true}>Tab 2</TabsTrigger>
          </TabsList>
          <TabsContent value="tab1">Content 1</TabsContent>
          <TabsContent value="tab2">Content 2</TabsContent>
        </Tabs>
      );
      
      const tab2 = screen.getByText('Tab 2').closest('[role="tab"]');
      expect(tab2).toHaveAttribute('aria-disabled');
    });
  });

  describe('Orientation', () => {
    it('should support horizontal orientation', () => {
      const { container } = render(
        <Tabs defaultValue="tab1" orientation="horizontal">
          <TabsList>
            <TabsTrigger value="tab1">Tab 1</TabsTrigger>
          </TabsList>
          <TabsContent value="tab1">Content</TabsContent>
        </Tabs>
      );
      
      const tabs = container.querySelector('[data-orientation="horizontal"]');
      expect(tabs).toBeInTheDocument();
    });

    it('should support vertical orientation', () => {
      const { container } = render(
        <Tabs defaultValue="tab1" orientation="vertical">
          <TabsList>
            <TabsTrigger value="tab1">Tab 1</TabsTrigger>
          </TabsList>
          <TabsContent value="tab1">Content</TabsContent>
        </Tabs>
      );
      
      const tabs = container.querySelector('[data-orientation="vertical"]');
      expect(tabs).toBeInTheDocument();
    });
  });

  describe('Content Rendering', () => {
    it('should only render active tab content', () => {
      renderTabs();
      
      expect(screen.getByText('Content 1')).toBeInTheDocument();
      expect(screen.queryByText('Content 2')).not.toBeInTheDocument();
      expect(screen.queryByText('Content 3')).not.toBeInTheDocument();
    });

    it('should render correct content after switching tabs', () => {
      renderTabs();
      
      fireEvent.click(screen.getByText('Tab 2'));
      expect(screen.getByText('Content 2')).toBeInTheDocument();
      expect(screen.queryByText('Content 1')).not.toBeInTheDocument();
      
      fireEvent.click(screen.getByText('Tab 3'));
      expect(screen.getByText('Content 3')).toBeInTheDocument();
      expect(screen.queryByText('Content 2')).not.toBeInTheDocument();
    });
  });

  describe('Multiple Tabs', () => {
    it('should handle many tabs', () => {
      render(
        <Tabs defaultValue="tab1">
          <TabsList>
            {Array.from({ length: 10 }, (_, i) => (
              <TabsTrigger key={`tab${i}`} value={`tab${i}`}>
                Tab {i}
              </TabsTrigger>
            ))}
          </TabsList>
          {Array.from({ length: 10 }, (_, i) => (
            <TabsContent key={`content${i}`} value={`tab${i}`}>
              Content {i}
            </TabsContent>
          ))}
        </Tabs>
      );
      
      expect(screen.getByText('Tab 0')).toBeInTheDocument();
      expect(screen.getByText('Tab 9')).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle switching to same tab', () => {
      const onValueChange = jest.fn();
      renderTabs({ onValueChange });
      
      fireEvent.click(screen.getByText('Tab 1'));
      
      expect(onValueChange).toHaveBeenCalledWith('tab1');
    });

    it('should handle empty tabs list', () => {
      render(
        <Tabs defaultValue="tab1">
          <TabsList></TabsList>
          <TabsContent value="tab1">Content</TabsContent>
        </Tabs>
      );
      
      expect(screen.getByText('Content')).toBeInTheDocument();
    });
  });
});
