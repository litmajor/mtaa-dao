import React from 'react';
import { render } from '@testing-library/react';
import { Surface } from './surface';

test('Surface renders children', () => {
  const { getByText } = render(<Surface>Card</Surface>);
  expect(getByText('Card')).toBeTruthy();
});
