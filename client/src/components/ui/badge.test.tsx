import React from 'react';
import { render } from '@testing-library/react';
import { Badge } from './badge';

test('Badge renders', () => {
  const { getByText } = render(<Badge>New</Badge>);
  expect(getByText('New')).toBeTruthy();
});
