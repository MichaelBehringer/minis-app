import React, { useEffect, useState } from "react";
import { Modal, Input, Form, Switch, Button, Spin } from "antd";
import { doGetRequestAuth, doPatchRequestAuth } from "../helper/RequestHelper";
import { App as AntdApp } from 'antd';

export default function UserEditModal({ userId, token, open, onClose, onSaved }) {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [passwordModalOpen, setPasswordModalOpen] = useState(false);
    const [form] = Form.useForm();
    const [passwordForm] = Form.useForm();
    const { message } = AntdApp.useApp();

    // Userdaten laden
    useEffect(() => {
        if (!open) return;

        async function loadUser() {
            setLoading(true);
            const res = await doGetRequestAuth(`user/${userId}`, token);
            const user = res.data;

            form.setFieldsValue({
                firstname: user.firstname,
                lastname: user.lastname,
                username: user.username,
                roleId: user.roleId,
                active: user.active === 1,
                incense: user.incense === 1
            });
            setLoading(false);
        }

        loadUser();
    }, [open, userId, token, form]);

    const handlePasswordSave = async () => {
        try {
          const values = await passwordForm.validateFields();
      
          const payload = {
            password: values.password
          };
      
          await doPatchRequestAuth(`user/${userId}/password`, payload, token);
          message.success('Passwort geändert')
      
          passwordForm.resetFields();
          setPasswordModalOpen(false);
      
          if (onSaved) onSaved();
        } catch (err) {
          // Fehler wird durch Form angezeigt
        }
      };

    // Speichern
    const handleSave = async () => {
        const values = form.getFieldsValue();
        if (values.firstname === "" || values.lastname === "") {
            return
        }

        const payload = {
            firstname: values.firstname,
            lastname: values.lastname,
            username: values.username,
            roleId: values.roleId,
            active: values.active ? 1 : 0,
            incense: values.incense ? 1 : 0
        };

        setSaving(true);
        try {
            await doPatchRequestAuth(`user/${userId}`, payload, token);
            message.success('Änderungen gespeichert')

            if (onSaved) onSaved();
            onClose();
        } finally {
            setSaving(false);
        }
    };

    return (
        <div>
        <Modal
            open={open}
            title="Benutzer bearbeiten"
            onCancel={onClose}
            footer={[
                <Button key="cancel" onClick={onClose}>
                    Abbrechen
                </Button>,
                <Button key="save" type="primary" loading={saving} onClick={handleSave}>
                    Speichern
                </Button>
            ]}
            closable={true}
        >
            {loading ?
                <Spin size="large" />
                : null}
            <Form layout="vertical" form={form}>
                <Form.Item label="Vorname" name="firstname" rules={[{ required: true }]}>
                    <Input />
                </Form.Item>

                <Form.Item label="Nachname" name="lastname" rules={[{ required: true }]}>
                    <Input />
                </Form.Item>

                <Form.Item label="Benutzername" name="username">
                    <Input disabled />
                </Form.Item>

                <Form.Item label="Rollen-ID" name="roleId">
                    <Input disabled />
                </Form.Item>

                <Form.Item label="Weihrauch" name="incense" valuePropName="checked">
                    <Switch />
                </Form.Item>

                <Form.Item label="Aktiv" name="active" valuePropName="checked">
                    <Switch />
                </Form.Item>
                <Button
                    style={{ marginTop: 12 }}
                    type="default"
                    onClick={() => setPasswordModalOpen(true)}
                >
                    Passwort ändern
                </Button>
            </Form>
        </Modal>
        <Modal
  open={passwordModalOpen}
  title="Passwort ändern"
  onCancel={() => {
    passwordForm.resetFields()
    setPasswordModalOpen(false)
}}
  onOk={handlePasswordSave}
>
  <Form layout="vertical" form={passwordForm}>
    <Form.Item
      label="Neues Passwort"
      name="password"
      rules={[{ required: true, message: "Bitte Passwort eingeben" }]}
    >
      <Input.Password />
    </Form.Item>

    <Form.Item
      label="Passwort wiederholen"
      name="passwordRepeat"
      dependencies={['password']}
      rules={[
        { required: true, message: "Bitte Passwort wiederholen" },
        ({ getFieldValue }) => ({
          validator(_, value) {
            if (!value || getFieldValue("password") === value) {
              return Promise.resolve();
            }
            return Promise.reject(new Error("Passwörter stimmen nicht überein"));
          }
        })
      ]}
    >
      <Input.Password />
    </Form.Item>
  </Form>
</Modal>
    </div>
    );
}
