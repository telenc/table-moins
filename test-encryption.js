// Test isolé du service de chiffrement (sans Electron)
const { encryptionService } = require('./dist/main/shared/utils/encryption');

async function testEncryption() {
  console.log('🔐 Test du service de chiffrement TableMoins\n');
  
  try {
    // Test du service de chiffrement
    console.log('1️⃣ Initialisation du service...');
    await encryptionService.initialize('test-master-password-123');
    console.log('✅ Service de chiffrement initialisé');
    
    // Test de chiffrement/déchiffrement
    console.log('\n2️⃣ Test de chiffrement/déchiffrement...');
    const testTexts = [
      'password123',
      'Mot de passe avec espaces et caractères spéciaux: éàç!@#',
      'Un texte très long avec beaucoup de caractères pour tester la robustesse du système de chiffrement et s\'assurer qu\'il fonctionne correctement même avec des données volumineuses.',
      '',
      'mysql://user:pass@host:3306/database'
    ];
    
    for (const text of testTexts) {
      console.log(`\nTest avec: "${text}"`);
      
      const encrypted = await encryptionService.encrypt(text);
      console.log(`Chiffré: ${encrypted.substring(0, 50)}...`);
      
      const decrypted = await encryptionService.decrypt(encrypted);
      const success = text === decrypted;
      console.log(`Déchiffré: "${decrypted}"`);
      console.log(`Résultat: ${success ? '✅ OK' : '❌ ERREUR'}`);
      
      if (!success) {
        throw new Error(`Test échoué pour: "${text}"`);
      }
    }
    
    // Test de hachage de mot de passe
    console.log('\n3️⃣ Test de hachage de mots de passe...');
    const password = 'my-secure-password';
    const { hash, salt } = await encryptionService.hashPassword(password);
    console.log(`Hash: ${hash.substring(0, 20)}...`);
    console.log(`Salt: ${salt.substring(0, 20)}...`);
    
    // Vérification du mot de passe
    const isValid = await encryptionService.verifyPassword(password, hash, salt);
    console.log(`Vérification: ${isValid ? '✅ OK' : '❌ ERREUR'}`);
    
    const isInvalid = await encryptionService.verifyPassword('wrong-password', hash, salt);
    console.log(`Faux mot de passe rejeté: ${!isInvalid ? '✅ OK' : '❌ ERREUR'}`);
    
    // Test de génération d'ID
    console.log('\n4️⃣ Test de génération d\'ID...');
    const ids = Array.from({ length: 5 }, () => encryptionService.generateId());
    console.log('IDs générés:');
    ids.forEach(id => console.log(`  ${id}`));
    
    // Vérifier l'unicité
    const uniqueIds = new Set(ids);
    console.log(`Unicité: ${uniqueIds.size === ids.length ? '✅ OK' : '❌ ERREUR'}`);
    
    console.log('\n🎉 Tous les tests de chiffrement sont passés !');
    
    // Test de performance
    console.log('\n5️⃣ Test de performance...');
    const iterations = 100;
    const testData = 'Test de performance avec données répétitives '.repeat(10);
    
    console.time('Chiffrement/Déchiffrement');
    for (let i = 0; i < iterations; i++) {
      const encrypted = await encryptionService.encrypt(testData);
      const decrypted = await encryptionService.decrypt(encrypted);
      if (decrypted !== testData) {
        throw new Error(`Erreur de performance à l'itération ${i}`);
      }
    }
    console.timeEnd('Chiffrement/Déchiffrement');
    console.log(`✅ ${iterations} opérations complètes réussies`);
    
  } catch (error) {
    console.error('\n❌ Erreur lors des tests:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    // Nettoyage
    encryptionService.cleanup();
    console.log('\n🧹 Nettoyage terminé');
  }
}

// Lancer les tests
testEncryption();