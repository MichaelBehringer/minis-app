import React from "react";
import { Modal, Form, Input } from "antd";
import { doPatchRequestAuth } from "../helper/RequestHelper";
import { App as AntdApp } from "antd";

export default function UserPasswordModal({ open, onClose, userId, token, onSaved }) {
    const [form] = Form.useForm();
    const { message } = AntdApp.useApp();

    async function handleSave() {
        try {
            const values = await form.validateFields();

            await doPatchRequestAuth(`user/${userId}/password`, {
                password: values.password
            }, token);

            message.success("Passwort erfolgreich geändert");
            form.resetFields();
            onClose();

            if (onSaved) onSaved();
        } catch (_) { }
    }

    return (
        <Modal
            open={open}
            title="Passwort ändern"
            onCancel={() => { form.resetFields(); onClose(); }}
            onOk={handleSave}
        >
            <Form layout="vertical" form={form}>
                <Form.Item
                    label="Neues Passwort"
                    name="password"
                    rules={[{ required: true }]}
                >
                    <Input.Password />
                </Form.Item>

                <Form.Item
                    label="Passwort wiederholen"
                    name="passwordRepeat"
                    dependencies={["password"]}
                    rules={[
                        { required: true },
                        ({ getFieldValue }) => ({
                            validator(_, val) {
                                if (!val || getFieldValue("password") === val)
                                    return Promise.resolve();
                                return Promise.reject("Passwörter stimmen nicht überein");
                            }
                        })
                    ]}
                >
                    <Input.Password />
                </Form.Item>
            </Form>
        </Modal>
    );
}
