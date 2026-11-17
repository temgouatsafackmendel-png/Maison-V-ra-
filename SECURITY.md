# Politique de Sécurité / Security Policy

## Versions Supportées (Supported Versions)

| Version | Statut de support |
| :--- | :--- |
| `1.0.x` | ✅ Supportée activement (Correctifs de sécurité appliqués) |
| `< 1.0.0` | ❌ Non supportée |

---

## Architecture de Sécurité Intégrée (Built-in Security Controls)

Ce dépôt respecte les normes internationales **OWASP ASVS** et **PCI-DSS (principes applicatifs e-commerce)** :

1. **Zéro Confiance Client sur les Prix (`Server-Side Pricing Authority`)**
   - Le serveur (`src/server/domain.ts`) ignore systématiquement tout montant, remise ou frais de livraison envoyé par le navigateur.
   - Tous les prix sont recalculés à partir des tarifs stockés en base SQLite, après validation des règles de codes privilèges (dates, minimum d'achat, plafond d'utilisation).

2. **Webhooks de Paiement Signés & Idempotents (`HMAC-SHA256` + Anti-Replay)**
   - Chaque notification de paiement reçue sur `POST /api/webhooks/payment` doit comporter un en-tête `X-Webhook-Signature: t=<timestamp>,v1=<signature>`.
   - La signature est vérifiée en **temps constant** (`crypto.timingSafeEqual`) sur le corps brut (`rawBody`) avec une fenêtre de tolérance anti-rejeu de **300 secondes**.
   - Chaque `event_id` est enregistré avec une contrainte `UNIQUE` dans la table `webhook_events` pour garantir une **idempotence stricte** (aucun double débit, aucune double restitution de stock).

3. **Authentification, Sessions & Mots de Passe**
   - Mots de passe hachés via `PBKDF2-SHA512` (100 000 itérations, sel aléatoire de 16 octets, comparaison en temps constant).
   - Jetons de session Bearer générés avec 32 octets d'entropie cryptographique et stockés uniquement sous forme d'empreinte `HMAC-SHA256` en base de données.

4. **Protection des Données & En-têtes HTTP**
   - Validation stricte de toutes les entrées via **Zod** côté serveur.
   - Requêtes SQL 100 % paramétrées (`better-sqlite3` prepared statements) contre les injections SQL.
   - En-têtes de sécurité systématiques : `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy: strict-origin-when-cross-origin`.
   - Limitation de débit (`Rate Limiting`) par adresse IP sur les routes sensibles (authentification, création de commande, webhooks).

5. **Gestion des Secrets**
   - Aucun secret réel n'est commité dans Git (`.gitignore` exclut `.env` et `.env.*`).
   - Seul `.env.example` est versionné avec des valeurs d'exemple clairement identifiées pour le mode test/sandbox.

---

## Signaler une Vulnérabilité (Reporting a Vulnerability)

Si vous découvrez une vulnérabilité de sécurité dans ce projet :

1. **Ne créez pas d'Issue GitHub publique** contenant les détails d'exploitation.
2. Envoyez un rapport confidentiel via l'onglet **Security > Advisories > Report a vulnerability** du dépôt GitHub.
3. Incluez :
   - La description précise de la vulnérabilité et le composant impacté.
   - Les étapes de reproduction (requête HTTP, payload ou test unitaire).
   - L'impact potentiel sur la confidentialité, l'intégrité des stocks ou des paiements.
4. Nous accusons réception sous **48 heures** et publions un correctif vérifié accompagné d'un test de non-régression.
