import React from 'react';
import { render } from '@testing-library/react';
import { Stack } from './stack';

test('Stack renders children', () => {
  const { getByText } = render(<Stack><div>Child</div></Stack>);
  expect(getByText('Child')).toBeTruthy();
});
