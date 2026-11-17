# Guide de Contribution / Contributing Guide

Merci de contribuer à **Maison Véra — Plateforme E-Commerce Architecturale (Afrique & International)** ! Ce document définit les standards internationaux de développement, de qualité et de revue de code appliqués sur ce dépôt.

---

## 1. Prérequis & Installation Locale

- **Node.js** : `>= 22.0.0` (voir `.nvmrc`)
- **npm** : `>= 10.0.0`

```bash
# Cloner le dépôt
git clone https://github.com/<votre-organisation>/maison-vera-ecommerce.git
cd maison-vera-ecommerce

# Installer les dépendances exactes
npm ci

# Initialiser les variables d'environnement locales
cp .env.example .env

# Démarrer le serveur de développement (Express + Vite sur http://localhost:3000)
npm run dev
```

---

## 2. Standards de Qualité & Vérifications Obligatoires

Avant toute soumission de Pull Request (PR), votre branche **doit obligatoirement** passer les trois vérifications suivantes sans aucune erreur :

```bash
# 1. Vérification stricte des types TypeScript
npm run lint

# 2. Exécution de la suite de tests automatisés (Unitaires, Intégration & Parcours Critiques)
npm test

# 3. Compilation du bundle de production
npm run build
```

---

## 3. Convention de Nommage des Branches & Commits

### Branches
- `feat/<description-courte>` : Nouvelle fonctionnalité client ou back-office
- `fix/<description-courte>` : Correction de bug (panier, stock, webhook, UI)
- `sec/<description-courte>` : Durcissement de sécurité ou mise à jour de dépendance critique
- `docs/<description-courte>` : Amélioration de la documentation (`README.md`, `architecture.md`)
- `test/<description-courte>` : Ajout ou renforcement de tests automatisés

### Messages de Commit (Conventional Commits v1.0.0)
Nous suivons la norme internationale **Conventional Commits** :
- `feat(checkout): add Wave and MTN MoMo validation for CEMAC/UEMOA`
- `fix(stock): restore reserved variant inventory on failed payment webhook`
- `sec(webhook): enforce constant-time HMAC-SHA256 signature verification`
- `test(pricing): verify server-side discount cap on BIENVENUE10 coupon`
- `docs(readme): add Docker Compose and GitHub Actions deployment guide`

---

## 4. Règles Architecturales Inviolables

1. **Séparation stricte Frontend / Backend** : Aucune donnée technique du serveur (algorithmes cryptographiques, logs SQL, payloads JSON bruts) ne doit être affichée dans l'interface client.
2. **Autorité Serveur sur les Prix** : Toute évolution des tarifs, devises ou codes privilèges doit être validée dans `src/server/domain.ts` et couverte par un test dans `tests/ecommerce.test.ts`.
3. **Atomicité des Stocks** : Toute modification du stock doit s'exécuter dans une transaction SQLite (`db.transaction(...)`).
4. **Zéro Secret dans le Code** : Utilisez exclusivement `process.env.*` côté serveur et documentez toute nouvelle variable dans `.env.example`.
