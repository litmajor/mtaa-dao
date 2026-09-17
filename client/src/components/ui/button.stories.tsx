import React from 'react';
import { type Meta, type Story } from '@storybook/react';
import { Button, type ButtonProps } from './button';

export default {
  title: 'UI/Button',
  component: Button,
} as Meta;

const Template: Story<ButtonProps> = (args) => <Button {...args} />;

export const Primary = Template.bind({});
Primary.args = { variant: 'primary', children: 'Primary Button' };
