import React, { useState, useEffect } from 'react';
import {
  Modal,
  Form,
  Input,
  Select,
  InputNumber,
  Switch,
  Button,
  Space,
  Alert,
  Tabs,
  Divider,
  Row,
  Col,
  Spin,
} from 'antd';
import {
  DatabaseOutlined,
  ExperimentOutlined,
  SaveOutlined,
  CloseOutlined,
  SecurityScanOutlined,
} from '@ant-design/icons';
import { useConnectionsStore } from '../../stores/connections-store';
import { ConnectionFormData, DATABASE_TYPES, DEFAULT_PORTS, CONNECTION_COLORS } from '../../types/connections';

const { Option } = Select;
const { TabPane } = Tabs;
const { TextArea } = Input;

interface ConnectionFormProps {
  visible: boolean;
  onCancel: () => void;
}

export const ConnectionForm: React.FC<ConnectionFormProps> = ({
  visible,
  onCancel,
}) => {
  const [form] = Form.useForm<ConnectionFormData>();
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; details?: string } | null>(null);
  
  const {
    createConnection,
    updateConnection,
    testConnection,
    editingConnection,
    loading,
    error,
    clearError,
  } = useConnectionsStore();

  const isEditing = !!editingConnection;

  // Initialiser le formulaire avec les données de connexion si en mode édition
  useEffect(() => {
    if (visible) {
      clearError();
      setTestResult(null);
      
      if (editingConnection) {
        form.setFieldsValue({
          name: editingConnection.name,
          type: editingConnection.type,
          host: editingConnection.host,
          port: editingConnection.port,
          username: editingConnection.username,
          password: '', // Ne pas pré-remplir le mot de passe pour la sécurité
          database: editingConnection.database || '',
          ssl: editingConnection.ssl,
          sslCert: editingConnection.sslCert || '',
          sslKey: editingConnection.sslKey || '',
          sslCa: editingConnection.sslCa || '',
          color: editingConnection.color || CONNECTION_COLORS[0],
        });
      } else {
        // Valeurs par défaut pour une nouvelle connexion
        form.setFieldsValue({
          name: '',
          type: 'mysql',
          host: 'localhost',
          port: DEFAULT_PORTS.mysql,
          username: '',
          password: '',
          database: '',
          ssl: false,
          sslCert: '',
          sslKey: '',
          sslCa: '',
          color: CONNECTION_COLORS[0],
        });
      }
    }
  }, [visible, editingConnection, form, clearError]);

  // Mettre à jour le port par défaut quand le type de base change
  const handleDatabaseTypeChange = (type: 'mysql' | 'postgresql' | 'sqlite') => {
    if (type !== 'sqlite') {
      form.setFieldValue('port', DEFAULT_PORTS[type]);
    }
  };

  // Tester la connexion
  const handleTestConnection = async () => {
    try {
      await form.validateFields();
      const formData = form.getFieldsValue();
      
      setTesting(true);
      setTestResult(null);
      
      const result = await testConnection(formData);
      setTestResult(result);
    } catch (error) {
      console.error('Erreur lors de la validation du formulaire:', error);
    } finally {
      setTesting(false);
    }
  };

  // Sauvegarder la connexion
  const handleSave = async () => {
    try {
      await form.validateFields();
      const formData = form.getFieldsValue();

      if (isEditing && editingConnection) {
        await updateConnection(editingConnection.id, formData);
      } else {
        await createConnection(formData);
      }

      form.resetFields();
      onCancel();
    } catch (error) {
      console.error('Erreur lors de la validation du formulaire:', error);
    }
  };

  // Annuler et fermer
  const handleCancel = () => {
    form.resetFields();
    setTestResult(null);
    clearError();
    onCancel();
  };

  const formItemLayout = {
    labelCol: { span: 6 },
    wrapperCol: { span: 18 },
  };

  return (
    <Modal
      title={
        <Space>
          <DatabaseOutlined />
          {isEditing ? 'Modifier la connexion' : 'Nouvelle connexion'}
        </Space>
      }
      open={visible}
      onCancel={handleCancel}
      width={800}
      footer={[
        <Button key="cancel" onClick={handleCancel}>
          <CloseOutlined /> Annuler
        </Button>,
        <Button
          key="test"
          icon={<ExperimentOutlined />}
          onClick={handleTestConnection}
          loading={testing}
          disabled={loading}
        >
          Tester
        </Button>,
        <Button
          key="save"
          type="primary"
          icon={<SaveOutlined />}
          onClick={handleSave}
          loading={loading}
          disabled={testing}
        >
          {isEditing ? 'Modifier' : 'Créer'}
        </Button>,
      ]}
    >
      <Spin spinning={loading || testing}>
        <Form
          form={form}
          {...formItemLayout}
          layout="horizontal"
          requiredMark={false}
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

          {testResult && (
            <Alert
              message={testResult.success ? 'Test réussi' : 'Test échoué'}
              description={testResult.message}
              type={testResult.success ? 'success' : 'error'}
              showIcon
              style={{ marginBottom: 16 }}
            />
          )}

          <Tabs defaultActiveKey="general" size="small">
            <TabPane tab="Général" key="general">
              <Form.Item
                label="Nom"
                name="name"
                rules={[
                  { required: true, message: 'Le nom est requis' },
                  { min: 2, message: 'Le nom doit contenir au moins 2 caractères' },
                ]}
              >
                <Input placeholder="Ma connexion MySQL" />
              </Form.Item>

              <Form.Item
                label="Type"
                name="type"
                rules={[{ required: true, message: 'Le type est requis' }]}
              >
                <Select onChange={handleDatabaseTypeChange}>
                  {DATABASE_TYPES.map((type) => (
                    <Option key={type.value} value={type.value}>
                      <Space>
                        <span>{type.icon}</span>
                        {type.label}
                      </Space>
                    </Option>
                  ))}
                </Select>
              </Form.Item>

              <Row gutter={16}>
                <Col span={16}>
                  <Form.Item
                    label="Hôte"
                    name="host"
                    rules={[{ required: true, message: 'L\'hôte est requis' }]}
                  >
                    <Input placeholder="localhost" />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item
                    label="Port"
                    name="port"
                    rules={[
                      { required: true, message: 'Le port est requis' },
                      { type: 'number', min: 1, max: 65535, message: 'Port invalide' },
                    ]}
                  >
                    <InputNumber style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item
                label="Nom d'utilisateur"
                name="username"
                rules={[{ required: true, message: 'Le nom d\'utilisateur est requis' }]}
              >
                <Input placeholder="root" />
              </Form.Item>

              <Form.Item
                label="Mot de passe"
                name="password"
                rules={[{ required: !isEditing, message: 'Le mot de passe est requis' }]}
              >
                <Input.Password 
                  placeholder={isEditing ? 'Laisser vide pour ne pas changer' : 'Mot de passe'} 
                />
              </Form.Item>

              <Form.Item
                label="Base de données"
                name="database"
              >
                <Input placeholder="Optionnel" />
              </Form.Item>

              <Form.Item
                label="Couleur"
                name="color"
              >
                <Select>
                  {CONNECTION_COLORS.map((color) => (
                    <Option key={color} value={color}>
                      <Space>
                        <div
                          style={{
                            width: 16,
                            height: 16,
                            backgroundColor: color,
                            borderRadius: '50%',
                            display: 'inline-block',
                          }}
                        />
                        {color}
                      </Space>
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </TabPane>

            <TabPane tab={<><SecurityScanOutlined /> SSL</>} key="ssl">
              <Form.Item
                label="Utiliser SSL"
                name="ssl"
                valuePropName="checked"
              >
                <Switch />
              </Form.Item>

              <Form.Item
                noStyle
                shouldUpdate={(prevValues, currentValues) =>
                  prevValues.ssl !== currentValues.ssl
                }
              >
                {({ getFieldValue }) => {
                  const useSSL = getFieldValue('ssl');
                  
                  if (!useSSL) return null;
                  
                  return (
                    <>
                      <Divider orientation="left" plain>
                        Certificats SSL
                      </Divider>
                      
                      <Form.Item
                        label="Certificat client"
                        name="sslCert"
                      >
                        <TextArea
                          placeholder="-----BEGIN CERTIFICATE-----"
                          rows={3}
                        />
                      </Form.Item>

                      <Form.Item
                        label="Clé privée"
                        name="sslKey"
                      >
                        <TextArea
                          placeholder="-----BEGIN PRIVATE KEY-----"
                          rows={3}
                        />
                      </Form.Item>

                      <Form.Item
                        label="CA Certificate"
                        name="sslCa"
                      >
                        <TextArea
                          placeholder="-----BEGIN CERTIFICATE-----"
                          rows={3}
                        />
                      </Form.Item>
                    </>
                  );
                }}
              </Form.Item>
            </TabPane>
          </Tabs>
        </Form>
      </Spin>
    </Modal>
  );
};