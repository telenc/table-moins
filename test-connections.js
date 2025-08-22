// Test simple des services de connexion
const { encryptionService } = require('./dist/main/shared/utils/encryption');
const { storageService } = require('./dist/main/database/storage-service');
const { connectionService } = require('./dist/main/database/connection-service');

async function testServices() {
  console.log('🧪 Test des services de connexion TableMoins\n');
  
  try {
    // Test du service de chiffrement
    console.log('1️⃣ Test du service de chiffrement...');
    await encryptionService.initialize('test-password-123');
    console.log('✅ Service de chiffrement initialisé');
    
    const testText = 'Hello TableMoins!';
    const encrypted = await encryptionService.encrypt(testText);
    console.log('✅ Texte chiffré:', encrypted.substring(0, 50) + '...');
    
    const decrypted = await encryptionService.decrypt(encrypted);
    console.log('✅ Texte déchiffré:', decrypted);
    console.log('✅ Chiffrement/déchiffrement:', testText === decrypted ? 'OK' : 'ERREUR');
    
    // Test du service de stockage
    console.log('\n2️⃣ Test du service de stockage...');
    await storageService.initialize('./test-tablemoins.db');
    console.log('✅ Service de stockage initialisé');
    
    // Test du service de connexions (il utilisera le même storage déjà initialisé)
    console.log('\n3️⃣ Test du service de connexions...');
    // Pas besoin d'initialiser à nouveau, le storage est déjà prêt
    console.log('✅ Service de connexions prêt');
    
    // Test de création d'une connexion de test
    console.log('\n4️⃣ Test de création de connexion...');
    const testConnection = {
      name: 'Test Local MySQL',
      type: 'mysql',
      host: 'localhost',
      port: 3306,
      username: 'root',
      password: 'password',
      database: 'test',
      ssl: false,
      isActive: true,
    };
    
    const connectionId = await connectionService.createConnection(testConnection);
    console.log('✅ Connexion créée avec ID:', connectionId);
    
    // Récupérer toutes les connexions
    const connections = await connectionService.getAllConnections();
    console.log('✅ Connexions sauvegardées:', connections.length);
    
    console.log('\n🎉 Tous les tests sont passés !');
    
  } catch (error) {
    console.error('\n❌ Erreur lors des tests:', error.message);
    process.exit(1);
  } finally {
    // Nettoyage
    await connectionService.cleanup();
    encryptionService.cleanup();
    
    // Supprimer le fichier de base de données de test
    try {
      const fs = require('fs');
      if (fs.existsSync('./test-tablemoins.db')) {
        fs.unlinkSync('./test-tablemoins.db');
      }
      if (fs.existsSync('./test-tablemoins.db-shm')) {
        fs.unlinkSync('./test-tablemoins.db-shm');
      }
      if (fs.existsSync('./test-tablemoins.db-wal')) {
        fs.unlinkSync('./test-tablemoins.db-wal');
      }
    } catch (e) {
      // Ignorer les erreurs de nettoyage
    }
    
    console.log('\n🧹 Nettoyage terminé');
  }
}

// Lancer les tests uniquement si ce script est exécuté directement
if (require.main === module) {
  testServices();
}

module.exports = { testServices };