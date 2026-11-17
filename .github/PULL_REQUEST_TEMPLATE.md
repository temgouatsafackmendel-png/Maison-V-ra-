## Description des Modifications (Summary)

Décrivez brièvement l'objectif de cette Pull Request et les changements apportés :
- 

## Type de Changement (Type of Change)

- [ ] `feat` : Nouvelle fonctionnalité client ou back-office
- [ ] `fix` : Correction de bug (panier, stock, paiement, UI)
- [ ] `sec` : Amélioration de la sécurité ou validation serveur
- [ ] `docs` : Mise à jour de la documentation
- [ ] `test` : Ajout ou mise à jour de tests automatisés

## Checklist de Conformité & Qualité (Verification Checklist)

- [ ] **Zéro donnée technique exposée côté client** : L'interface reste purement orientée client/métier, sans jargon serveur.
- [ ] **Autorité Serveur respectée** : Aucun calcul critique (prix, remise, stock) ne repose sur la confiance client.
- [ ] **Typage strict validé** : `npm run lint` (`tsc --noEmit`) passe sans aucune erreur.
- [ ] **Tests automatisés validés** : `npm test` (`vitest run`) passe à 100 %.
- [ ] **Build de production validé** : `npm run build` compile proprement dans `dist/`.
- [ ] **Aucun secret commité** : Aucune clé API ou variable `.env` privée n'est incluse dans le diff.
