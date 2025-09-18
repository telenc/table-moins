import React, { useState, useEffect, useRef } from 'react';
import { Button } from './components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './components/ui/card';
import { Input } from './components/ui/input';
import { Label } from './components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './components/ui/select';
import { Checkbox } from '../components/ui/checkbox';
import {
  Database,
  Plus,
  ArrowLeft,
  Server,
  TestTube,
  Link,
  AlertCircle,
  Loader2,
  XCircle,
} from 'lucide-react';
import { TabSystem, TabSystemRef } from './components/tabs/TabSystem';
import { useTabsStore } from './stores/tabs-store';
import { TabConnection } from '../database/connection-service';
import { DatabaseExplorer } from './components/database/DatabaseExplorer';
import { TableTabs, TableTabsRef } from './components/database/TableTabs';
import { RedisExplorer } from './components/redis/RedisExplorer';
import { RedisValueViewer } from './components/redis/RedisValueViewer';
import { ResizablePanels } from './components/ui/ResizablePanels';
import { parseConnectionUrl, isConnectionUrl } from './utils/connection-url-parser';
import { toast } from 'sonner';
import { UpdateNotification } from './components/ui/UpdateNotification';
import type {
  DatabaseConnection,
  ConnectionFormData,
  ConnectionTestResult,
} from './types/connections';
import { DATABASE_TYPES, DEFAULT_PORTS } from './types/connections';

