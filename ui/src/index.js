import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import { HashRouter } from 'react-router-dom';
import TokenContainer from './TokenContainer';
import { App as AntdApp } from "antd";
import '@ant-design/v5-patch-for-react-19';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <AntdApp>
  <HashRouter>
      <TokenContainer />
  </HashRouter>
  </AntdApp>
);
