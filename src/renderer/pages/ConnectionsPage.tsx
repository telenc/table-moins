import React from 'react';
import { Layout, Typography } from 'antd';
import { CompactConnectionsList } from '../components/connections/CompactConnectionsList';
import { ConnectionForm } from '../components/connections/ConnectionForm';
import { useConnectionsStore } from '../stores/connections-store';

const { Content } = Layout;
const { Title } = Typography;

export const ConnectionsPage: React.FC = () => {
  const { isConnectionFormOpen, closeConnectionForm } = useConnectionsStore();

  return (
    <Layout>
      <Content style={{ padding: '24px', height: '100%', overflow: 'auto' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <Title level={2} style={{ marginBottom: '24px' }}>
            Gestion des connexions
          </Title>
          
          <CompactConnectionsList />
          
          <ConnectionForm
            visible={isConnectionFormOpen}
            onCancel={closeConnectionForm}
          />
        </div>
      </Content>
    </Layout>
  );
};