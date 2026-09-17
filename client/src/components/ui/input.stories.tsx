import React from 'react';
import { type Meta, type Story } from '@storybook/react';
import { Input, type InputProps } from './input';

export default { title: 'UI/Input', component: Input } as Meta;
const Template: Story<InputProps> = (args) => <Input {...args} />;
export const Default = Template.bind({});
Default.args = { label: 'Name', placeholder: 'Enter name' };
