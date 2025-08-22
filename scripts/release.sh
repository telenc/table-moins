#!/bin/bash

# Script pour créer une nouvelle release de TableMoins
# Usage: ./scripts/release.sh [version]
# Exemple: ./scripts/release.sh 1.0.0

set -e

# Couleurs pour l'output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function pour afficher des messages colorés
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
    exit 1
}

# Vérifier que nous sommes dans le bon répertoire
if [ ! -f "package.json" ]; then
    log_error "Ce script doit être exécuté depuis la racine du projet"
fi

# Obtenir la version
if [ -z "$1" ]; then
    # Lire la version actuelle depuis package.json
    CURRENT_VERSION=$(node -p "require('./package.json').version")
    log_info "Version actuelle: $CURRENT_VERSION"
    
    echo -n "Entrez la nouvelle version (format: X.Y.Z): "
    read VERSION
else
    VERSION=$1
fi

# Valider le format de version
if [[ ! $VERSION =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    log_error "Format de version invalide. Utilisez X.Y.Z (ex: 1.0.0)"
fi

log_info "Préparation de la release v$VERSION..."

# Vérifier que nous sommes sur la branche main
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "main" ]; then
    log_warning "Vous n'êtes pas sur la branche main (actuellement sur $CURRENT_BRANCH)"
    echo -n "Continuer quand même? (y/N): "
    read -r CONTINUE
    if [[ ! $CONTINUE =~ ^[Yy]$ ]]; then
        log_error "Release annulée"
    fi
fi

# Vérifier que le working directory est propre
if [ -n "$(git status --porcelain)" ]; then
    log_error "Working directory non propre. Committez vos changements d'abord."
fi

# Mettre à jour la version dans package.json
log_info "Mise à jour de la version dans package.json..."
npm version $VERSION --no-git-tag-version

# Créer le changelog pour cette version
log_info "Génération du changelog..."
cat > "CHANGELOG_v$VERSION.md" << EOF
# Version $VERSION

$(date +"%Y-%m-%d")

## Nouvelles fonctionnalités
- [À compléter] Décrivez les nouvelles fonctionnalités

## Améliorations
- [À compléter] Décrivez les améliorations

## Corrections de bugs
- [À compléter] Décrivez les corrections

## Changements techniques
- [À compléter] Changements internes, dépendances, etc.
EOF

# Ouvrir l'éditeur pour modifier le changelog
if command -v code &> /dev/null; then
    log_info "Ouverture du changelog dans VS Code..."
    code "CHANGELOG_v$VERSION.md"
elif command -v nano &> /dev/null; then
    log_info "Ouverture du changelog dans nano..."
    nano "CHANGELOG_v$VERSION.md"
else
    log_warning "Éditeur non trouvé. Éditez manuellement CHANGELOG_v$VERSION.md"
fi

echo -n "Changelog terminé? Appuyez sur Entrée pour continuer..."
read

# Commit des changements
log_info "Commit des changements..."
git add package.json "CHANGELOG_v$VERSION.md"
git commit -m "chore: bump version to $VERSION

- Update package.json version
- Add changelog for v$VERSION"

# Créer le tag
log_info "Création du tag v$VERSION..."
git tag -a "v$VERSION" -m "Release version $VERSION

$(cat CHANGELOG_v$VERSION.md)"

# Push les changements et le tag
log_info "Push vers GitHub..."
git push origin main
git push origin "v$VERSION"

log_success "Release v$VERSION créée avec succès!"
log_info "GitHub Actions va maintenant:"
log_info "  1. Builder l'app pour macOS, Windows et Linux"
log_info "  2. Créer la release GitHub avec tous les fichiers"
log_info "  3. Publier les binaires"

log_info "Suivez le progress sur: https://github.com/$(git config remote.origin.url | sed 's/.*github.com[:/]\([^.]*\).*/\1/')/actions"
log_info "La release sera disponible sur: https://github.com/$(git config remote.origin.url | sed 's/.*github.com[:/]\([^.]*\).*/\1/')/releases"

# Nettoyer
rm "CHANGELOG_v$VERSION.md"

log_success "🎉 Tout est prêt! La release sera automatiquement créée par GitHub Actions."