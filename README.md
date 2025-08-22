# 🗃️ TableMoins

**Application desktop moderne de gestion de bases de données SQL**

TableMoins est un clone open-source de TablePlus, développé avec Electron, React et TypeScript. Il offre une interface intuitive pour gérer vos bases de données MySQL et PostgreSQL.

## ✨ Fonctionnalités

### 🚀 Version Actuelle (MVP)
- ✅ Interface utilisateur moderne avec Ant Design
- ✅ Architecture Electron + React + TypeScript
- ✅ Système de logging intégré
- ✅ Gestion des thèmes (clair/sombre)
- ✅ Configuration ESLint + Prettier

### 🔄 En Développement
- 🔌 Gestion des connexions de bases de données
- 🗂️ Explorateur de structure de bases
- 📊 Visualiseur de données avec pagination
- ✏️ Éditeur SQL avec coloration syntaxique
- 🔍 Recherche et filtrage avancés

### 🎯 Roadmap
- 📤 Import/Export (CSV, JSON, SQL)
- 🛡️ Sécurité et chiffrement des connexions
- ⚡ Optimisations de performance
- 🔌 Système de plugins extensible
- 🏢 Fonctionnalités entreprise

## 🛠️ Technologies

- **Desktop Framework**: Electron 28+
- **Frontend**: React 18+ avec TypeScript
- **UI Library**: Ant Design
- **State Management**: Zustand
- **Database Drivers**: mysql2, pg, better-sqlite3
- **Build Tool**: Vite
- **Testing**: Jest + Playwright

## 🚀 Installation & Développement

### Prérequis
- Node.js 18+ 
- npm 8+

### Installation
```bash
# Cloner le repository
git clone <repository-url>
cd TableMoins

# Installer les dépendances
npm install

# Copier les variables d'environnement
cp .env.example .env
```

### Développement
```bash
# Démarrer en mode développement
npm run dev

# Build pour production
npm run build

# Lancer les tests
npm test

# Linter et formatage
npm run lint
npm run format
```

### Scripts disponibles

| Script | Description |
|--------|-------------|
| `npm run dev` | Développement avec hot reload |
| `npm run build` | Build de production |
| `npm run build:all` | Build + packaging Electron |
| `npm test` | Tests unitaires |
| `npm test:e2e` | Tests end-to-end |
| `npm run lint` | Linting ESLint |
| `npm run format` | Formatage Prettier |

## 📁 Structure du Projet

```
src/
├── main/                    # Electron main process
│   ├── main.ts             # Point d'entrée principal
│   ├── menu.ts             # Menu de l'application
│   └── ipc-handlers.ts     # Gestionnaires IPC
├── renderer/               # Electron renderer process  
│   ├── components/         # Composants React
│   ├── pages/             # Pages de l'application
│   ├── stores/            # State management (Zustand)
│   ├── styles/            # Styles CSS
│   └── main.tsx           # Point d'entrée React
├── shared/                # Code partagé
│   ├── types/             # Types TypeScript
│   ├── constants/         # Constantes
│   └── utils/             # Utilitaires
└── database/              # Gestion des bases de données
    ├── drivers/           # Drivers MySQL/PostgreSQL
    └── models/            # Modèles de données
```

## 🎨 Interface Utilisateur

L'interface est construite avec Ant Design et suit les principes de Material Design. Elle comprend :

- **Sidebar** : Navigation et gestion des connexions
- **Zone principale** : Visualisation des données et éditeur SQL
- **Barre d'outils** : Actions rapides et paramètres
- **Panneaux modulaires** : Redimensionnables et personnalisables

## 🔒 Sécurité

- Chiffrement AES-256 pour les mots de passe
- Support SSL/TLS pour les connexions distantes
- Validation stricte des entrées utilisateur
- Audit trail des actions sensibles

## 🤝 Contribution

Les contributions sont les bienvenues ! Veuillez :

1. Forker le projet
2. Créer une branche pour votre fonctionnalité
3. Commiter vos changements
4. Pousser vers la branche
5. Ouvrir une Pull Request

### Guidelines de développement

- Respecter les conventions TypeScript
- Écrire des tests pour les nouvelles fonctionnalités  
- Suivre les patterns établis
- Maintenir une couverture de tests > 80%

## 📄 Licence

MIT License - voir le fichier [LICENSE](LICENSE) pour plus de détails.

## 🙏 Remerciements

Inspiré par TablePlus et développé avec passion pour la communauté open-source.

---

**Développé avec ❤️ par l'équipe TableMoins**