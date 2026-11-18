# Changelog

Toutes les modifications notables de ce projet sont documentées dans ce fichier.

Le format est basé sur [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/),
et ce projet adhère au [Semantic Versioning (SemVer)](https://semver.org/lang/fr/).

## [1.2.0] - 2026-11-17

### Ajouté (Added)
- **Panier & Conciergerie d'Expédition (`CartDrawer.tsx`)** :
  - **Jauge dynamique de Livraison Gants Blancs Offerte** affichant en temps réel le montant restant avant le seuil de gratuité (`328 000 FCFA` / `500 €`) ou la confirmation d'exonération.
  - **Pastilles de Codes Privilèges en 1 clic** (`AFRIQUE10`, `MOMO15`, `DAKAR25`, `VIP100`) directement dans le tiroir de commande avec recalcul serveur instantané.
  - **Sélecteur rapide étendu à 6 Métropoles Africaines** (*Douala · Bonapriso*, *Yaoundé · Bastos*, *Abidjan · Cocody*, *Dakar · Almadies*, *Libreville · Sablière*, *Kinshasa · Gombe*) pré-remplissant automatiquement la ville, le pays et le quartier.
  - **Option Coffret & Certificat Calligraphié Nominatif** permettant d'inclure une dédicace personnalisée jointe au certificat d'authenticité et transmise au coursier.
- **Espace Membre & Cercle Privé (`AccountPortal.tsx` & `src/App.tsx`)** :
  - **Carte Membre Numérique « Cercle Privé Maison Véra »** affichant le cumul des acquisitions confirmées en double devise (`FCFA` + `EUR`) et les privilèges actifs.
  - **Bouton « Recommander » en 1 clic** sur chaque commande de l'historique pour recharger instantanément ses pièces et quantités dans le panier avec recalcul serveur des tarifs et stocks actuels.

---

## [1.1.0] - 2026-11-17

### Ajouté (Added)
- **Certificat d'Acquisition & Facture Officielle Téléchargeable (`OrderSandboxModal.tsx`)** :
  - **Frise visuelle de progression en 4 étapes** (*1. Enregistrée → 2. Règlement validé → 3. Atelier → 4. Expédition*).
  - **Téléchargement en 1 clic du Certificat & Facture Officielle (`.txt`)** avec détail complet en double devise (`FCFA` + `EUR`), TVA, point de repère et numéro de transaction.
- **Portail de Direction Enrichi (`AdminDashboard.tsx`)** :
  - **Synchronisation Multi-Devises (`XAF`, `XOF`, `EUR`)** sur l'ensemble des indicateurs clés de performance (Chiffre d'affaires confirmé, tarifs des variantes, seuils des coupons).
  - **Export Comptable CSV (`Exporter CSV Comptable`)** générant un fichier `.csv` encodé UTF-8 BOM compatible Excel de toutes les commandes filtrées.
  - **Recherche instantanée & filtrage par statut** dans le registre des commandes (par référence, client, ville ou téléphone WhatsApp).
- **Carnet de Souhaits / Favoris (`src/App.tsx`)** :
  - Sélection de pièces favorites (`♥`) directement sur chaque carte du catalogue et filtre dédié **« Favoris »** dans la barre des collections.
- **Architecture & Observabilité Cloud-Native** :
  - Sonde de santé `GET /api/health`, corrélation distribuée `X-Request-Id`, indexation relationnelle SQLite (11 index secondaires) et chargement groupé des lignes de commandes sans requête $N+1$.

---

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
  - Recalcul intégral des prix, remises (`BIENVENUE10`, `DAKAR25`, `VIP100`, `AFRIQUE10`, `MOMO15`, `ARCHITECTE15`, `ATELIER50`), frais de livraison et TVA exclusivement côté serveur (`POST /api/cart/quote` et `POST /api/checkout`).
  - Réservation atomique des stocks en base SQLite WAL et restitution automatique en cas d'annulation ou d'échec de paiement.
  - Webhooks de paiement signés `HMAC-SHA256` en temps constant (`crypto.timingSafeEqual`) avec protection anti-rejeu et idempotence stricte (`webhook_events.event_id UNIQUE`).
