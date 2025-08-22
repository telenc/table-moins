/**
 * Interface pour les informations de connexion parsées
 */
// types.ts
export interface HostPort {
  host: string;
  port: string; // garder en string pour rester fidèle à l'URL
}

type DbType = 'postgresql' | 'mysql' | 'mariadb' | 'mssql' | 'mongodb' | 'redis' | 'sqlite';

export interface ParsedConnectionInfo {
  name: string;
  type: DbType;
  host?: string;
  port?: string;
  hosts?: { host: string; port: string }[];
  database?: string;
  username?: string;
  password?: string;
  options?: Record<string, string>;
  ssl?: boolean;
}

const PROTOCOL_MAP: Record<string, DbType> = {
  'postgres:': 'postgresql',
  'postgresql:': 'postgresql',
  'mysql:': 'mysql',
  'mysql2:': 'mysql',
  'mariadb:': 'mariadb',
  'mssql:': 'mssql',
  'sqlserver:': 'mssql',
  'mongodb:': 'mongodb',
  'mongodb+srv:': 'mongodb',
  'redis:': 'redis',
  'rediss:': 'redis',
  'sqlite:': 'sqlite',
  'file:': 'sqlite',
};

const DEFAULT_PORT: Record<DbType, string> = {
  postgresql: '5432',
  mysql: '3306',
  mariadb: '3306',
  mssql: '1433',
  mongodb: '27017',
  redis: '6379',
  sqlite: '',
};

const SPECIAL_SCHEMES = new Set(['http:', 'https:', 'ws:', 'wss:', 'ftp:']);

function parseQS(q: string) {
  const out: Record<string, string> = {};
  if (!q) return out;
  const sp = new URLSearchParams(q.startsWith('?') ? q.slice(1) : q);
  for (const [k, v] of sp.entries()) out[k] = v;
  return out;
}

function splitHosts(raw: string) {
  // gère IPv6 [::] et les virgules (mongo)
  const res: string[] = [];
  let buf = '';
  let b = 0;
  for (const ch of raw) {
    if (ch === '[') b++;
    if (ch === ']') b--;
    if (ch === ',' && b === 0) {
      res.push(buf);
      buf = '';
    } else buf += ch;
  }
  if (buf) res.push(buf);

  return res.map(p => {
    p = p.trim();
    if (p.startsWith('[')) {
      const m = p.match(/^\[([^\]]+)\](?::(\d+))?$/);
      return { host: m?.[1] ?? '', port: m?.[2] ?? '' };
    }
    const i = p.lastIndexOf(':');
    if (i > -1 && p.indexOf(':') === i) {
      return { host: p.slice(0, i), port: p.slice(i + 1) };
    }
    return { host: p, port: '' };
  });
}

function normalizeName(
  type: DbType,
  hosts: { host: string; port: string }[] | undefined,
  db: string | undefined,
  qs: Record<string, string>
) {
  const hostPart =
    hosts && hosts.length
      ? hosts.map(h => (h.port ? `${h.host}:${h.port}` : h.host)).join(',')
      : '';
  const path = type === 'sqlite' ? (db ?? '') : `/${db ?? ''}`;
  const q = new URLSearchParams(qs).toString();
  return `${type}://${hostPart}${path}${q ? `?${q}` : ''}`;
}

