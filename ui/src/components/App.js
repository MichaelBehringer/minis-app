import { useEffect, useState } from 'react';
import { Routes, Route, Link, useNavigate } from 'react-router-dom';
import { Layout, Menu, Dropdown, Space, Tooltip } from 'antd';
import { HomeOutlined, DatabaseOutlined, AppstoreOutlined, UserOutlined } from '@ant-design/icons';
import { useMediaQuery } from 'react-responsive';
import { doGetRequestAuth } from '../helper/RequestHelper';
import { App as AntdApp } from 'antd';

import './App.css';
import Home from './Home';

const { Header, Content } = Layout;

function Stammdaten() { return <h2>Stammdaten</h2>; }
function Einteilung() { return <h2>Einteilung</h2>; }

function App(props) {
  const { message } = AntdApp.useApp();
  const [userId, setUserId] = useState();
  const [roleId, setRoleId] = useState();
  const [initials, setInitials] = useState();

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
      { key: 'settings', label: 'Einstellungen' },
      { key: 'logout', label: 'Logout', onClick: props.logout }
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
              
                <Tooltip title={initials}>
                  <span>{initials}</span>
                </Tooltip>
            </Space>
          </Dropdown>

        </Header>

        <Content style={{ padding: '20px' }}>
          <Routes>
            <Route path="/" element={<Home userId={userId} token={props.token}/>} />
            {(roleId === 2 || roleId === 3) && (
              <>
                <Route path="/stammdaten" element={<Stammdaten />} />
                <Route path="/einteilung" element={<Einteilung />} />
              </>
            )}
          </Routes>
        </Content>
      </Layout>
      ) : (
        <div>Daten werden geladen</div>
      )}
    </div>
  );
}

export default App;
