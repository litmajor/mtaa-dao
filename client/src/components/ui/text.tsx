import React from 'react';
import clsx from 'clsx';

type TextTone = 'display' | 'heading' | 'title' | 'body' | 'caption' | 'muted';

interface TextProps extends React.HTMLAttributes<HTMLElement> {
  as?: keyof JSX.IntrinsicElements;
  tone?: TextTone;
}

const toneMap: Record<TextTone, string> = {
  display: 'text-[var(--font-size-4xl)] leading-[var(--line-height-tight)] font-extrabold',
  heading: 'text-[var(--font-size-3xl)] leading-[var(--line-height-tight)] font-semibold',
  title: 'text-[var(--font-size-2xl)] leading-[var(--line-height-normal)] font-medium',
  body: 'text-[var(--font-size-base)] leading-[var(--line-height-normal)] font-normal',
  caption: 'text-[var(--font-size-caption)] leading-[var(--line-height-normal)] font-normal text-[var(--semantic-muted-foreground)]',
  muted: 'text-[var(--font-size-sm)] leading-[var(--line-height-normal)] text-[var(--semantic-muted-foreground)]',
};

export const Text: React.FC<TextProps> = ({ as: Component = 'span', tone = 'body', className, children, ...rest }) => {
  const classes = clsx(toneMap[tone], className);
  return (
    // @ts-ignore allow dynamic tag
    <Component className={classes} {...rest}>{children}</Component>
  );
};

export default Text;
