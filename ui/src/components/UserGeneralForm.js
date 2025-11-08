import { Form, Input, Switch, Button } from "antd";

export default function UserGeneralForm({ form, handleSave, onOpenPassword }) {
    return (
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
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12 }}>
                <Button type="default" onClick={onOpenPassword}>
                    Passwort ändern
                </Button>


                <Button key="save" type="primary" onClick={handleSave}>Speichern</Button>
            </div>
        </Form>
    );
}

UserGeneralForm.useUserForm = () => Form.useForm();
