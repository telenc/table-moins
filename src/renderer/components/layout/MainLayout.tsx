import React from 'react';
import { Layout } from 'antd';
import { Sidebar } from './Sidebar';
import { MainContent } from './MainContent';
import { useAppStore } from '../../stores/app-store';

const { Sider, Content } = Layout;

export const MainLayout: React.FC = () => {
  const { sidebarCollapsed } = useAppStore();

  return (
    <Layout style={{ height: '100vh' }}>
      <Sider
        width={280}
        collapsedWidth={48}
        collapsed={sidebarCollapsed}
        theme="light"
        style={{
          borderRight: '1px solid #f0f0f0',
          background: '#fafafa',
        }}
      >
        <Sidebar />
      </Sider>
      
      <Content style={{ display: 'flex', flexDirection: 'column' }}>
        <MainContent />
      </Content>
    </Layout>
  );
};