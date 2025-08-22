import React, { useEffect, useState } from 'react';
import {
  Card,
  Button,
  Space,
  Typography,
  Tag,
  Empty,
  Spin,
  Alert,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  DatabaseOutlined,
} from '@ant-design/icons';
import { useConnectionsStore } from '../../stores/connections-store';
import { DATABASE_TYPES } from '../../types/connections';
import type { DatabaseConnection } from '../../types/connections';

const { Text } = Typography;

export const CompactConnectionsList: React.FC = () => {
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

  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    connection: DatabaseConnection | null;
  }>({
    visible: false,
    x: 0,
    y: 0,
    connection: null
  });

  useEffect(() => {
    loadConnections();
  }, [loadConnections]);

  const handleConnect = async (id: string) => {
    try {
      await connectToDatabase(id);
    } catch (error) {
      console.error('Connection error:', error);
    }
  };

  const handleDisconnect = async (id: string) => {
    try {
      await disconnectFromDatabase(id);
    } catch (error) {
      console.error('Disconnection error:', error);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteConnection(id);
    } catch (error) {
      console.error('Delete error:', error);
    }
  };

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
    setContextMenu({ visible: false, x: 0, y: 0, connection: null });
  };

  const getDatabaseTypeIcon = (type: string) => {
    const dbType = DATABASE_TYPES.find(t => t.value === type);
    return dbType ? dbType.icon : '🗄️';
  };

  // Close context menu on click elsewhere
  useEffect(() => {
    const handleClick = () => closeContextMenu();
    if (contextMenu.visible) {
      document.addEventListener('click', handleClick);
      return () => document.removeEventListener('click', handleClick);
    }
  }, [contextMenu.visible]);

  const renderConnection = (connection: DatabaseConnection) => {
    const isActive = activeConnectionId === connection.id;
    const isConnecting = loading;

    return (
      <div
        key={connection.id}
        style={{
          padding: '12px 16px',
          border: '1px solid #e8e8e8',
          borderRadius: '8px',
          marginBottom: '8px',
          cursor: 'pointer',
          backgroundColor: isActive ? '#f6ffed' : 'white',
          borderColor: isActive ? '#52c41a' : '#e8e8e8',
          transition: 'all 0.2s ease',
          boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
        }}
        onDoubleClick={() => handleDoubleClick(connection)}
        onContextMenu={(e) => handleContextMenu(e, connection)}
        onMouseEnter={(e) => {
          if (!isActive) {
            e.currentTarget.style.backgroundColor = '#fafafa';
            e.currentTarget.style.borderColor = '#d9d9d9';
          }
        }}
        onMouseLeave={(e) => {
          if (!isActive) {
            e.currentTarget.style.backgroundColor = 'white';
            e.currentTarget.style.borderColor = '#e8e8e8';
          }
        }}
      >
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          {/* Icon */}
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: '6px',
              backgroundColor: connection.color || '#1890ff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '14px',
              flexShrink: 0
            }}
          >
            {getDatabaseTypeIcon(connection.type)}
          </div>
          
          {/* Content */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '2px'
            }}>
              <Text 
                strong 
                style={{ 
                  fontSize: '15px',
                  color: '#262626',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  flex: 1
                }}
              >
                {connection.name}
              </Text>
              {isActive && (
                <Tag color="green" size="small" style={{ margin: 0 }}>
                  Connected
                </Tag>
              )}
              {isConnecting && (
                <Tag color="blue" size="small" style={{ margin: 0 }}>
                  Connecting...
                </Tag>
              )}
            </div>
            
            <Text 
              type="secondary" 
              style={{ 
                fontSize: '13px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                display: 'block'
              }}
            >
              {connection.host}:{connection.port}
            </Text>
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
          Connections
        </Space>
      }
      extra={
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => openConnectionForm()}
          loading={loading}
          size="small"
        >
          New
        </Button>
      }
      style={{ height: '100%' }}
      bodyStyle={{ padding: '16px' }}
    >
      {error && (
        <Alert
          message="Error"
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
            description="No connections configured"
            style={{ padding: '40px 0' }}
          >
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => openConnectionForm()}
            >
              Create your first connection
            </Button>
          </Empty>
        ) : (
          <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
            {connections.map(renderConnection)}
          </div>
        )}
      </Spin>
      
      {/* Context Menu */}
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
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            minWidth: '120px',
            overflow: 'hidden'
          }}
        >
          <div
            style={{
              padding: '8px 12px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '14px',
              borderBottom: '1px solid #f0f0f0',
              transition: 'background-color 0.2s'
            }}
            onClick={() => {
              openConnectionForm(contextMenu.connection!);
              closeContextMenu();
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#f5f5f5';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'white';
            }}
          >
            <EditOutlined />
            Edit
          </div>
          
          <div
            style={{
              padding: '8px 12px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '14px',
              color: '#ff4d4f',
              transition: 'background-color 0.2s'
            }}
            onClick={() => {
              handleDelete(contextMenu.connection!.id);
              closeContextMenu();
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#fff2f0';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'white';
            }}
          >
            <DeleteOutlined />
            Delete
          </div>
        </div>
      )}
    </Card>
  );
};