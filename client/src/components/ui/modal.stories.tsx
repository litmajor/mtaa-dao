import React from 'react';
import { type Meta, type Story } from '@storybook/react';
import { Modal, type ModalProps } from './modal';

export default { title: 'UI/Modal', component: Modal } as Meta;
const Template: Story<ModalProps> = (args) => <Modal {...args} />;
export const Open = Template.bind({});
Open.args = { open: true, children: <div>Content</div> };
