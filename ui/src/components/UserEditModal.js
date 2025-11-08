import React, { useEffect, useState } from "react";
import { Modal, Spin, Tabs } from "antd";
import { doGetRequestAuth, doPatchRequestAuth } from "../helper/RequestHelper";
import { App as AntdApp } from "antd";

// Unterkomponenten
import UserGeneralForm from "./UserGeneralForm";
import UserPasswordModal from "./UserPasswordModal";
import UserBanDates from "./UserBanDates";
import UserPreferredWeekdays from "./UserPreferredWeekdays";
import UserPreferredPartners from "./UserPreferredPartners";

export default function UserEditModal({ userId, token, open, onClose, onSaved }) {
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState();
    const [passwordModalOpen, setPasswordModalOpen] = useState(false);
    const { message } = AntdApp.useApp();

    const [form] = UserGeneralForm.useUserForm(); // eigener Hook

    // -----------------------------
    // USER LADEN
    // -----------------------------
    useEffect(() => {
        if (!open) return;

        async function loadUser() {
            setLoading(true);
            const res = await doGetRequestAuth(`user/${userId}`, token);
            setUser(res.data)

            form.setFieldsValue({
                firstname: res.data.firstname,
                lastname: res.data.lastname,
                username: res.data.username,
                roleId: res.data.roleId,
                active: res.data.active === 1,
                incense: res.data.incense === 1
            });

            setLoading(false);
        }

        loadUser();

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    // -----------------------------
    // SPEICHERN
    // -----------------------------
    async function handleSave() {
        const values = form.getFieldsValue();

        const payload = {
            firstname: values.firstname,
            lastname: values.lastname,
            username: values.username,
            roleId: values.roleId,
            active: values.active ? 1 : 0,
            incense: values.incense ? 1 : 0
        };

        await doPatchRequestAuth(`user/${userId}`, payload, token);
        message.success("Änderungen gespeichert");
        if (onSaved) onSaved();
    }

    return (
        <>
            <Modal
                open={open}
                title={`Benutzereinstellungen (${user?.username})`}
                onCancel={onClose}
                footer={null}
            >
                {loading ? (
                    <Spin size="large" />
                ) : (
                    <Tabs
                        items={[
                            {
                                key: "general",
                                label: "Allgemein",
                                children: (
                                    <UserGeneralForm
                                        form={form}
                                        handleSave={handleSave}
                                        onOpenPassword={() => setPasswordModalOpen(true)}
                                    />
                                )
                            },
                            {
                                key: "blockdates",
                                label: "Sperrtage",
                                children: <UserBanDates userId={userId} token={token} />
                            },
                            {
                                key: "weekdays",
                                label: "Wochentage",
                                children: <UserPreferredWeekdays userId={userId} token={token} />
                            },
                            {
                                key: "partners",
                                label: "Gemeinsame Einteilung",
                                children: <UserPreferredPartners userId={userId} token={token} />
                            }
                        ]}
                    />
                )}
            </Modal>

            {/* Passwort Modal */}
            <UserPasswordModal
                open={passwordModalOpen}
                onClose={() => setPasswordModalOpen(false)}
                userId={userId}
                token={token}
                onSaved={onSaved}
            />
        </>
    );
}
