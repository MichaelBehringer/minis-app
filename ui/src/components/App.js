import { useEffect, useState } from 'react';
import { Routes, Route, Link, useNavigate } from 'react-router-dom';
import { Layout, Menu, Dropdown, Space, Tooltip } from 'antd';
import { HomeOutlined, DatabaseOutlined, AppstoreOutlined, UserOutlined } from '@ant-design/icons';
import { useMediaQuery } from 'react-responsive';
import { doGetRequestAuth } from '../helper/RequestHelper';
import { App as AntdApp } from 'antd';

import './App.css';

const { Header, Content } = Layout;

function Home() { return <h2>Home</h2>; }
function Stammdaten() { return <h2>Stammdaten</h2>; }
function Einteilung() { return <h2>Einteilung</h2>; }

function App(props) {
  const { message } = AntdApp.useApp();
  const [loggedUserId, setLoggedUserId] = useState();
  const [loggedRoleId, setLoggedRoleId] = useState();
  const [loggedInitials, setLoggedInitials] = useState();

  const navigate = useNavigate();
  const isCompactMasterData = useMediaQuery({ maxWidth: 430 });
  const isCompactPlanner = useMediaQuery({ maxWidth: 500 });

  useEffect(() => {
    doGetRequestAuth('checkToken', props.token).then((res) => {
      message.info('Hallo ' + res.data.name);
      setLoggedInitials(res.data.name.split(' ').map(word => word[0]).join(''));
      setLoggedUserId(res.data.id);
      setLoggedRoleId(res.data.roleId);
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

  if (loggedRoleId === 2 || loggedRoleId === 3) {
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
      { key: 'settings', label: 'Einstellungen' },
      { key: 'logout', label: 'Logout', onClick: props.logout }
    ]
  };

  return (
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
              
                <Tooltip title={loggedInitials}>
                  <span>{loggedInitials}</span>
                </Tooltip>
            </Space>
          </Dropdown>

        </Header>

        <Content style={{ padding: '20px' }}>
          <Routes>
            <Route path="/" element={<Home />} />
            {(loggedRoleId === 2 || loggedRoleId === 3) && (
              <>
                <Route path="/stammdaten" element={<Stammdaten />} />
                <Route path="/einteilung" element={<Einteilung />} />
              </>
            )}
          </Routes>
        </Content>
      </Layout>
  );
}

export default App;
