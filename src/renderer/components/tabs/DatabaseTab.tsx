import React from 'react';
import { TabConnection } from '../../../database/connection-service';

interface DatabaseTabProps {
  tab: TabConnection;
  isActive: boolean;
  onSelect: () => void;
  onClose: () => void;
  onConnect: () => void;
  onDisconnect: () => void;
}

export const DatabaseTab: React.FC<DatabaseTabProps> = ({
  tab,
  isActive,
  onSelect,
  onClose,
  onConnect,
  onDisconnect
}) => {
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    
    // Créer un menu contextuel simple
    const menu = document.createElement('div');
    menu.className = 'fixed bg-white border border-gray-200 rounded shadow-lg py-1 z-50';
    menu.style.left = `${e.clientX}px`;
    menu.style.top = `${e.clientY}px`;
    
    const menuItems = [
      {
        label: tab.isConnected ? 'Disconnect' : 'Connect',
        action: tab.isConnected ? onDisconnect : onConnect
      },
      { label: 'Close Tab', action: onClose }
    ];
    
    menuItems.forEach(item => {
      const menuItem = document.createElement('button');
      menuItem.className = 'block w-full px-4 py-2 text-left hover:bg-gray-100 text-sm';
      menuItem.textContent = item.label;
      menuItem.onclick = () => {
        item.action();
        menu.remove();
      };
      menu.appendChild(menuItem);
    });
    
    document.body.appendChild(menu);
    
    // Fermer le menu si on clique ailleurs
    const handleClickOutside = (e: MouseEvent) => {
      if (!menu.contains(e.target as Node)) {
        menu.remove();
        document.removeEventListener('click', handleClickOutside);
      }
    };
    
    setTimeout(() => document.addEventListener('click', handleClickOutside), 0);
  };

  const getConnectionIcon = () => {
    const type = tab.connection.type;
    switch (type) {
      case 'postgresql':
        return (
          <img 
            src="/assets/postgress.jpg" 
            alt="PostgreSQL" 
            className="w-4 h-4 rounded"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        );
      case 'mysql':
        return (
          <div className="w-4 h-4 bg-orange-500 rounded flex items-center justify-center">
            <span className="text-white text-xs font-bold">M</span>
          </div>
        );
      case 'sqlite':
        return (
          <div className="w-4 h-4 bg-blue-500 rounded flex items-center justify-center">
            <span className="text-white text-xs font-bold">S</span>
          </div>
        );
      default:
        return (
          <div className="w-4 h-4 bg-gray-500 rounded flex items-center justify-center">
            <span className="text-white text-xs font-bold">?</span>
          </div>
        );
    }
  };

  const getStatusIndicator = () => {
    if (tab.isConnected) {
      return <div className="w-2 h-2 bg-green-500 rounded-full" title="Connected" />;
    }
    return <div className="w-2 h-2 bg-gray-400 rounded-full" title="Disconnected" />;
  };

  return (
    <div
      className={`
        flex items-center px-3 py-2 cursor-pointer border-r border-gray-200
        ${isActive 
          ? 'bg-white border-b-2 border-b-blue-500' 
          : 'hover:bg-gray-100'
        }
      `}
      onClick={onSelect}
      onContextMenu={handleContextMenu}
      title={`${tab.connection.name} (${tab.connection.host}:${tab.connection.port})`}
    >
      {/* Icône de la base de données */}
      <div className="mr-2">
        {getConnectionIcon()}
      </div>
      
      {/* Nom de la connexion */}
      <span className="text-sm font-medium text-gray-700 max-w-32 truncate">
        {tab.connection.name}
      </span>
      
      {/* Indicateur de statut */}
      <div className="ml-2">
        {getStatusIndicator()}
      </div>
      
      {/* Bouton de fermeture */}
      <button
        className="ml-2 p-0.5 hover:bg-gray-200 rounded text-gray-400 hover:text-gray-600"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        title="Close tab"
      >
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
};