export const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<
    'welcome' | 'connections' | 'new-connection' | 'database'
  >('connections');
  const { tabs, activeTabId, addTab, setActiveTab, removeTab } = useTabsStore();
  const [currentActiveTab, setCurrentActiveTab] = useState<TabConnection | null>(null);
  const tabSystemRef = useRef<TabSystemRef>(null);
  const [selectedRedisKey, setSelectedRedisKey] = useState<string | undefined>(undefined);

  // États pour la liste des connexions
  const [connections, setConnections] = useState<DatabaseConnection[]>([]);
  const [loadingConnections, setLoadingConnections] = useState(false);

  // Refs
  const tableTabsRef = useRef<TableTabsRef>(null);

  // États pour le formulaire de connexion
  const [connectionForm, setConnectionForm] = useState({
    name: '',
    type: '',
    host: '',
    port: '',
    database: '',
    username: '',
    password: '',
    ssl: false,
  });

  const [connectionUrl, setConnectionUrl] = useState('');
  const [urlParseError, setUrlParseError] = useState('');
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [isSavingConnection, setIsSavingConnection] = useState(false);
  const [editingConnection, setEditingConnection] = useState<string | null>(null);

  // Fonction pour parser l'URL et remplir le formulaire
  const handleUrlChange = (value: string) => {
    setConnectionUrl(value);
    setUrlParseError('');

    if (!value.trim()) {
      return;
    }

    if (isConnectionUrl(value)) {
      const parsedInfo = parseConnectionUrl(value);

      if (parsedInfo) {
        setConnectionForm({
          name: parsedInfo.name || '',
          type: parsedInfo.type,
          host: parsedInfo.host || '',
          port: parsedInfo.port || '',
          database: parsedInfo.database || '',
          username: parsedInfo.username || '',
          password: parsedInfo.password || '',
          ssl: parsedInfo.ssl || false,
        });
      } else {
        setUrlParseError('URL de connexion invalide');
      }
    } else {
      if (value.includes('://')) {
        setUrlParseError("Format d'URL non supporté");
      }
    }
  };

  // Fonction pour mettre à jour un champ du formulaire
  const updateFormField = (field: string, value: string | boolean) => {
    setConnectionForm(prev => ({ ...prev, [field]: value }));
  };

  // Charger les connexions depuis le backend
  const loadConnections = async () => {
    try {
      setLoadingConnections(true);
      const allConnections = await window.electronAPI.connections.getAll();
      setConnections(allConnections);
    } catch (error) {
      console.error('Error loading connections:', error);
      toast.error('Error loading connections');
    } finally {
      setLoadingConnections(false);
    }
  };

  // Tester une connexion
  const handleTestConnection = async () => {
    // Validation basique
    const isRedis = connectionForm.type === 'redis';
    if (!connectionForm.type || !connectionForm.host || (!connectionForm.username && !isRedis)) {
      toast.error(`Veuillez remplir les champs obligatoires (type, host${isRedis ? '' : ', utilisateur'})`);
      return;
    }

    setIsTestingConnection(true);
    try {
      const formData: ConnectionFormData = {
        name: connectionForm.name,
        type: connectionForm.type as DatabaseConnection['type'],
        host: connectionForm.host,
        port: parseInt(connectionForm.port) || DEFAULT_PORTS[connectionForm.type as keyof typeof DEFAULT_PORTS] || 3306,
        username: connectionForm.username || (isRedis ? 'default' : ''),
        password: connectionForm.password,
        database: connectionForm.database,
        ssl: connectionForm.ssl,
      };

      const result: ConnectionTestResult = await window.electronAPI.connections.test(formData);

      if (result.success) {
        toast.success('Connexion réussie !', {
          description: result.message,
        });
      } else {
        toast.error('Échec de la connexion', {
          description: result.message,
        });
      }
    } catch (error) {
      console.error('Erreur lors du test de connexion:', error);
      toast.error('Erreur lors du test de connexion');
    } finally {
      setIsTestingConnection(false);
    }
  };

  // Sauvegarder une connexion
  const handleSaveConnection = async () => {
    // Validation
    const isRedis = connectionForm.type === 'redis';
    if (
      !connectionForm.name.trim() ||
      !connectionForm.type ||
      !connectionForm.host ||
      (!connectionForm.username && !isRedis)
    ) {
      toast.error('Veuillez remplir tous les champs obligatoires');
      return;
    }

    setIsSavingConnection(true);
    try {
      const formData: ConnectionFormData = {
        name: connectionForm.name,
        type: connectionForm.type as DatabaseConnection['type'],
        host: connectionForm.host,
        port: parseInt(connectionForm.port) || DEFAULT_PORTS[connectionForm.type as keyof typeof DEFAULT_PORTS] || 3306,
        username: connectionForm.username || (isRedis ? 'default' : ''),
        password: connectionForm.password,
        database: connectionForm.database,
        ssl: connectionForm.ssl,
      };

      if (editingConnection) {
        await window.electronAPI.connections.update(editingConnection, formData);
        toast.success('Connexion mise à jour avec succès !');
      } else {
        await window.electronAPI.connections.create(formData);
        toast.success('Connexion sauvegardée avec succès !');
      }

      // Réinitialiser le formulaire et rediriger
      resetForm();

      // Charger les connexions puis rediriger
      await loadConnections();
      setCurrentView('connections');
    } catch (error) {
      console.error('Erreur lors de la sauvegarde:', error);
      toast.error('Erreur lors de la sauvegarde de la connexion');
    } finally {
      setIsSavingConnection(false);
    }
  };

  // Supprimer une connexion
  const handleDeleteConnection = async (id: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette connexion ?')) {
      return;
    }

    try {
      await window.electronAPI.connections.delete(id);
      toast.success('Connexion supprimée');
      loadConnections();
    } catch (error) {
      console.error('Erreur lors de la suppression:', error);
      toast.error('Erreur lors de la suppression');
    }
  };

  // Éditer une connexion
  const handleEditConnection = async (connection: DatabaseConnection) => {
    try {
      // Récupérer la connexion avec le mot de passe déchiffré
      const connectionForEdit = await window.electronAPI.connections.getForEdit(connection.id);

      if (connectionForEdit) {
        setConnectionForm({
          name: connectionForEdit.name,
          type: connectionForEdit.type,
          host: connectionForEdit.host,
          port: connectionForEdit.port.toString(),
          database: connectionForEdit.database || '',
          username: connectionForEdit.username,
          password: connectionForEdit.password, // Mot de passe déchiffré
          ssl: connectionForEdit.ssl,
        });
        setEditingConnection(connection.id);
        setCurrentView('new-connection');
      }
    } catch (error) {
      console.error('Error loading connection for edit:', error);
      toast.error('Error loading connection details');
    }
  };

  // Réinitialiser le formulaire
  const resetForm = () => {
    setConnectionForm({
      name: '',
      type: '',
      host: '',
      port: '',
      database: '',
      username: '',
      password: '',
      ssl: false,
    });
    setConnectionUrl('');
    setUrlParseError('');
    setEditingConnection(null);
  };

  // Handler pour charger une requête SQL depuis un fichier
  const handleQuerySelect = async (fileName: string, filePath: string) => {
    if (tableTabsRef.current) {
      tableTabsRef.current.loadQueryFile(fileName, filePath);
    }
  };

  // Charger les connexions et onglets au démarrage
  useEffect(() => {
    loadConnections();
    loadTabs();
  }, []);

  // Mettre à jour l'onglet actif quand l'ID change
  useEffect(() => {
    if (activeTabId) {
      const activeTab = tabs.find(tab => tab.id === activeTabId);
      setCurrentActiveTab(activeTab || null);
      if (activeTab) {
        setCurrentView('database');
      }
    } else {
      setCurrentActiveTab(null);
      setCurrentView('connections');
    }
  }, [activeTabId, tabs]);

  // Fermer l'onglet actif (pour Cmd+W)
  const closeActiveTab = async () => {
    // D'abord, essayer de fermer l'onglet de table actif
    if (tableTabsRef.current) {
      const tableTabClosed = tableTabsRef.current.closeActiveTableTab();
      if (tableTabClosed) {
        return; // Si on ferme un onglet de table, on s'arrête là
      }
    }
    
    // Sinon, fermer l'onglet de connexion si il n'y a pas d'onglet de table
    if (activeTabId) {
      try {
        await window.electronAPI.tabs.close(activeTabId);
        removeTab(activeTabId);
        setActiveTab(null);
        setCurrentView('connections');
      } catch (error) {
        console.error('Error closing active tab:', error);
      }
    }
  };

  // Écouter les événements Redis
  useEffect(() => {
    const handleRedisKeySelected = (event: CustomEvent) => {
      const { key } = event.detail;
      setSelectedRedisKey(key);
    };

    const handleRedisKeysUpdated = () => {
      // Clear selected key when keys are updated (e.g., after deletion)
      setSelectedRedisKey(undefined);
    };

    window.addEventListener('redis-key-selected', handleRedisKeySelected as any);
    window.addEventListener('redis-keys-updated', handleRedisKeysUpdated);

    return () => {
      window.removeEventListener('redis-key-selected', handleRedisKeySelected as any);
      window.removeEventListener('redis-keys-updated', handleRedisKeysUpdated);
    };
  }, []);

  // Écouter les actions du menu
  useEffect(() => {
    const handleMenuAction = (action: string) => {
      switch (action) {
        case 'close-tab':
          closeActiveTab();
          break;
        case 'search':
          // Ouvrir les filtres dans la table active
          if (tableTabsRef.current) {
            tableTabsRef.current.openFilter();
          }
          break;
        default:
          break;
      }
    };

    window.electronAPI.onMenuAction(handleMenuAction);

    // Cleanup lors du démontage du composant
    return () => {
      window.electronAPI.removeMenuActionListener();
    };
  }, [activeTabId]); // Dépendance sur activeTabId pour que la fonction soit à jour

  // Charger les onglets depuis le backend
  const loadTabs = async () => {
    try {
      const allTabs = await window.electronAPI.tabs.getAll();
      if (allTabs && allTabs.length > 0) {
        allTabs.forEach((tab: TabConnection) => {
          if (!tabs.find(existingTab => existingTab.id === tab.id)) {
            addTab(tab);
          }
        });
      }
    } catch (error) {
      console.error('Error loading tabs:', error);
    }
  };

  if (currentView === 'welcome') {
    return (
      <div className="h-screen flex items-center justify-center bg-gradient-to-br from-violet-500 to-purple-600">
        <Card className="w-full max-w-md bg-white/95 backdrop-blur shadow-2xl">
          <CardHeader className="text-center">
            <div className="mb-4">
              <img
                src="./assets/logo.jpg"
                alt="TableMoins Logo"
                className="w-16 h-16 mx-auto object-contain"
              />
            </div>
            <CardTitle className="text-3xl font-bold">TableMoins</CardTitle>
            <CardDescription className="text-lg">
              Clone moderne de TablePlus pour gérer vos bases de données
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              onClick={() => setCurrentView('connections')}
              className="w-full h-12 text-lg"
              size="lg"
            >
              <Database className="mr-2 h-5 w-5" />
              Gérer les connexions
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (currentView === 'new-connection') {
    return (
      <div className="h-screen bg-gray-50">
        <div className="border-b bg-white px-6 py-4 pt-8 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                resetForm();
                setCurrentView('connections');
              }}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Retour
            </Button>
            <h2 className="text-xl font-semibold">
              {editingConnection ? 'Modifier la connexion' : 'Nouvelle connexion'}
            </h2>
          </div>
        </div>

        <div className="p-6 max-w-2xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle>Configuration de la connexion</CardTitle>
              <CardDescription>Configurez les paramètres de votre base de données</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* URL de connexion complète */}
              <div className="space-y-2">
                <Label htmlFor="connection-url" className="flex items-center gap-2">
                  <Link className="h-4 w-4" />
                  URL de connexion complète (optionnel)
                </Label>
                <Input
                  id="connection-url"
                  placeholder="postgres://user:password@host:port/database"
                  value={connectionUrl}
                  onChange={e => handleUrlChange(e.target.value)}
                  className={urlParseError ? 'border-red-500' : ''}
                />
                {urlParseError && (
                  <div className="flex items-center gap-2 text-sm text-red-600">
                    <AlertCircle className="h-4 w-4" />
                    {urlParseError}
                  </div>
                )}
                <p className="text-xs text-gray-500">
                  Collez une URL complète pour remplir automatiquement les champs ci-dessous
                </p>
              </div>

              <div className="border-t pt-4 space-y-4">
                <h4 className="text-sm font-medium mb-4">
                  {editingConnection ? 'Modifier la connexion' : 'Configuration manuelle'}
                </h4>

                <div className="space-y-2">
                  <Label htmlFor="name">Nom de la connexion</Label>
                  <Input
                    id="name"
                    placeholder="Ma base de production"
                    value={connectionForm.name}
                    onChange={e => updateFormField('name', e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="type">Type de base de données</Label>
                  <Select
                    value={connectionForm.type}
                    onValueChange={value => updateFormField('type', value)}
                  >
                    <SelectTrigger id="type">
                      <SelectValue placeholder="Sélectionnez un type" />
                    </SelectTrigger>
                    <SelectContent>
                      {DATABASE_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          <span className="flex items-center gap-2">
                            <span>{type.icon}</span>
                            {type.label}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="host">Hôte</Label>
                    <Input
                      id="host"
                      placeholder="localhost"
                      value={connectionForm.host}
                      onChange={e => updateFormField('host', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="port">Port</Label>
                    <Input
                      id="port"
                      placeholder="3306"
                      value={connectionForm.port}
                      onChange={e => updateFormField('port', e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="database">Base de données</Label>
                  <Input
                    id="database"
                    placeholder="ma_base"
                    value={connectionForm.database}
                    onChange={e => updateFormField('database', e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="username">Utilisateur</Label>
                    <Input
                      id="username"
                      placeholder="root"
                      value={connectionForm.username}
                      onChange={e => updateFormField('username', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Mot de passe</Label>
                    <Input
                      id="password"
                      type="password"
                      placeholder="••••••••"
                      value={connectionForm.password}
                      onChange={e => updateFormField('password', e.target.value)}
                    />
                  </div>
                </div>

                {/* Option SSL */}
                <div className="flex items-center space-x-2 pt-2">
                  <Checkbox
                    id="ssl"
                    checked={connectionForm.ssl}
                    onCheckedChange={checked => updateFormField('ssl', checked)}
                  />
                  <Label
                    htmlFor="ssl"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    Utiliser SSL/TLS
                  </Label>
                  {connectionForm.host?.includes('azure.com') && (
                    <span className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded">
                      Recommandé pour Azure
                    </span>
                  )}
                </div>

                <div className="flex gap-2 pt-4">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={handleTestConnection}
                    disabled={
                      isTestingConnection ||
                      !connectionForm.type ||
                      !connectionForm.host ||
                      (!connectionForm.username && connectionForm.type !== 'redis')
                    }
                  >
                    {isTestingConnection ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <TestTube className="h-4 w-4 mr-2" />
                    )}
                    {isTestingConnection ? 'Test en cours...' : 'Tester la connexion'}
                  </Button>
                  <Button
                    className="flex-1"
                    onClick={handleSaveConnection}
                    disabled={
                      isSavingConnection ||
                      !connectionForm.name.trim() ||
                      !connectionForm.type ||
                      !connectionForm.host ||
                      (!connectionForm.username && connectionForm.type !== 'redis')
                    }
                  >
                    {isSavingConnection ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                    {isSavingConnection
                      ? 'Sauvegarde...'
                      : editingConnection
                        ? 'Mettre à jour'
                        : 'Sauvegarder'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Rendu du contenu principal basé sur la vue active
  const renderMainContent = () => {
    if (currentView === 'connections') {
      return (
        <div className="flex-1 p-6">
          {loadingConnections ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
                <p className="text-gray-500">Loading connections...</p>
              </div>
            </div>
          ) : connections.length === 0 ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center text-gray-500">
                <Server className="h-16 w-16 mx-auto mb-4 text-gray-300" />
                <h3 className="text-lg font-medium mb-2">No connections configured</h3>
                <p className="text-sm mb-4">Start by adding a connection to your database.</p>
                <Button
                  onClick={() => {
                    resetForm();
                    setCurrentView('new-connection');
                  }}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add connection
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-2 max-w-md mx-auto">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Connections</h2>
                <Button
                  onClick={() => {
                    resetForm();
                    setCurrentView('new-connection');
                  }}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  New connection
                </Button>
              </div>
              {connections.map(connection => (
                <div
                  key={connection.id}
                  className="p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-all duration-200 ease-in-out bg-white shadow-sm hover:shadow-md transform hover:scale-105"
                  onDoubleClick={async () => {
                    try {
                      const tabId = await window.electronAPI.connections.connect(connection.id);

                      // Créer l'onglet d'abord
                      const newTab: TabConnection = {
                        id: tabId,
                        connectionId: connection.id,
                        connection,
                        isConnected: false,
                      };

                      addTab(newTab);
                      setActiveTab(tabId);

                      // Ensuite connecter automatiquement
                      try {
                        await window.electronAPI.tabs.connect(tabId);

                        // Mettre à jour l'état de connexion
                        const updatedTab = {
                          ...newTab,
                          isConnected: true,
                        };

                        // Mettre à jour le tab dans le store
                        useTabsStore.getState().updateTab(tabId, updatedTab);

                        toast.success(`Connected to ${connection.name}`);
                      } catch (connectError) {
                        console.error('Error connecting to database:', connectError);
                        toast.warning(`Tab created but could not connect to ${connection.name}`);
                      }

                      if (tabSystemRef.current) {
                        await tabSystemRef.current.reloadTabs();
                      }
                    } catch (error) {
                      console.error('Error creating tab:', error);
                      toast.error(`Failed to create tab for ${connection.name}`);
                    }
                  }}
                  onContextMenu={e => {
                    e.preventDefault();
                    const menu = document.createElement('div');
                    menu.className = 'fixed bg-white border rounded-lg shadow-lg z-50 min-w-32';
                    menu.style.left = e.pageX + 'px';
                    menu.style.top = e.pageY + 'px';

                    const editBtn = document.createElement('div');
                    editBtn.className =
                      'px-3 py-2 hover:bg-gray-100 cursor-pointer text-sm flex items-center gap-2';
                    editBtn.innerHTML = '<span>✏️</span>Edit';
                    editBtn.onclick = () => {
                      handleEditConnection(connection);
                      document.body.removeChild(menu);
                    };

                    const deleteBtn = document.createElement('div');
                    deleteBtn.className =
                      'px-3 py-2 hover:bg-gray-100 cursor-pointer text-sm flex items-center gap-2 text-red-600';
                    deleteBtn.innerHTML = '<span>🗑️</span>Delete';
                    deleteBtn.onclick = () => {
                      handleDeleteConnection(connection.id);
                      document.body.removeChild(menu);
                    };

                    menu.appendChild(editBtn);
                    menu.appendChild(deleteBtn);
                    document.body.appendChild(menu);

                    const closeMenu = () => {
                      if (document.body.contains(menu)) {
                        document.body.removeChild(menu);
                      }
                      document.removeEventListener('click', closeMenu);
                    };
                    setTimeout(() => document.addEventListener('click', closeMenu), 100);
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded flex items-center justify-center">
                      {connection.type === 'postgresql' && (
                        <img
                          src="/assets/postgress.jpg"
                          alt="PostgreSQL"
                          className="w-6 h-6 rounded object-cover"
                          onError={e => {
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                            target.parentElement!.innerHTML =
                              '<div class="w-6 h-6 rounded bg-blue-500 flex items-center justify-center text-white text-xs font-bold">PG</div>';
                          }}
                        />
                      )}
                      {connection.type === 'redis' && (
                        <img
                          src="/assets/redis.svg"
                          alt="Redis"
                          className="w-6 h-6 rounded object-cover"
                          onError={e => {
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                            target.parentElement!.innerHTML =
                              '<div class="w-6 h-6 rounded bg-red-500 flex items-center justify-center text-white text-xs font-bold">RD</div>';
                          }}
                        />
                      )}
                      {connection.type === 'mysql' && (
                        <div className="w-6 h-6 rounded bg-orange-500 flex items-center justify-center text-white text-xs font-bold">
                          My
                        </div>
                      )}
                      {connection.type === 'sqlite' && (
                        <div className="w-6 h-6 rounded bg-blue-600 flex items-center justify-center text-white text-xs font-bold">
                          SQL
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900 truncate">
                          {connection.name}
                        </span>
                      </div>
                      <div className="text-sm text-gray-500 truncate">
                        {connection.host}:{connection.port}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    } else if (currentView === 'database') {
      // Vérifier si c'est Redis ou SQL
      const isRedisConnection = currentActiveTab?.connection?.type === 'redis';

      if (isRedisConnection) {
        // Interface Redis with resizable panels
        return (
          <ResizablePanels
            className="flex-1"
            defaultLeftWidth={256}
            minLeftWidth={200}
            maxLeftWidth={600}
          >
            <RedisExplorer
              activeTab={currentActiveTab}
              onKeySelect={(key) => setSelectedRedisKey(key)}
            />
            <RedisValueViewer
              activeTab={currentActiveTab}
              selectedKey={selectedRedisKey}
            />
          </ResizablePanels>
        );
      } else {
        // Interface SQL (PostgreSQL, MySQL, etc.)
        return (
          <div className="flex-1 flex h-full">
            <div className="w-64 border-r bg-white flex flex-col h-full">
              <DatabaseExplorer
                activeTab={currentActiveTab}
                onTableSelect={() => {}}
                onQuerySelect={handleQuerySelect}
              />
            </div>

            <div className="flex-1 min-w-0">
              <TableTabs ref={tableTabsRef} activeTab={currentActiveTab} />
            </div>
          </div>
        );
      }
    }
    return null;
  };

  // Gestion du changement d'onglet
  const handleTabChange = (tabId: string | null) => {
    if (tabId) {
      setActiveTab(tabId);
    } else {
      setCurrentView('connections');
    }
  };

  return (
    <div className="h-screen bg-gray-50 flex flex-col">
      {/* Global TabBar */}
      <div className="flex items-center bg-white border-b border-gray-200 pl-20">
        {/* Plus button on the left - goes to connections page */}
        <button
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-r border-gray-200 hover:bg-gray-50 transition-all duration-200 ease-in-out transform hover:scale-105 ${
            currentView === 'connections' ? 'bg-gray-100 text-blue-600 shadow-sm' : 'text-gray-600'
          }`}
          onClick={() => setCurrentView('connections')}
          title="Connections"
        >
          <Plus className="h-4 w-4" />
          Connections
        </button>

        {/* Database tabs on the right */}
        <div className="flex-1 flex overflow-x-auto">
          {tabs.map(tab => (
            <div
              key={tab.id}
              className={`flex items-center gap-2 border-r border-gray-200 whitespace-nowrap transition-all duration-300 ease-in-out transform hover:scale-105 ${
                activeTabId === tab.id ? 'bg-blue-50 shadow-sm' : 'hover:bg-gray-50'
              }`}
            >
              {/* Main tab button */}
              <button
                className={`flex items-center gap-2 px-4 py-2 text-sm font-medium hover:bg-gray-50 transition-colors flex-1 ${
                  activeTabId === tab.id ? 'text-blue-600' : 'text-gray-600'
                }`}
                onClick={() => handleTabChange(tab.id)}
                title={`${tab.connection.name} - ${tab.connection.host}:${tab.connection.port}`}
              >
                <div className="w-3 h-3 rounded flex items-center justify-center">
                  {tab.connection.type === 'postgresql' && (
                    <img
                      src="/assets/postgress.jpg"
                      alt="PostgreSQL"
                      className="w-3 h-3 rounded object-cover"
                      onError={e => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                        target.parentElement!.innerHTML =
                          '<div class="w-3 h-3 rounded bg-blue-500 flex items-center justify-center text-white text-xs font-bold">P</div>';
                      }}
                    />
                  )}
                  {tab.connection.type === 'redis' && (
                    <img
                      src="/assets/redis.svg"
                      alt="Redis"
                      className="w-3 h-3 rounded object-cover"
                      onError={e => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                        target.parentElement!.innerHTML =
                          '<div class="w-3 h-3 rounded bg-red-500 flex items-center justify-center text-white text-xs font-bold">R</div>';
                      }}
                    />
                  )}
                  {tab.connection.type === 'mysql' && (
                    <div className="w-3 h-3 rounded bg-orange-500 flex items-center justify-center text-white text-xs font-bold">
                      M
                    </div>
                  )}
                  {tab.connection.type === 'sqlite' && (
                    <div className="w-3 h-3 rounded bg-blue-600 flex items-center justify-center text-white text-xs font-bold">
                      S
                    </div>
                  )}
                </div>
                <span className="truncate max-w-32">{tab.connection.name}</span>
              </button>

              {/* Close button - separate from main button */}
              <button
                className="mr-2 p-1 hover:bg-red-100 rounded text-gray-400 hover:text-red-600 transition-all duration-200 ease-in-out transform hover:scale-110"
                onClick={async e => {
                  e.stopPropagation();
                  try {
                    await window.electronAPI.tabs.close(tab.id);

                    // Supprimer l'onglet du store local
                    removeTab(tab.id);

                    // Si c'était l'onglet actif, retourner aux connexions
                    if (activeTabId === tab.id) {
                      setActiveTab(null);
                      setCurrentView('connections');
                    }

                    // Recharger les onglets pour synchroniser avec le backend
                    if (tabSystemRef.current) {
                      await tabSystemRef.current.reloadTabs();
                    }
                  } catch (error) {
                    console.error('Error closing tab:', error);
                  }
                }}
                title="Close tab"
              >
                <XCircle className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>

        {/* New connection button on the far right */}
        <button
          className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors border-l border-gray-200"
          onClick={() => {
            resetForm();
            setCurrentView('new-connection');
          }}
          title="New connection"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      {/* Hidden TabSystem for backend synchronization */}
      <TabSystem ref={tabSystemRef} onTabChange={handleTabChange} hideUI={true} />

      {/* Main content area */}
      <div className="flex-1 transition-all duration-300 ease-in-out overflow-hidden">
        <div className="animate-fadeIn h-full">{renderMainContent()}</div>
      </div>

      {/* Auto-updater notification */}
      <UpdateNotification currentView={currentView} />
    </div>
  );
};
