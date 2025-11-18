import { useEffect, useState } from "react";
import { Table, Button } from "antd";
import { doGetRequestAuth } from "../helper/RequestHelper";

import "./Stammdaten.css"

export default function Stammdaten({ token, onEditUser }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadUsers = async () => {
      setLoading(true);
      const res = await doGetRequestAuth("user", token);
      setUsers(res.data || []);
      setLoading(false);
    };

    loadUsers();
  }, [token]);

  const columns = [
    {
      title: "",
      dataIndex: "edit",
      width: 100,
      render: (_, record) => (
        <Button type="primary" onClick={() => onEditUser(record.id)}>
          Bearbeiten
        </Button>
      )
    },
    {
      title: "Vorname",
      dataIndex: "firstname",
    },
    {
      title: "Nachname",
      dataIndex: "lastname",
    },
    {
      title: "Benutzername",
      dataIndex: "username",
    },
    {
      title: "Rolle",
      dataIndex: "roleId",
    },
    {
      title: "Aktiv",
      dataIndex: "active",
      render: (value) => (value === 1 ? "Ja" : "Nein")
    }
  ];

  return (
    <Table
      rowKey="id"
      columns={columns}
      dataSource={users}
      loading={loading}
      pagination={false}
      rowClassName={(record) => (record.active === 0 ? "inactive-row" : "")}
    />
  );
}
