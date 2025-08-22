import React, { useEffect } from 'react';
import { Button, Space, Typography, Menu, Badge, Tag } from 'antd';
import { 
  DatabaseOutlined, 
  PlusOutlined,
  MenuUnfoldOutlined,
  MenuFoldOutlined,
  HomeOutlined,
  SettingOutlined,
  TableOutlined,
  CodeOutlined,
  LinkOutlined
} from '@ant-design/icons';
import { useAppStore } from '../../stores/app-store';
import { useNavigationStore } from '../../stores/navigation-store';
import { useConnectionsStore } from '../../stores/connections-store';
import { DATABASE_TYPES } from '../../types/connections';

const { Text } = Typography;

export const Sidebar: React.FC = () => {
  const { sidebarCollapsed, toggleSidebar } = useAppStore();
  const { currentRoute, setCurrentRoute } = useNavigationStore();
  const { 
    connections, 
    activeConnectionId, 
    openConnectionForm, 
    loadConnections, 
    connectToDatabase 
  } = useConnectionsStore();

  // Charger les connexions au montage
  useEffect(() => {
    loadConnections();
  }, [loadConnections]);

  const handleNewConnection = () => {
    openConnectionForm();
  };

  const getDatabaseTypeIcon = (type: string) => {
    const dbType = DATABASE_TYPES.find(t => t.value === type);
    return dbType ? dbType.icon : '🗄️';
  };

  return (
    <div style={{ 
      height: '100%', 
      display: 'flex', 
      flexDirection: 'column',
      padding: sidebarCollapsed ? '8px 4px' : '16px'
    }}>
      {/* Header */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '16px'
      }}>
        {!sidebarCollapsed && (
          <Space>
            <DatabaseOutlined style={{ color: '#1890ff', fontSize: '20px' }} />
            <Text strong style={{ fontSize: '16px' }}>TableMoins</Text>
          </Space>
        )}
        
        <Button
          type="text"
          size="small"
          icon={sidebarCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
          onClick={toggleSidebar}
        />
      </div>

      {/* Navigation Menu */}
      <div style={{ marginBottom: '16px' }}>
        <Menu
          mode="inline"
          selectedKeys={[currentRoute]}
          inlineCollapsed={sidebarCollapsed}
          style={{ border: 'none', background: 'transparent' }}
          onSelect={({ key }) => setCurrentRoute(key as any)}
          items={[
            {
              key: 'home',
              icon: <HomeOutlined />,
              label: 'Accueil',
            },
            {
              key: 'connections',
              icon: <SettingOutlined />,
              label: 'Connexions',
            },
          ]}
        />
      </div>

      {/* Actions */}
      <div style={{ marginBottom: '16px' }}>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={handleNewConnection}
          style={{ width: '100%' }}
          {...(sidebarCollapsed && { 
            style: { width: '40px', height: '40px' },
            shape: 'circle' as const
          })}
        >
          {!sidebarCollapsed && 'Nouvelle connexion'}
        </Button>
      </div>

      {/* Liste des connexions */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {!sidebarCollapsed && (
          <div>
            {connections.length === 0 ? (
              <div style={{ 
                textAlign: 'center', 
                padding: '40px 20px',
                color: '#999'
              }}>
                <DatabaseOutlined style={{ fontSize: '48px', marginBottom: '16px' }} />
                <Text type="secondary">
                  Aucune connexion configurée.
                  <br />
                  Commencez par ajouter une nouvelle connexion.
                </Text>
              </div>
            ) : (
              <div>
                <Text type="secondary" style={{ padding: '0 8px', fontSize: '12px' }}>
                  CONNEXIONS ({connections.length})
                </Text>
                <div style={{ marginTop: '8px' }}>
                  {connections.map((connection) => (
                    <div
                      key={connection.id}
                      style={{
                        padding: '8px',
                        marginBottom: '4px',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        backgroundColor: activeConnectionId === connection.id ? '#e6f7ff' : 'transparent',
                        border: activeConnectionId === connection.id ? '1px solid #1890ff' : '1px solid transparent',
                        transition: 'all 0.2s'
                      }}
                      onClick={() => connectToDatabase(connection.id)}
                    >
                      <Space style={{ width: '100%' }}>
                        <div
                          style={{
                            width: 24,
                            height: 24,
                            borderRadius: '50%',
                            backgroundColor: connection.color || '#1890ff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '12px',
                          }}
                        >
                          {getDatabaseTypeIcon(connection.type)}
                        </div>
                        <div style={{ flex: 1, overflow: 'hidden' }}>
                          <Text strong style={{ fontSize: '13px', color: '#262626' }}>
                            {connection.name}
                          </Text>
                          <br />
                          <Text type="secondary" style={{ fontSize: '11px' }}>
                            {connection.host}:{connection.port}
                          </Text>
                          {activeConnectionId === connection.id && (
                            <Tag color="green" style={{ marginLeft: '4px', fontSize: '10px' }}>
                              <LinkOutlined /> Actif
                            </Tag>
                          )}
                        </div>
                      </Space>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};