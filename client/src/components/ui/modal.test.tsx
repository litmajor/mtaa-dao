import React from 'react';
import { render } from '@testing-library/react';
import { Modal } from './modal';

test('Modal renders when open', () => {
  const { getByRole } = render(<Modal open={true}><div>Hi</div></Modal>);
  expect(getByRole('dialog')).toBeTruthy();
});
