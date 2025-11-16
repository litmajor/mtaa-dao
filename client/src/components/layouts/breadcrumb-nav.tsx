import React from 'react';
import { Icon } from '../ui/icon-design';

export interface BreadcrumbItem {
  label: string;
  path?: string;
  icon?: string;
}

export interface BreadcrumbNavProps {
  items: BreadcrumbItem[];
  onNavigate?: (path: string) => void;
  maxItems?: number;
  showEllipsis?: boolean;
  separator?: 'slash' | 'arrow' | 'chevron';
  className?: string;
}

export const BreadcrumbNav = React.forwardRef<HTMLDivElement, BreadcrumbNavProps>(
  (
    {
      items,
      onNavigate,
      maxItems = 5,
      showEllipsis = true,
      separator = 'chevron',
      className,
    },
    ref
  ) => {
    // Determine which items to show
    let displayItems = items;
    let showEllipsisButton = false;

    if (showEllipsis && items.length > maxItems) {
      showEllipsisButton = true;
      // Always show first item and last 3 items
      displayItems = [
        items[0],
        { label: '...', icon: 'more-horizontal' }, // Placeholder for ellipsis
        ...items.slice(-Math.max(maxItems - 2, 2)),
      ];
    }

    const separatorMap = {
      slash: '/',
      arrow: '→',
      chevron: <Icon name="chevron-right" size="xs" className="mx-2" />,
    };

    return (
      <nav
        ref={ref}
        className={`flex items-center text-sm text-neutral-600 ${className || ''}`}
        aria-label="Breadcrumb"
      >
        <ol className="flex items-center">
          {displayItems.map((item, idx) => (
            <li key={idx} className="flex items-center">
              {/* Separator */}
              {idx > 0 && separator !== 'chevron' && (
                <span className="mx-2 text-neutral-400">{separatorMap[separator]}</span>
              )}
              {idx > 0 && separator === 'chevron' && separatorMap[separator]}

              {/* Item */}
              {item.label === '...' ? (
                <button
                  className="flex items-center gap-1 px-2 py-1 rounded hover:bg-neutral-100 text-neutral-600"
                  title={items.slice(1, items.length - Math.max(maxItems - 2, 2)).map(i => i.label).join(' > ')}
                >
                  {item.icon && <Icon name={item.icon} size="xs" />}
                  {item.label}
                </button>
              ) : item.path ? (
                <button
                  onClick={() => onNavigate?.(item.path!)}
                  className="px-2 py-1 rounded hover:bg-neutral-100 text-blue-600 hover:text-blue-700 transition-colors"
                >
                  {item.icon && <Icon name={item.icon} size="sm" className="inline mr-1" />}
                  {item.label}
                </button>
              ) : (
                <span className="px-2 py-1 text-neutral-900 font-medium">
                  {item.icon && <Icon name={item.icon} size="sm" className="inline mr-1" />}
                  {item.label}
                </span>
              )}
            </li>
          ))}
        </ol>
      </nav>
    );
  }
);

BreadcrumbNav.displayName = 'BreadcrumbNav';