export function parseConnectionUrl(urlString: string): ParsedConnectionInfo | null {
  try {
    if (!urlString || typeof urlString !== 'string') return null;
    const clean = urlString.trim();
    if (!clean.includes('://') && !clean.startsWith('file:')) return null;

    // protocole brut
    const protoMatch = clean.match(/^([a-zA-Z0-9+.-]+:)/);
    if (!protoMatch) return null;
    const rawProto = protoMatch[1].toLowerCase();
    const type = PROTOCOL_MAP[rawProto];
    if (!type) return null;

    // SQLite / file: -> chemin de fichier
    if (type === 'sqlite') {
      const u = new URL(clean);
      const dbPath = u.protocol === 'file:' ? u.pathname : clean.replace(/^sqlite:\/\//i, '');
      const options = parseQS(u.search);
      return {
        name: normalizeName(type, undefined, dbPath, options),
        type,
        database: dbPath,
        options,
        ssl: false,
      };
    }

    // Mongo multi-hosts (ou +srv) : parsing manuel de l'authority
    if (rawProto === 'mongodb+srv:' || clean.includes(',')) {
      const s = clean.replace(/^[a-zA-Z0-9+.-]+:\/\//, '');
      const at = s.indexOf('@');
      const credPart = at >= 0 ? s.slice(0, at) : '';
      const rest = at >= 0 ? s.slice(at + 1) : s;

      const slash = rest.indexOf('/');
      const hostsPart = slash >= 0 ? rest.slice(0, slash) : rest;
      const pathAndQuery = slash >= 0 ? rest.slice(slash) : '';
      const qIdx = pathAndQuery.indexOf('?');
      const pathOnly = qIdx >= 0 ? pathAndQuery.slice(0, qIdx) : pathAndQuery;
      const queryOnly = qIdx >= 0 ? pathAndQuery.slice(qIdx + 1) : '';

      const hosts = splitHosts(hostsPart).map(h => ({
        host: h.host,
        port: h.port || DEFAULT_PORT.mongodb,
      }));

      const [username, password] = credPart
        ? credPart.split(/:(.*)/).map(decodeURIComponent)
        : ['', ''];

      const database = pathOnly.replace(/^\//, '') || undefined;
      const options = parseQS(queryOnly);
      const ssl = rawProto === 'mongodb+srv:' || options.tls === 'true' || options.ssl === 'true';

      return {
        name: normalizeName('mongodb', hosts, database, options),
        type: 'mongodb',
        host: hosts[0]?.host,
        port: hosts[0]?.port,
        hosts,
        database,
        username: username || undefined,
        password: password || undefined,
        options,
        ssl,
      };
    }

    // --- Schémas non-spéciaux (postgres, mysql, mssql, redis) ---
    // Beaucoup de runtimes renvoient origin="null" -> on force un parsing via http://
    // pour extraire correctement user/pass/host/port
    const forced = new URL(clean.replace(/^([a-zA-Z0-9+.-]+):\/\//, 'http://'));
    const options = parseQS(new URL(clean).search); // garder les options du vrai URL (s'il les gère)
    const host = forced.hostname || undefined;
    let port = forced.port || DEFAULT_PORT[type] || undefined;
    const username = forced.username ? decodeURIComponent(forced.username) : undefined;
    const password = forced.password ? decodeURIComponent(forced.password) : undefined;

    // DB: pour Redis c'est l'index (/0), pour les autres le nom
    const rawPath = forced.pathname || '';
    const database =
      type === 'redis'
        ? rawPath.replace(/^\//, '') || undefined
        : rawPath.replace(/^\//, '') || undefined;

    const hosts = host ? [{ host, port: port ?? '' }] : [];

    // SSL heuristique simple avec détection Azure
    const isAzureDatabase = host?.includes('azure.com') || host?.includes('database.windows.net');
    const ssl =
      (type === 'postgresql' &&
        (options.ssl === 'true' || 
         options.sslmode?.toLowerCase() === 'require' ||
         options.tLSMode === '1' ||
         isAzureDatabase)) || // Azure PostgreSQL exige toujours SSL
      ((type === 'mysql' || type === 'mariadb') &&
        (options.ssl === 'true' || options.tls === 'true' || isAzureDatabase)) ||
      (type === 'mssql' && (options.encrypt === 'true' || isAzureDatabase)) ||
      (type === 'redis' && clean.startsWith('rediss://'));

    return {
      name: normalizeName(type, hosts, database, options),
      type,
      host,
      port,
      hosts: hosts.length ? hosts : undefined,
      database,
      username,
      password,
      options,
      ssl,
    };
  } catch {
    return null;
  }
}

/**
 * Retourne le port par défaut pour un type de base de données
 */
function getDefaultPort(dbType: string): string {
  const defaultPorts: Record<string, string> = {
    mysql: '3306',
    postgresql: '5432',
    sqlite: '',
  };

  return defaultPorts[dbType] || '';
}

/**
 * Vérifie si une chaîne ressemble à une URL de connexion
 */
export function isConnectionUrl(value: string): boolean {
  const urlPattern = /^(postgres|postgresql|mysql|mysql2):\/\/.+/i;
  return urlPattern.test(value.trim());
}

/**
 * Extrait le nom d'hôte d'une URL pour générer un nom de connexion par défaut
 */
export function generateConnectionName(parsedInfo: ParsedConnectionInfo): string {
  const { type, host, port, database } = parsedInfo;
  const portSuffix = port !== getDefaultPort(type) ? `:${port}` : '';
  return `${type}://${host}${portSuffix}/${database}`;
}
