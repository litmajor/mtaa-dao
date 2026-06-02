import React from 'react';
import { render } from '@testing-library/react';
import { Input } from './input';

test('Input renders with label', () => {
  const { getByText } = render(<Input label="Name" />);
  expect(getByText('Name')).toBeTruthy();
});
