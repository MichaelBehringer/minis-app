import { useEffect, useMemo, useState } from 'react'
import {
  Button,
  Card,
  Empty,
  Input,
  Segmented,
  Space,
  Spin,
  Table,
  Tag,
  Typography,
} from 'antd'
import { EditOutlined } from '@ant-design/icons'
import { doGetRequestAuth } from '../helper/RequestHelper'
import { myToastError } from '../helper/ToastHelper'
import useIsMobile from '../hooks/useIsMobile'

// Namen der Rollen kommen aus der Datenbank. Vorher stand in der Tabelle die
// rohe Zahl, ohne dass irgendwo stand, was sie bedeutet.
function rollenName(rollen, id) {
  return rollen.find((r) => r.id === id)?.name ?? `Rolle ${id}`
}

function MiniKarte({ user, rollen, onEditUser }) {
  return (
    <Card
      size="small"
      style={{ marginBottom: 8, opacity: user.active === 1 ? 1 : 0.55 }}
    >
      <Space
        style={{ width: '100%', justifyContent: 'space-between' }}
        align="start"
      >
        <Space direction="vertical" size={2}>
          <Typography.Text strong>
            {user.firstname} {user.lastname}
          </Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 13 }}>
            {user.username}
          </Typography.Text>
          <Space size={4} wrap style={{ marginTop: 2 }}>
            <Tag>{rollenName(rollen, user.roleId)}</Tag>
            {user.active !== 1 && <Tag color="default">Inaktiv</Tag>}
            {user.incense === 1 && <Tag color="purple">Weihrauch</Tag>}
          </Space>
        </Space>

        <Button
          type="text"
          icon={<EditOutlined aria-hidden />}
          onClick={() => onEditUser(user.id)}
          aria-label={`${user.firstname} ${user.lastname} bearbeiten`}
        />
      </Space>
    </Card>
  )
}

export default function Stammdaten({ token, onEditUser }) {
  const isMobile = useIsMobile()
  const [users, setUsers] = useState([])
  const [rollen, setRollen] = useState([])
  const [loading, setLoading] = useState(true)
  const [suche, setSuche] = useState('')
  const [filter, setFilter] = useState('aktiv')

  useEffect(() => {
    async function laden() {
      setLoading(true)
      try {
        const [u, r] = await Promise.all([
          doGetRequestAuth('user', token),
          doGetRequestAuth('role', token),
        ])
        setUsers(u.data || [])
        setRollen(r.data || [])
      } catch {
        myToastError('Ministranten konnten nicht geladen werden')
      } finally {
        setLoading(false)
      }
    }
    laden()
  }, [token])

  const gefiltert = useMemo(() => {
    const s = suche.trim().toLowerCase()
    return users
      .filter((u) => (filter === 'aktiv' ? u.active === 1 : u.active !== 1))
      .filter((u) => {
        if (!s) return true
        return `${u.firstname} ${u.lastname} ${u.username}`
          .toLowerCase()
          .includes(s)
      })
  }, [users, suche, filter])

  const aktiveAnzahl = users.filter((u) => u.active === 1).length

  const columns = [
    {
      title: 'Vorname',
      dataIndex: 'firstname',
      sorter: (a, b) => a.firstname.localeCompare(b.firstname),
    },
    {
      title: 'Nachname',
      dataIndex: 'lastname',
      defaultSortOrder: 'ascend',
      sorter: (a, b) => a.lastname.localeCompare(b.lastname),
    },
    { title: 'Benutzername', dataIndex: 'username' },
    {
      title: 'Rolle',
      dataIndex: 'roleId',
      render: (id) => rollenName(rollen, id),
    },
    {
      title: 'Weihrauch',
      dataIndex: 'incense',
      render: (v) => (v === 1 ? 'Ja' : 'Nein'),
    },
    {
      title: '',
      key: 'edit',
      width: 130,
      render: (_, record) => (
        <Button
          icon={<EditOutlined aria-hidden />}
          onClick={() => onEditUser(record.id)}
        >
          Bearbeiten
        </Button>
      ),
    },
  ]

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '48px 0' }}>
        <Spin size="large" />
      </div>
    )
  }

  return (
    <div>
      <Space direction="vertical" size={8} style={{ width: '100%', marginBottom: 12 }}>
        <Input.Search
          placeholder="Name oder Benutzername suchen"
          allowClear
          value={suche}
          onChange={(e) => setSuche(e.target.value)}
          aria-label="Ministranten suchen"
        />
        <Segmented
          block
          value={filter}
          onChange={setFilter}
          options={[
            { label: `Aktiv (${aktiveAnzahl})`, value: 'aktiv' },
            { label: `Inaktiv (${users.length - aktiveAnzahl})`, value: 'inaktiv' },
          ]}
        />
      </Space>

      {gefiltert.length === 0 ? (
        <Empty description="Keine Ministranten gefunden" />
      ) : isMobile ? (
        // Am Handy Karten statt einer Tabelle: sechs Spalten in 390px
        // bedeuten waagerechtes Scrollen fuer jede Zeile.
        gefiltert.map((u) => (
          <MiniKarte
            key={u.id}
            user={u}
            rollen={rollen}
            onEditUser={onEditUser}
          />
        ))
      ) : (
        <Table
          rowKey="id"
          columns={columns}
          dataSource={gefiltert}
          pagination={false}
          size="middle"
        />
      )}
    </div>
  )
}
