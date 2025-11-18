import { useEffect, useState } from 'react';
import { Routes, Route, Link, useNavigate } from 'react-router-dom';
import { Layout, Menu, Dropdown, Space } from 'antd';
import { HomeOutlined, DatabaseOutlined, AppstoreOutlined, UserOutlined } from '@ant-design/icons';
import { useMediaQuery } from 'react-responsive';
import { doGetRequestAuth } from '../helper/RequestHelper';
import { App as AntdApp } from 'antd';

import './App.css';
import Home from './Home';
import UserEditModal from './UserEditModal';
import Stammdaten from './Stammdaten';

const { Header, Content } = Layout;

function Einteilung() { return <h2>Einteilung</h2>; }

function App(props) {
  const { message } = AntdApp.useApp();
  const [userId, setUserId] = useState();
  const [editUserId, setEditUserId] = useState(null);
  const [roleId, setRoleId] = useState();
  const [initials, setInitials] = useState();
  const [userModalOpen, setUserModalOpen] = useState(false);


  const navigate = useNavigate();
  const isCompactMasterData = useMediaQuery({ maxWidth: 430 });
  const isCompactPlanner = useMediaQuery({ maxWidth: 500 });

  useEffect(() => {
    doGetRequestAuth('checkToken', props.token).then((res) => {
      message.info('Hallo ' + res.data.name);
      setInitials(res.data.name.split(' ').map(word => word[0]).join(''));
      setUserId(res.data.id);
      setRoleId(res.data.roleId);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const menuItems = [
    {
      key: '1',
      icon: <HomeOutlined />,
      label: <Link to="/">Home</Link>,
      onClick: () => navigate('/'),
    },
  ];

  if (roleId === 2 || roleId === 3) {
    menuItems.push(
      {
        key: '2',
        icon: <DatabaseOutlined />,
        label: !isCompactMasterData ? <Link to="/stammdaten">Stammdaten</Link> : null,
        onClick: () => navigate('/stammdaten')
      },
      {
        key: '3',
        icon: <AppstoreOutlined />,
        label: !isCompactPlanner ? <Link to="/einteilung">Einteilung</Link> : null,
        onClick: () => navigate('/einteilung')
      }
    );
  }

  const userMenu = {
    items: [
      { key: 'settings', label: 'Einstellungen', onClick: () => setUserModalOpen(true) },
      { key: 'logout', label: 'Logout', onClick: props.removeToken }
    ]
  };

  return (
    <div>
      {(userId && roleId) ? (
        <Layout>
          <Header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>

            <Menu
              theme="dark"
              mode="horizontal"
              defaultSelectedKeys={['1']}
              items={menuItems.map(item => ({
                ...item
              }))}
              style={{ flex: 1, minWidth: 0 }}
            />

            <Dropdown menu={userMenu} placement="bottomRight">
              <Space style={{ color: '#fff', cursor: 'pointer' }}>
                <UserOutlined />
                <span>{initials}</span>
              </Space>
            </Dropdown>

          </Header>

          <Content style={{ padding: '20px' }}>
            <Routes>
              <Route path="/" element={<Home userId={userId} token={props.token} />} />
              {(roleId === 2 || roleId === 3) && (
                <>
                  <Route
                    path="/stammdaten"
                    element={
                      <Stammdaten
                        token={props.token}
                        onEditUser={(id) => {
                          setEditUserId(id);
                          setUserModalOpen(true);
                        }}
                      />
                    }
                  />

                  <Route path="/einteilung" element={<Einteilung />} />
                </>
              )}
            </Routes>
          </Content>
        </Layout>
      ) : (
        <div>Daten werden geladen</div>
      )}
      <UserEditModal
        userId={editUserId ?? userId}
        token={props.token}
        open={userModalOpen}
        onClose={() => {
          setUserModalOpen(false)
          setEditUserId(null)
        }}
      />

    </div>
  );
}

export default App;
