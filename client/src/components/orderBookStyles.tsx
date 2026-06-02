/**
 * Order Book Visualization Styles Module
 * Handles inline styles for the order book component
 */

export const orderBookStyles = {
  pressureContainer: (color: string) => ({
    backgroundColor: color + '20',
  } as React.CSSProperties),
  pressureText: (color: string) => ({
    color: color,
  } as React.CSSProperties),
  ratingContainer: (color: string) => ({
    color: color,
  } as React.CSSProperties),
  liquidityScore: (color: string, score: number) => ({
    width: `${score}%`,
    backgroundColor: color,
  } as React.CSSProperties),
  liquidityBadge: (color: string) => ({
    backgroundColor: color + '20',
    color: color,
  } as React.CSSProperties),
};
