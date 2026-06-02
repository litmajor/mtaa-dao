import React from 'react';
import { Meta, Story } from '@storybook/react';
import { Modal, ModalProps } from './modal';

export default { title: 'UI/Modal', component: Modal } as Meta;
const Template: Story<ModalProps> = (args) => <Modal {...args} />;
export const Open = Template.bind({});
Open.args = { open: true, children: <div>Content</div> };
