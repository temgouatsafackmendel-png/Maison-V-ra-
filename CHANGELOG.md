# Changelog

Toutes les modifications notables de ce projet sont documentées dans ce fichier.

Le format est basé sur [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/),
et ce projet adhère au [Semantic Versioning (SemVer)](https://semver.org/lang/fr/).

## [1.0.0] - 2026-11-17

### Ajouté (Added)
- **Catalogue Architectural & Variantes** : Navigation par collections (`Luminaires`, `Mobilier`, `Acoustique`, `Objets`), recherche instantanée, tri par prix, et sélection d'éditions avec état des stocks en temps réel.
- **Adaptation Complète Afrique & International** :
  - Sélecteur multi-devises instantané (**FCFA — CEMAC `XAF`**, **FCFA — UEMOA `XOF`**, **Euro `EUR`**).
  - Moyens de paiement adaptés au continent africain et à l'international : **MTN Mobile Money (MoMo)**, **Orange Money**, **Wave Mobile Money**, **Paiement à la livraison (Cash / MoMo au coursier)** et **Carte Bancaire (Visa / Mastercard)**.
  - Logistique urbaine adaptée aux grandes capitales (**Douala, Yaoundé, Abidjan, Dakar, Libreville, Kinshasa, Cotonou, Lomé, Casablanca, Paris**) avec saisie du **quartier**, du **point de repère livreur** et du numéro **WhatsApp**.
  - **Mode Éco Data (3G/4G)** pour optimiser l'expérience sur réseaux mobiles.
  - **Suivi Direct de Commande** sans création de compte obligatoire (via numéro de commande + WhatsApp ou e-mail) et export du bon de commande pour WhatsApp en 1 clic.
- **Moteur Transactionnel & Sécurité Serveur** :
  - Recalcul intégral des prix, remises (`BIENVENUE10`, `DAKAR25`, `VIP100`, `ARCHITECTE15`, `ATELIER50`), frais de livraison et TVA exclusivement côté serveur (`POST /api/cart/quote` et `POST /api/checkout`).
  - Réservation atomique des stocks en base SQLite WAL et restitution automatique en cas d'annulation ou d'échec de paiement.
  - Webhooks de paiement signés `HMAC-SHA256` en temps constant (`crypto.timingSafeEqual`) avec protection anti-rejeu et idempotence stricte (`webhook_events.event_id UNIQUE`).
- **Cercle Privé & Portail de Direction (Back-Office)** :
  - Authentification sécurisée (`PBKDF2-SHA512` + jetons Bearer hachés) et contrôle d'accès par rôle (`customer` / `admin`).
  - Pilotage des stocks par variante, gestion du statut d'expédition des commandes, création de codes privilèges et suivi des courriers transactionnels envoyés aux clients.
- **Qualité, Conteneurisation & CI/CD** :
  - Suite de tests automatisés Vitest + Supertest couvrant la cryptographie, le recalcul serveur des prix, la cohérence des stocks, l'idempotence des webhooks et le RBAC.
  - `Dockerfile`, `.dockerignore`, `docker-compose.yml` et pipeline GitHub Actions (`.github/workflows/ci.yml`).
