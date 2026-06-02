import React from 'react';
import { Meta, Story } from '@storybook/react';
import { Input, InputProps } from './input';

export default { title: 'UI/Input', component: Input } as Meta;
const Template: Story<InputProps> = (args) => <Input {...args} />;
export const Default = Template.bind({});
Default.args = { label: 'Name', placeholder: 'Enter name' };
