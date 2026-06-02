import React from 'react';
import { Meta, Story } from '@storybook/react';
import { Badge, BadgeProps } from './badge';

export default { title: 'UI/Badge', component: Badge } as Meta;
const Template: Story<BadgeProps> = (args) => <Badge {...args} />;
export const Default = Template.bind({});
Default.args = { children: 'Badge' };
