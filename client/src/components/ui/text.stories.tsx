import React from 'react';
import { type Meta, type Story } from '@storybook/react';
import { Text, type TextProps } from './text';

export default { title: 'UI/Text', component: Text } as Meta;
const Template: Story<TextProps> = (args) => <Text {...args} />;
export const Body = Template.bind({});
Body.args = { variant: 'body', children: 'Body text' };
