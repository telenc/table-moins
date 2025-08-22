import * as crypto from 'crypto';
import { Logger } from './logger';

const logger = new Logger('Encryption');

// Algorithme de chiffrement (CBC pour simplicité)
const ALGORITHM = 'aes-256-cbc';
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16; // 128 bits
const SALT_LENGTH = 64; // 512 bits
const TAG_LENGTH = 16; // 128 bits
const ITERATIONS = 100000; // Nombre d'itérations pour PBKDF2

export class EncryptionService {
  private static instance: EncryptionService;
  private masterKey: Buffer | null = null;

  private constructor() {}

  static getInstance(): EncryptionService {
    if (!EncryptionService.instance) {
      EncryptionService.instance = new EncryptionService();
    }
    return EncryptionService.instance;
  }

  /**
   * Initialise le service avec une clé maître
   */
  async initialize(masterPassword: string): Promise<void> {
    try {
      // Générer une clé maître déterministe à partir du mot de passe
      const salt = Buffer.from('TableMoins-Salt-2024', 'utf8'); // Salt fixe pour la clé maître
      this.masterKey = await this.deriveKey(masterPassword, salt);
      logger.info('Service de chiffrement initialisé');
    } catch (error) {
      logger.error('Erreur lors de l\'initialisation du chiffrement:', error as Error);
      throw error;
    }
  }

  /**
   * Vérifie si le service est initialisé
   */
  isInitialized(): boolean {
    return this.masterKey !== null;
  }

  /**
   * Chiffre une chaîne de caractères
   */
  async encrypt(plaintext: string): Promise<string> {
    if (!this.masterKey) {
      throw new Error('Service de chiffrement non initialisé');
    }

    try {
      // Générer un IV aléatoire
      const iv = crypto.randomBytes(IV_LENGTH);
      
      // Créer le cipher avec IV (utiliser la nouvelle API)
      const cipher = crypto.createCipheriv(ALGORITHM, this.masterKey, iv);
      
      // Chiffrer les données (bien gérer l'encodage UTF-8)
      let encrypted = cipher.update(plaintext, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      // Structure de données avec IV
      const result = {
        iv: iv.toString('hex'),
        encrypted: encrypted
      };
      
      return Buffer.from(JSON.stringify(result), 'utf8').toString('base64');
    } catch (error) {
      logger.error('Erreur lors du chiffrement:', error as Error);
      throw new Error('Échec du chiffrement');
    }
  }

  /**
   * Déchiffre une chaîne de caractères
   */
  async decrypt(encryptedData: string): Promise<string> {
    if (!this.masterKey) {
      throw new Error('Service de chiffrement non initialisé');
    }

    try {
      // Décoder les données
      const data = JSON.parse(Buffer.from(encryptedData, 'base64').toString('utf8'));
      
      const iv = Buffer.from(data.iv, 'hex');
      const encrypted = data.encrypted;
      
      // Créer le decipher avec IV (utiliser la nouvelle API)
      const decipher = crypto.createDecipheriv(ALGORITHM, this.masterKey, iv);
      
      // Déchiffrer les données (bien gérer l'encodage UTF-8)
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      logger.error('Erreur lors du déchiffrement:', error as Error);
      throw new Error('Échec du déchiffrement');
    }
  }

  /**
   * Hache un mot de passe avec salt
   */
  async hashPassword(password: string): Promise<{ hash: string; salt: string }> {
    try {
      const salt = crypto.randomBytes(SALT_LENGTH);
      const hash = await this.deriveKey(password, salt);
      
      return {
        hash: hash.toString('hex'),
        salt: salt.toString('hex')
      };
    } catch (error) {
      logger.error('Erreur lors du hachage:', error as Error);
      throw error;
    }
  }

  /**
   * Vérifie un mot de passe haché
   */
  async verifyPassword(password: string, hash: string, salt: string): Promise<boolean> {
    try {
      const saltBuffer = Buffer.from(salt, 'hex');
      const derivedKey = await this.deriveKey(password, saltBuffer);
      const expectedHash = derivedKey.toString('hex');
      
      return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(expectedHash, 'hex'));
    } catch (error) {
      logger.error('Erreur lors de la vérification:', error as Error);
      return false;
    }
  }

  /**
   * Génère une clé à partir d'un mot de passe et d'un salt
   */
  private async deriveKey(password: string, salt: Buffer): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      crypto.pbkdf2(password, salt, ITERATIONS, KEY_LENGTH, 'sha512', (err, derivedKey) => {
        if (err) {
          reject(err);
        } else {
          resolve(derivedKey);
        }
      });
    });
  }

  /**
   * Génère un ID unique pour les connexions
   */
  generateId(): string {
    return crypto.randomUUID();
  }

  /**
   * Nettoie les données sensibles de la mémoire
   */
  cleanup(): void {
    if (this.masterKey) {
      this.masterKey.fill(0);
      this.masterKey = null;
    }
    logger.info('Service de chiffrement nettoyé');
  }
}

// Instance singleton
export const encryptionService = EncryptionService.getInstance();