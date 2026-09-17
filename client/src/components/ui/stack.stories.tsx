import React from 'react';
import { type Meta, type Story } from '@storybook/react';
import { Stack, type StackProps } from './stack';

export default { title: 'UI/Stack', component: Stack } as Meta;
const Template: Story<StackProps> = (args) => <Stack {...args}><div>A</div><div>B</div></Stack>;
export const Column = Template.bind({});
Column.args = { direction: 'col' };
