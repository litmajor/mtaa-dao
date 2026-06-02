import React from 'react';
import { render } from '@testing-library/react';
import { Text } from './text';

test('Text renders with correct tag', () => {
  const { container } = render(<Text as="h1">Title</Text>);
  expect(container.querySelector('h1')).toBeTruthy();
});
