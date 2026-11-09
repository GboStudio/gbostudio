# THE UNREAL MUSEUM — Architecture commerciale modulaire (prototype V1)

## État réel

Ce développement ajoute un **simulateur d'administration** :
`commerce-configurator.html`, `commerce-admin.mjs` et `commerce-model.mjs`.
Il **ne** remplace **pas** le moteur 3D existant, la vente statique des cadres, le stockage local des œuvres ou les anciennes offres affichées sur la page d'accueil. Il n'active **aucune** vente ni aucune réservation partagée. Les changements restent dans le navigateur utilisé, via localStorage. N'utilisez pas ce formulaire comme console d'administration sécurisée.

## Découpage d'un module mural

- Chaque module commercial mesure exactement **3 m** de large ; hauteur d'exposition initiale **2,40 m**, modifiable de 1,20 à 4,50 m.
- Une grille logique de **4 × 4 = 16 cellules** couvre la surface commercialisable hors marges et joints.
- Formats exclusifs par module :
  - **1 très grand** : une pièce 4 × 4 cellules ;
  - **2 grands** : deux pièces 2 × 4 ;
  - **4 normaux** : quatre pièces 2 × 2 ;
  - **8 moyens** : huit pièces 1 × 2 ;
  - **16 petits** : seize pièces 1 × 1.
- Le format actif d'un module ne peut pas changer tant qu'une réservation de ce module est en cours. Ceci évite tout chevauchement d'œuvres. Les 16 cellules permettent ultérieurement un moteur de subdivisions mixtes, sous réserve de gérer l'inventaire transactionnel par cellule.
- La réservation désigne l'identifiant du module, du format et de la case. Les tailles physiques sont calculées automatiquement à partir des marges et joints.

### Tarifs initiaux de travail (non publiés)

| Format | Nombre par module | Mensuel | Annuel |
|---|---:|---:|---:|
| Très grand | 1 | 119 € | 1 190 € |
| Grand | 2 | 69 € | 690 € |
| Normal | 4 | 39 € | 390 € |
| Moyen | 8 | 19 € | 190 € |
| Petit | 16 | 9 € | 90 € |

Les tarifs sont des hypothèses commerciales **paramétrables**, pas des prix validés par le propriétaire. Ils ne sont pas appliqués à la page publique.

## Installations 3D premium dans l'allée

Le simulateur réutilise les cinq stations conceptuelles S01 à S05.
Exemples de créations : sculpture, modèle 3D, installation animée.
Chaque station peut accueillir **un seul objet pendant une période active**.
La réservation peut durer **1 journée (24 h), 1 semaine (7 jours), 1 mois (30 jours)**.
Le rayon de rendu est un **maximum configurable** et non une promesse de visibilité à travers les murs.
La plage de visibilité souscrite est enregistrée en instantané dans la réservation pour ne pas être modifiée rétroactivement.

### Tarifs initiaux de travail — premium

| Portée maximum | 1 jour | 7 jours | 30 jours |
|---|---:|---:|---:|
| Proximité : 15 m | 290 € | 1 290 € | 3 990 € |
| Galerie : 35 m | 590 € | 2 490 € | 7 990 € |
| Monumental : 75 m | 990 € | 4 990 € | 15 900 € |

Ces montants servent uniquement à illustrer une tarification premium et sont modifiables.
Le moteur de rendu devra appliquer des règles de **frustum culling, occlusion réelle, distance maximale, fondu de visibilité et LOD**, et conserver les collisions et les itinéraires de visite.

## Contrat de données recommandé en production

- `museum_wall_modules` : id, zone, côté gauche/droit, position 3D, largeur, hauteur, statut, format actif.
- `museum_wall_cells` : module_id, cellule 0–15, statut et version.
- `museum_aisle_stations` : id, position 3D, volume admissible, statut.
- `catalog_products` : format, type d'emplacement, droits, limites, statut.
- `catalog_prices` : produit, monnaie, montant, période mensuelle/annuelle/24 h/7 j/30 j, dates d'effet, version de prix.
- `exhibition_claims` : œuvre, emplacement, cellules occupées ou station, valid_from, valid_until, état (provisoire/payé/actif/expiré/annulé), prix et portée figés.
- `subscriptions` : fournisseur de paiement, abonnement externe, client, date de renouvellement, statut.
- `artworks` : artiste, type de média, droits, fichier privé, validation/modération, état de publication.
- `audit_events` : auteur, action, objet, ancienne et nouvelle valeur, horodatage.

**Stock et sécurité :** réserver avec une transaction atomique côté serveur, des contraintes d'unicité actives et une durée d'expiration pour les paniers non payés. Le frontend ne décide jamais de la disponibilité réelle, des droits ou du prix facturé. Webhooks de paiement signés, idempotence, contrôle du statut des abonnements et modération avant exposition. L'interface d'administration doit nécessiter une authentification et des autorisations serveur, et ne pas sauvegarder les paramètres globaux dans le localStorage.

**Expirations :** des événements serveur réguliers passent les expositions expirées en mode masqué puis libèrent la place. En cas de renouvellement réussi, étendre la période contractuelle sans interrompre l'œuvre. Un achat à l'unité n'entraîne pas de renouvellement automatique ; un abonnement mensuel ou annuel suppose un contrat d'abonnement explicite.

## Intégration future sans régression 3D

1. Cartographier les murs actuellement construits par `engine3d.js` (pas de 3,5 m, 38 positions) avec les **nouveaux modules commerciaux de 3 m** ; ne jamais remplacer le pas physique sans refaire la scénographie, les circulations et les collisions.
2. Rendre les cadres d'un module en fonction de son format et de la matrice de cellules réservées. Les objets existants et emplacements partenaires doivent être repris dans l'inventaire.
3. Ajouter dans `engine3d.js` le rendu des objets premium en appliquant `aisleVisibility()`, LOD et occlusion ; vérifier les performances sur iPhone.
4. Migrer les données des œuvres de démonstration vers des contenus modérés provenant d'un backend authentifié.
5. Brancher le catalogue de prix, le checkout, les abonnements et les webhooks de paiement. Protéger les écritures globales et l'inventaire.
6. Remplacer les anciennes cartes de tarifs de la page publique seulement lorsque le moteur de placement, le stock et la facturation seront réellement synchronisés.

## Vérifications

- `node --test empty-museum/commerce-model.test.mjs`
- `node .github/scripts/tem-commerce-e2e.mjs` avec Playwright et le site servi localement sur le port 8765.
- Intégration à `.github/workflows/museum-3d-checks.yml` pour rejouer les tests lors de modifications.

Le système reste volontairement **isolé** de la visite publique pendant cette phase de conception commerciale.
