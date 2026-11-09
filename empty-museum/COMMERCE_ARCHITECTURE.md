# THE UNREAL MUSEUM — Architecture commerciale modulaire (prototype V1)

## État réel

Ce développement ajoute un **simulateur d'administration** :
`commerce-configurator.html`, `commerce-admin.mjs` et `commerce-model.mjs`.
Le configurateur reste isolé du stock serveur et de la facturation ; une branche dédiée intègre désormais le découpage dans la scène 3D et actualise les cartes tarifaires publiques de démonstration. Il n'active **aucune** vente ni aucune réservation partagée. Les changements restent dans le navigateur utilisé, via localStorage. N'utilisez pas ce formulaire comme console d'administration sécurisée.

## Répartition retenue — scène de démonstration

Sur les 38 baies physiques, **4 baies partenaires non commercialisées** et **34 baies commercialisables**. Distribution des 34 : 8 très grands (1 cadre), 12 grands (2 cadres), 9 normaux (4 cadres), 4 moyens (8 cadres), 1 petit (16 cadres) = **116 cadres individuels**. Le fichier partagé `gallery-mix.js` donne la répartition déterministe, les tailles et les quatre coordonnées des stations 3D. Le simulateur d'administration reste local, et ses modifications ne sont pas automatiquement appliquées à la galerie publique.

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

### Tarifs de démonstration (affichés dans l'accueil sans paiement)

| Format | Nombre par module | Mensuel | Annuel |
|---|---:|---:|---:|
| Très grand | 1 | 59,50 € | 595 € |
| Grand | 2 | 34,50 € | 345 € |
| Normal | 4 | 19,50 € | 195 € |
| Moyen | 8 | 9,50 € | 95 € |
| Petit | 16 | 4,50 € | 45 € |

Les tarifs sont les montants de simulation divisés par deux sur demande, également affichés sur les offres publiques de démonstration. Aucun paiement réel n'est possible.

## Installations 3D premium dans l'allée

Le simulateur réutilise les quatre stations S01 à S04 de 1,80 m × 1,50 m au sol (2,70 m² chacune), hauteur maximale indicative de 2,50 m.
Exemples de créations : sculpture, modèle 3D, installation animée.
Chaque station peut accueillir **un seul objet pendant une période active**.
La réservation peut durer **1 journée (24 h), 1 semaine (7 jours), 1 mois (30 jours)**.
Le rayon de rendu est un **maximum configurable** et non une promesse de visibilité à travers les murs.
La plage de visibilité souscrite est enregistrée en instantané dans la réservation pour ne pas être modifiée rétroactivement.

### Tarifs initiaux de travail — premium

| Portée maximum | 1 jour | 7 jours | 30 jours |
|---|---:|---:|---:|
| Proximité : 15 m | 145 € | 645 € | 1 995 € |
| Galerie : 35 m | 295 € | 1 245 € | 3 995 € |
| Monumental : 75 m | 495 € | 2 495 € | 7 950 € |

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

1. **Effectué en branche de développement** : la galerie conserve son espacement physique de 3,5 m et attribue une surface commerciale de 3 m à chaque baie.
2. **Effectué en branche de développement** : 34 baies mixtes / 116 cadres, 4 baies partenaires hors vente ; les œuvres de démonstration historiques sont conservées sur la première subdivision de leur baie.
3. **Socles 3D rendus et redimensionnés en branche** : le studio local permet de choisir la durée et la portée, de simuler le prix et de masquer l'installation une fois la portée dépassée ou la durée expirée. Il reste à brancher l'autorité serveur, la facturation, un fondu progressif / LOD et les contrôles de performance sur iPhone.
4. Migrer les données des œuvres de démonstration vers des contenus modérés provenant d'un backend authentifié.
5. Brancher le catalogue de prix, le checkout, les abonnements et les webhooks de paiement. Protéger les écritures globales et l'inventaire.
6. **Démo actualisée en branche de développement** : les cartes affichent les tarifs divisés par deux, sans checkout et sans promesse de réservation réelle.

## Vérifications

- `node --test empty-museum/commerce-model.test.mjs empty-museum/gallery-mix.test.mjs`
- `node .github/scripts/tem-commerce-e2e.mjs` avec Playwright et le site servi localement sur le port 8765.
- Intégration à `.github/workflows/museum-3d-checks.yml` pour rejouer les tests lors de modifications.

Le système reste volontairement **isolé** de la visite publique pendant cette phase de conception commerciale.
