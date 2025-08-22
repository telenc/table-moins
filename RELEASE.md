# 🚀 Release Process - TableMoins

Ce document explique comment créer et publier de nouvelles versions de TableMoins.

## 📋 Vue d'ensemble

Le processus de release est entièrement automatisé via GitHub Actions :
- ✅ Build automatique pour macOS, Windows et Linux
- ✅ Tests automatiques sur toutes les plateformes
- ✅ Création automatique de la release GitHub
- ✅ Publication des binaires avec checksums

## 🎯 Processus de Release

### Option 1: Script automatique (Recommandé)

```bash
# Créer une nouvelle release
./scripts/release.sh 1.0.0

# Le script va :
# 1. Mettre à jour package.json
# 2. Créer un changelog
# 3. Committer les changements
# 4. Créer le tag Git
# 5. Pusher vers GitHub
# 6. Déclencher GitHub Actions
```

### Option 2: Manuel

```bash
# 1. Mettre à jour la version
npm version 1.0.0 --no-git-tag-version

# 2. Committer
git add package.json
git commit -m "chore: bump version to 1.0.0"

# 3. Créer le tag
git tag -a v1.0.0 -m "Release version 1.0.0"

# 4. Pusher
git push origin main
git push origin v1.0.0
```

## 🤖 GitHub Actions

### Workflow `release.yml`
**Déclenché par :** Tags au format `v*.*.*` (ex: v1.0.0)

**Actions :**
1. **Build Matrix** - Build sur macOS, Windows, Linux
2. **Tests** - Lint, type-check, tests unitaires
3. **Artifacts** - Upload des binaires par plateforme
4. **Release** - Création de la release GitHub avec tous les fichiers

### Workflow `build.yml`
**Déclenché par :** Push sur `main` ou `develop`, Pull Requests

**Actions :**
1. **Tests** - Validation du code sur toutes les plateformes
2. **Dev Build** - Build de développement sur la branche `develop`

## 📦 Formats de Distribution

### macOS
- `TableMoins-X.X.X-arm64.dmg` - Apple Silicon (M1/M2/M3)
- `TableMoins-X.X.X-x64.dmg` - Intel Macs
- `TableMoins-X.X.X-mac.zip` - Version portable

### Windows
- `TableMoins-X.X.X-win-x64.exe` - Installateur Windows
- `TableMoins-X.X.X-win-x64.msi` - Package MSI

### Linux
- `TableMoins-X.X.X-linux-x64.AppImage` - Universal (recommandé)
- `TableMoins-X.X.X-linux-amd64.deb` - Debian/Ubuntu
- `TableMoins-X.X.X-linux-x86_64.rpm` - Red Hat/Fedora
- `TableMoins-X.X.X-linux-x64.tar.gz` - Archive

## 🔐 Sécurité

Chaque release inclut :
- **Checksums SHA256** pour tous les fichiers
- **Signature des commits** (si configurée)
- **Validation automatique** des builds

## 📝 Versioning

Nous utilisons [Semantic Versioning](https://semver.org/):

- **MAJOR** (`1.0.0`) - Changements incompatibles
- **MINOR** (`0.1.0`) - Nouvelles fonctionnalités compatibles
- **PATCH** (`0.0.1`) - Corrections de bugs

## 🚨 Troubleshooting

### Build Failed sur une plateforme
1. Vérifiez les logs GitHub Actions
2. Testez localement : `npm run build:mac|win|linux`
3. Corrigez et re-taggez

### Release non créée
1. Vérifiez que le tag suit le format `v*.*.*`
2. Vérifiez les permissions GitHub Actions
3. Re-poussez le tag si nécessaire

### Dépendances natives
Certaines dépendances (comme `better-sqlite3`) sont rebuiltées automatiquement pour chaque plateforme.

## 📊 Monitoring

- **GitHub Actions** : https://github.com/[votre-repo]/actions
- **Releases** : https://github.com/[votre-repo]/releases
- **Issues** : https://github.com/[votre-repo]/issues

## 🎉 Après la Release

1. **Vérifiez** que tous les binaires sont disponibles
2. **Testez** au moins un binaire par plateforme
3. **Annoncez** la release (Discord, Twitter, etc.)
4. **Mettez à jour** la documentation si nécessaire

---

**Happy releasing! 🚀**