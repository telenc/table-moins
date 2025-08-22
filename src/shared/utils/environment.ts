// Charger les variables d'environnement depuis le fichier .env
import { join } from 'path';
import { readFileSync, existsSync } from 'fs';

// Charger automatiquement le fichier .env depuis la racine du projet
try {
  const envPath = join(__dirname, '../../../.env');
  if (existsSync(envPath)) {
    const envContent = readFileSync(envPath, 'utf-8');

    envContent.split('\n').forEach(line => {
      const trimmedLine = line.trim();
      if (trimmedLine && !trimmedLine.startsWith('#')) {
        const [key, ...valueParts] = trimmedLine.split('=');
        if (key && valueParts.length > 0) {
          const value = valueParts.join('=').replace(/^['"]|['"]$/g, '');
          // Ne pas écraser les variables déjà définies
          if (!process.env[key.trim()]) {
            process.env[key.trim()] = value.trim();
          }
        }
      }
    });
  }
} catch (error) {
  // Le fichier .env est optionnel, ne pas faire planter l'app
  console.warn('Erreur lors du chargement du fichier .env:', error);
}

export const isDev =
  process.env.NODE_ENV === 'development' || process.env.ELECTRON_IS_DEV === 'true';
export const isProd = process.env.NODE_ENV === 'production';

export const APP_CONFIG = {
  name: 'TableMoins',
  version: process.env.npm_package_version || '0.1.0',
  isDev,
  isProd,
} as const;

export const DATABASE_CONFIG = {
  connectionTimeout: 30000, // 30 secondes
  queryTimeout: 60000, // 1 minute
  maxConnections: 10,
  retryAttempts: 3,
  retryDelay: 1000, // 1 seconde
} as const;

export const UI_CONFIG = {
  defaultTheme: 'light' as const,
  pageSize: 100,
  maxPageSize: 1000,
  debounceDelay: 300, // ms
} as const;
