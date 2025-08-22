import React, { useEffect, useState } from 'react';
import {
  Card,
  List,
  Button,
  Space,
  Typography,
  Tag,
  Popconfirm,
  Tooltip,
  Empty,
  Spin,
  Alert,
  Dropdown,
  MenuProps,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  LinkOutlined,
  DisconnectOutlined,
  DatabaseOutlined,
  MoreOutlined,
} from '@ant-design/icons';
import { useConnectionsStore } from '../../stores/connections-store';
import { DATABASE_TYPES } from '../../types/connections';
import type { DatabaseConnection } from '../../types/connections';

const { Text } = Typography;

export const ConnectionsList: React.FC = () => {
  const {
    connections,
    activeConnectionId,
    loading,
    error,
    loadConnections,
    deleteConnection,
    connectToDatabase,
    disconnectFromDatabase,
    openConnectionForm,
    clearError,
  } = useConnectionsStore();

  // Charger les connexions au montage du composant
  useEffect(() => {
    loadConnections();
  }, [loadConnections]);

  const handleConnect = async (id: string) => {
    try {
      await connectToDatabase(id);
    } catch (error) {
      console.error('Erreur de connexion:', error);
    }
  };

  const handleDisconnect = async (id: string) => {
    try {
      await disconnectFromDatabase(id);
    } catch (error) {
      console.error('Erreur de déconnexion:', error);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteConnection(id);
    } catch (error) {
      console.error('Erreur de suppression:', error);
    }
  };

  const getDatabaseTypeIcon = (type: string) => {
    const dbType = DATABASE_TYPES.find(t => t.value === type);
    return dbType ? dbType.icon : '🗄️';
  };

  const getDatabaseTypeLabel = (type: string) => {
    const dbType = DATABASE_TYPES.find(t => t.value === type);
    return dbType ? dbType.label : type.toUpperCase();
  };

  const [contextMenu, setContextMenu] = useState<{visible: boolean, x: number, y: number, connection: DatabaseConnection | null}>({
    visible: false,
    x: 0,
    y: 0,
    connection: null
  });

  const handleDoubleClick = (connection: DatabaseConnection) => {
    const isActive = activeConnectionId === connection.id;
    if (isActive) {
      handleDisconnect(connection.id);
    } else {
      handleConnect(connection.id);
    }
  };

  const handleContextMenu = (e: React.MouseEvent, connection: DatabaseConnection) => {
    e.preventDefault();
    setContextMenu({
      visible: true,
      x: e.pageX,
      y: e.pageY,
      connection
    });
  };

  const closeContextMenu = () => {
    setContextMenu({visible: false, x: 0, y: 0, connection: null});
  };

  const getContextMenuItems = (connection: DatabaseConnection): MenuProps['items'] => [
    {
      key: 'edit',
      label: 'Edit',
      icon: <EditOutlined />,
      onClick: () => {
        openConnectionForm(connection);
        closeContextMenu();
      }
    },
    {
      key: 'delete',
      label: 'Delete',
      icon: <DeleteOutlined />,
      danger: true,
      onClick: () => {
        handleDelete(connection.id);
        closeContextMenu();
      }
    }
  ];

  // Fermer le menu contextuel au clic ailleurs
  React.useEffect(() => {
    const handleClick = () => closeContextMenu();
    if (contextMenu.visible) {
      document.addEventListener('click', handleClick);
      return () => document.removeEventListener('click', handleClick);
    }
  }, [contextMenu.visible]);

  const renderConnectionItem = (connection: DatabaseConnection) => {
    const isActive = activeConnectionId === connection.id;
    const isConnecting = loading;

    return (
      <div
        key={connection.id}
        className="connection-item"
        style={{
          padding: '8px 12px',
          border: '1px solid #f0f0f0',
          borderRadius: '8px',
          marginBottom: '8px',
          cursor: 'pointer',
          backgroundColor: isActive ? '#f6ffed' : '#fafafa',
          borderColor: isActive ? '#b7eb8f' : '#f0f0f0',
          transition: 'all 0.2s ease',
          position: 'relative'
        }}
        onDoubleClick={() => handleDoubleClick(connection)}
        onContextMenu={(e) => handleContextMenu(e, connection)}
        onMouseEnter={(e) => {
          if (!isActive) {
            e.currentTarget.style.backgroundColor = '#f5f5f5';
            e.currentTarget.style.borderColor = '#d9d9d9';
          }
        }}
        onMouseLeave={(e) => {
          if (!isActive) {
            e.currentTarget.style.backgroundColor = '#fafafa';
            e.currentTarget.style.borderColor = '#f0f0f0';
          }
        }}
      >
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ flex: 1 }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '4px'
            }}>
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
                  flexShrink: 0
                }}
              >
                {getDatabaseTypeIcon(connection.type)}
              </div>
              <Text strong style={{ fontSize: '14px' }}>{connection.name}</Text>
              {isActive && <Tag color="green" size="small">Connected</Tag>}
              {isConnecting && <Tag color="blue" size="small">Connecting...</Tag>}
            </div>
            <div style={{ paddingLeft: '32px' }}>
              <Text type="secondary" style={{ fontSize: '12px' }}>
                {connection.host}:{connection.port}
              </Text>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <Card
      title={
        <Space>
          <DatabaseOutlined />
          Connexions
        </Space>
      }
      extra={
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => openConnectionForm()}
          loading={loading}
        >
          Nouvelle connexion
        </Button>
      }
    >
      {error && (
        <Alert
          message="Erreur"
          description={error}
          type="error"
          showIcon
          closable
          onClose={clearError}
          style={{ marginBottom: 16 }}
        />
      )}

      <Spin spinning={loading && connections.length === 0}>
        {connections.length === 0 && !loading ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              <Space direction="vertical">
                <Text type="secondary">Aucune connexion configurée</Text>
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={() => openConnectionForm()}
                >
                  Créer votre première connexion
                </Button>
              </Space>
            }
          />
        ) : (
          <div style={{ padding: '0' }}>
            {connections.map(renderConnectionItem)}
          </div>
        )}
        
        {/* Menu contextuel */}
        {contextMenu.visible && contextMenu.connection && (
          <div
            style={{
              position: 'fixed',
              top: contextMenu.y,
              left: contextMenu.x,
              zIndex: 1000,
              backgroundColor: 'white',
              border: '1px solid #d9d9d9',
              borderRadius: '6px',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
              minWidth: '120px'
            }}
          >
            {getContextMenuItems(contextMenu.connection)?.map((item: any) => (
              <div
                key={item.key}
                style={{
                  padding: '8px 12px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '14px',
                  color: item.danger ? '#ff4d4f' : '#000',
                  borderBottom: '1px solid #f0f0f0'
                }}
                onClick={item.onClick}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f5f5f5';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'white';
                }}
              >
                {item.icon}
                {item.label}
              </div>
            ))}
          </div>
        )}
      </Spin>
    </Card>
  );
};