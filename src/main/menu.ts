import { Menu, MenuItemConstructorOptions, BrowserWindow, app, dialog } from 'electron';
import { isDev } from '../shared/utils/environment';

export function createMenu(mainWindow: BrowserWindow | null): Menu {
  const isMac = process.platform === 'darwin';

  const template: MenuItemConstructorOptions[] = [
    // Menu Application (macOS)
    ...(isMac
      ? [
          {
            label: app.getName(),
            submenu: [
              { label: 'À propos de TableMoins', role: 'about' as const },
              { type: 'separator' as const },
              { label: 'Préférences...', accelerator: 'CmdOrCtrl+,', click: () => showPreferences() },
              { type: 'separator' as const },
              { label: 'Services', role: 'services' as const },
              { type: 'separator' as const },
              { label: 'Masquer TableMoins', role: 'hide' as const },
              { label: 'Masquer les autres', role: 'hideOthers' as const },
              { label: 'Tout afficher', role: 'unhide' as const },
              { type: 'separator' as const },
              { label: 'Quitter', role: 'quit' as const },
            ],
          },
        ]
      : []),

    // Menu Fichier
    {
      label: 'Fichier',
      submenu: [
        {
          label: 'Nouvelle connexion',
          accelerator: 'CmdOrCtrl+N',
          click: () => sendToRenderer('new-connection'),
        },
        {
          label: 'Ouvrir connexion...',
          accelerator: 'CmdOrCtrl+O',
          click: () => sendToRenderer('open-connection'),
        },
        { type: 'separator' },
        {
          label: 'Importer...',
          accelerator: 'CmdOrCtrl+I',
          click: () => sendToRenderer('import-data'),
        },
        {
          label: 'Exporter...',
          accelerator: 'CmdOrCtrl+E',
          click: () => sendToRenderer('export-data'),
        },
        { type: 'separator' },
        ...(isMac
          ? [
              { label: 'Fermer la fenêtre', role: 'close' as const },
            ]
          : [
              { label: 'Préférences...', accelerator: 'CmdOrCtrl+,', click: () => showPreferences() },
              { type: 'separator' as const },
              { label: 'Quitter', role: 'quit' as const },
            ]),
      ],
    },

    // Menu Edition
    {
      label: 'Edition',
      submenu: [
        { label: 'Annuler', role: 'undo' },
        { label: 'Rétablir', role: 'redo' },
        { type: 'separator' },
        { label: 'Couper', role: 'cut' },
        { label: 'Copier', role: 'copy' },
        { label: 'Coller', role: 'paste' },
        { label: 'Sélectionner tout', role: 'selectAll' },
        { type: 'separator' },
        {
          label: 'Rechercher...',
          accelerator: 'CmdOrCtrl+F',
          click: () => sendToRenderer('search'),
        },
        {
          label: 'Rechercher et remplacer...',
          accelerator: 'CmdOrCtrl+H',
          click: () => sendToRenderer('search-replace'),
        },
      ],
    },

    // Menu Affichage
    {
      label: 'Affichage',
      submenu: [
        { label: 'Recharger', role: 'reload' },
        { label: 'Forcer le rechargement', role: 'forceReload' },
        { label: 'Outils de développement', role: 'toggleDevTools' },
        { type: 'separator' },
        { label: 'Taille réelle', role: 'resetZoom' },
        { label: 'Agrandir', role: 'zoomIn' },
        { label: 'Réduire', role: 'zoomOut' },
        { type: 'separator' },
        { label: 'Plein écran', role: 'togglefullscreen' },
        { type: 'separator' },
        {
          label: 'Basculer thème',
          accelerator: 'CmdOrCtrl+T',
          click: () => sendToRenderer('toggle-theme'),
        },
        {
          label: 'Afficher/Masquer sidebar',
          accelerator: 'CmdOrCtrl+Shift+E',
          click: () => sendToRenderer('toggle-sidebar'),
        },
      ],
    },

    // Menu Base de données
    {
      label: 'Base de données',
      submenu: [
        {
          label: 'Exécuter la requête',
          accelerator: 'CmdOrCtrl+R',
          click: () => sendToRenderer('execute-query'),
        },
        {
          label: 'Exécuter la sélection',
          accelerator: 'CmdOrCtrl+Shift+R',
          click: () => sendToRenderer('execute-selection'),
        },
        { type: 'separator' },
        {
          label: 'Actualiser',
          accelerator: 'F5',
          click: () => sendToRenderer('refresh-database'),
        },
        {
          label: 'Déconnecter',
          click: () => sendToRenderer('disconnect'),
        },
        { type: 'separator' },
        {
          label: 'Informations sur la base',
          click: () => sendToRenderer('database-info'),
        },
      ],
    },

    // Menu Fenêtre
    {
      label: 'Fenêtre',
      submenu: [
        { label: 'Réduire', role: 'minimize' },
        ...(isMac
          ? [
              { type: 'separator' as const },
              { label: 'Placer au premier plan', role: 'front' as const },
              { type: 'separator' as const },
              { label: 'TableMoins', role: 'window' as const },
            ]
          : [
              { label: 'Fermer', role: 'close' as const },
            ]),
      ],
    },

    // Menu Aide
    {
      label: 'Aide',
      submenu: [
        {
          label: 'Documentation',
          click: () => sendToRenderer('show-documentation'),
        },
        {
          label: 'Raccourcis clavier',
          accelerator: 'CmdOrCtrl+/',
          click: () => sendToRenderer('show-shortcuts'),
        },
        { type: 'separator' },
        {
          label: 'Signaler un problème',
          click: () => sendToRenderer('report-issue'),
        },
        ...(!isMac
          ? [
              { type: 'separator' as const },
              {
                label: 'À propos',
                click: () => showAbout(),
              },
            ]
          : []),
      ],
    },
  ];

  // Supprimer les éléments vides en mode développement
  if (isDev) {
    template.push({
      label: 'Développement',
      submenu: [
        { label: 'Outils de développement', role: 'toggleDevTools' },
        { label: 'Recharger', role: 'reload' },
        { label: 'Forcer le rechargement', role: 'forceReload' },
      ],
    });
  }

  return Menu.buildFromTemplate(template);

  // Fonctions utilitaires
  function sendToRenderer(action: string): void {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('menu-action', action);
    }
  }

  function showPreferences(): void {
    sendToRenderer('show-preferences');
  }

  function showAbout(): void {
    dialog.showMessageBox(mainWindow!, {
      type: 'info',
      title: 'À propos de TableMoins',
      message: 'TableMoins',
      detail: `Version: ${app.getVersion()}\nElectron: ${process.versions.electron}\nNode.js: ${process.versions.node}`,
      buttons: ['OK'],
    });
  }
}