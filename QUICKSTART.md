# 🚀 Quick Start - Releases Automatiques

## Comment créer votre première release

### 1. Préparer votre repository GitHub

```bash
# 1. Créer un repo GitHub (si pas déjà fait)
# 2. Pousser votre code
git add .
git commit -m "feat: setup automated releases"
git push origin main
```

### 2. Première release automatique

```bash
# Option A: Script automatique (recommandé)
./scripts/release.sh 1.0.0

# Option B: Manuel
npm version 1.0.0 --no-git-tag-version
git add package.json
git commit -m "chore: bump version to 1.0.0"
git tag -a v1.0.0 -m "Release version 1.0.0"
git push origin main
git push origin v1.0.0
```

### 3. Voir votre release en action

1. **GitHub Actions** : https://github.com/[votre-username]/TableMoins/actions
2. **Releases** : https://github.com/[votre-username]/TableMoins/releases

## 📦 Ce qui sera créé automatiquement

### macOS
- `TableMoins-1.0.0-arm64.dmg` (Apple Silicon)
- `TableMoins-1.0.0-x64.dmg` (Intel)
- `TableMoins-1.0.0-mac.zip` (Portable)

### Windows  
- `TableMoins-1.0.0-win-x64.exe` (Installateur)
- `TableMoins-1.0.0-win-x64.msi` (Package MSI)

### Linux
- `TableMoins-1.0.0-linux-x64.AppImage` (Universal)
- `TableMoins-1.0.0-linux-amd64.deb` (Debian/Ubuntu)
- `TableMoins-1.0.0-linux-x86_64.rpm` (Red Hat/Fedora)

## ⚡ Process complet (~15-20 minutes)

1. **Build Matrix** (5-10 min) - Build sur 3 OS simultanément
2. **Tests** (2-3 min) - Lint, type-check, tests
3. **Release Creation** (1-2 min) - Upload et publication
4. **✅ FINI!** - Vos users peuvent télécharger

## 🔧 Configuration requise

Mettez à jour ces valeurs dans `package.json`:

```json
{
  "build": {
    "publish": [
      {
        "provider": "github",
        "owner": "VOTRE-USERNAME",  // ← Changez ici
        "repo": "TableMoins"
      }
    ]
  }
}
```

## 🎯 Prochaines releases

```bash
# Pour les nouvelles versions
./scripts/release.sh 1.1.0  # Nouvelle fonctionnalité
./scripts/release.sh 1.0.1  # Correction de bug
./scripts/release.sh 2.0.0  # Breaking change
```

## 💡 Tips

- **Releases Beta** : `./scripts/release.sh 1.0.0-beta.1`
- **Release Draft** : Editez manuellement sur GitHub après création
- **Hotfix** : Directement depuis `main` avec version patch

---

**C'est tout! Vos releases sont maintenant automatiques! 🎉**