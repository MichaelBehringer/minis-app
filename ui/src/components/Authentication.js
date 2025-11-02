import React, { useState } from 'react';
import { Form, Input, Button, Checkbox, Card, Row, Col, Typography } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { doPostRequest } from '../helper/RequestHelper';
import { toastError } from '../helper/ToastHelper';
import './Authentication.css';

const { Title } = Typography;

function Authentication(props) {
	const navigate = useNavigate();
	const [loading, setLoading] = useState(false);

	function handleLogin(values) {
		setLoading(true);
		const params = { username: values.username, password: values.password };
		doPostRequest("login", params).then((response) => {
			setLoading(false);
			props.setToken(response.data.accessToken, values.remember);
			navigate("/")
		}, error => {
			setLoading(false);
			if (error.response.status === 401) {
				toastError('Benutzername oder Passwort falsch!');
			}
			return error;
		});
	}

	return (
		<div style={{
			height: '100vh',
			backgroundImage: 'url(background_login.webp)',
			backgroundSize: 'cover',
			backgroundPosition: 'center',
			display: 'flex',
			justifyContent: 'center',
			alignItems: 'center'
		}}>
			<Row justify="center" align="middle">
				<Col>
					<Card style={{ minWidth: 300, boxShadow: '0 4px 8px rgba(0, 0, 0, 0.2)' }}>
						<Title level={2} style={{ textAlign: 'center' }}>Login</Title>
						<Form
							name="normal_login"
							className="login-form"
							initialValues={{ remember: false }}
							onFinish={handleLogin}
						>
							<Form.Item
								name="username"
								rules={[{ required: true, message: 'Bitte Benutzernamen angeben!' }]}
							>
								<Input
  className="login-input"
  prefix={<UserOutlined className="site-form-item-icon" />}
  placeholder="Benutzername"
/>

							</Form.Item>
							<Form.Item
								name="password"
								rules={[{ required: true, message: 'Bitte Passwort angeben!' }]}
							>
								<Input
  className="login-input"
  prefix={<LockOutlined className="site-form-item-icon" />}
  type="password"
  placeholder="Passwort"
/>
							</Form.Item>
							<Form.Item>
								<Form.Item name="remember" valuePropName="checked" noStyle>
									<Checkbox>Angemeldet bleiben</Checkbox>
								</Form.Item>
							</Form.Item>

							<Form.Item style={{ textAlign: 'right' }}>
								<Button type="primary" htmlType="submit" className="login-form-button" loading={loading}>
									Log in
								</Button>
							</Form.Item>
						</Form>
					</Card>
				</Col>
			</Row>
		</div>
	);
};

export default Authentication;
