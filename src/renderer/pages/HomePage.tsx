import React from 'react';
import { Typography, Card, Space, Button } from 'antd';
import { 
  DatabaseOutlined, 
  PlusOutlined, 
  BookOutlined,
  SettingOutlined
} from '@ant-design/icons';
import { useNavigationStore } from '../stores/navigation-store';
import { useConnectionsStore } from '../stores/connections-store';

const { Title, Text, Paragraph } = Typography;

export const HomePage: React.FC = () => {
  const { setCurrentRoute } = useNavigationStore();
  const { openConnectionForm } = useConnectionsStore();

  const handleNewConnection = () => {
    openConnectionForm();
  };

  const handleGoToConnections = () => {
    setCurrentRoute('connections');
  };

  return (
    <div style={{ 
      height: '100%', 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center',
      padding: '40px',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      minHeight: '100vh'
    }}>
      <Card 
        style={{ 
          maxWidth: '600px', 
          textAlign: 'center',
          boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
          borderRadius: '16px',
          border: 'none'
        }}
      >
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <div style={{ 
            background: 'linear-gradient(135deg, #1890ff 0%, #096dd9 100%)',
            borderRadius: '50%',
            width: '120px',
            height: '120px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto',
            marginBottom: '24px'
          }}>
            <DatabaseOutlined 
              style={{ 
                fontSize: '64px', 
                color: '#fff'
              }} 
            />
          </div>
          
          <Title level={1} style={{ color: '#262626', margin: 0 }}>
            TableMoins
          </Title>
          
          <Title level={4} style={{ color: '#595959', margin: 0, fontWeight: 400 }}>
            Modern database management tool
          </Title>
          
          <Paragraph style={{ 
            fontSize: '16px', 
            lineHeight: '1.6',
            color: '#8c8c8c',
            margin: '24px 0'
          }}>
            Connectez-vous facilement à vos bases de données MySQL et PostgreSQL.
            <br />
            Interface intuitive, sécurisée et performante.
          </Paragraph>

          <Space size="large" wrap style={{ marginTop: '32px' }}>
            <Button 
              type="primary" 
              size="large"
              icon={<PlusOutlined />}
              onClick={handleNewConnection}
              style={{
                borderRadius: '8px',
                height: '48px',
                paddingLeft: '24px',
                paddingRight: '24px',
                fontSize: '16px'
              }}
            >
              Nouvelle connexion
            </Button>
            
            <Button 
              size="large"
              icon={<SettingOutlined />}
              onClick={handleGoToConnections}
              style={{
                borderRadius: '8px',
                height: '48px',
                paddingLeft: '24px',
                paddingRight: '24px',
                fontSize: '16px'
              }}
            >
              Gérer les connexions
            </Button>
          </Space>

          <div style={{ 
            marginTop: '48px', 
            paddingTop: '24px',
            borderTop: '1px solid #f0f0f0'
          }}>
            <Space size="middle">
              <Text type="secondary" style={{ fontSize: '14px' }}>
                Version 0.1.0
              </Text>
              <Text type="secondary" style={{ fontSize: '14px' }}>
                •
              </Text>
              <Text type="secondary" style={{ fontSize: '14px' }}>
                Développé avec Electron & React
              </Text>
            </Space>
          </div>
        </Space>
      </Card>
    </div>
  );
};