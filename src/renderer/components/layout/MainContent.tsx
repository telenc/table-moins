import React from 'react';
import { useNavigationStore } from '../../stores/navigation-store';
import { ConnectionForm } from '../connections/ConnectionForm';
import { useConnectionsStore } from '../../stores/connections-store';
import { HomePage } from '../../pages/HomePage';
import { ConnectionsPage } from '../../pages/ConnectionsPage';

export const MainContent: React.FC = () => {
  const { currentRoute } = useNavigationStore();
  const { isConnectionFormOpen, closeConnectionForm } = useConnectionsStore();

  const renderContent = () => {
    switch (currentRoute) {
      case 'connections':
        return <ConnectionsPage />;
      case 'database-explorer':
        return <div>Explorateur de bases de données (à venir)</div>;
      case 'query-editor':
        return <div>Éditeur de requêtes (à venir)</div>;
      default:
        return <HomePage />;
    }
  };

  return (
    <>
      {renderContent()}
      
      {/* Modal de connexion global */}
      <ConnectionForm
        visible={isConnectionFormOpen}
        onCancel={closeConnectionForm}
      />
    </>
  );
};