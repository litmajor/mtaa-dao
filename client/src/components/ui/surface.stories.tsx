import React from 'react';
import { type Meta, type Story } from '@storybook/react';
import { Surface, type SurfaceProps } from './surface';

export default { title: 'UI/Surface', component: Surface } as Meta;
const Template: Story<SurfaceProps> = (args) => <Surface {...args} />;
export const Card = Template.bind({});
Card.args = { children: 'Card content' };
