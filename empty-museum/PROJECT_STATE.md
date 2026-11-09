# THE UNREAL MUSEUM — registre central du projet

Mis en place le **9 novembre 2026**. Ce document sert de référence commune entre discussions, agents et modifications GitHub. Il ne constitue pas une preuve de mise en production.

## Source de vérité et principe de version
- Produit : **THE UNREAL MUSEUM** (ancien nom : The Empty Museum).
- Dépôt unique : `GboStudio/gbostudio`, branche `main`, dossier `empty-museum/`.
- Entrée : `/empty-museum/`. Visite immersive : `/empty-museum/?visit=immersive`. `3d.html` renvoie à cette visite.
- **Version publiée = commit SHA précis de `main` une fois déployé sur GitHub Pages**, et non « v3 / v4 / v5 » dans les noms de composants.
- Ne jamais fusionner deux branches fonctionnelles en écrasant la plus récente. L'intégration doit passer par vérification de la base commune, conflits et tests.

## Décisions connues par domaine
| Domaine | Décision actée | État / prochaine vérification |
| --- | --- | --- |
| Accueil | Entrée spectaculaire, premium, mobile et desktop | Accueil existant sur `main` non accepté visuellement ; PR #37 fusionnée dans main (accueil révisé, validation visuelle toujours nécessaire) |
| Réalisme 3D | Rendu de musée physique très haut de gamme, sol crédible, éclairage et plaques réalistes | Moteur Three.js + Blender/PBR ; qualité du sol contestée ; PR #35 en cours |
| Navigation mobile | **Joystick gauche = regard, joystick droit = déplacement**, zoom dédié, multi-touch, changement de direction immédiat | PR #34 fusionnée dans main ; vérifier la publication et le comportement sur iPhone réel |
| Visite guidée | Depuis la position réelle, reprise vers l'œuvre la plus proche, priorité aux commandes manuelles | Code dans `engine3d.js`, `tour-journey.js` ; parcours navigateur à maintenir |
| Commercialisation murs | Modules de **3 m** découpés en **1/2/4/8/16** cadres, abonnement mensuel et annuel. Répartition **8 très grands, 12 grands, 9 normaux, 4 moyens, 1 petit** sur 34 baies et 4 baies partenaires (116 cadres). Prix / 2. | Branche `feat/museum-gallery-mix-four-premium-half-prices` (PR à valider) ; catalogue `commerce-model.mjs` + rendu `gallery-mix.js`, `engine3d.js` |
| Objets dans l'allée | **4 places S01-S04**, socles **1,80 × 1,50 m** et hauteur maximale proposée **2,50 m**, à gauche/droite de l'allée, statues/affiches 3D ; portée et tarifs divisés par deux, journée/semaine/mois | Branche d'intégration ci-dessus, **pas de réservation/paiement réels** ; portée et expiration locales désormais appliquées aux installations de démonstration par le moteur 3D (sans vente ni réservation serveur) |
| Sécurité | Ne jamais vendre sans stock serveur fiable, droits, modération, paiement et facturation | Chantier non terminé ; traitements de paiement non actifs |
| Qualité | Tests avant fusion, échec diagnostiqué, contrôle de la version exacte en ligne | Workflows 3D/smoke + contrôle de cohérence du registre |

## Décision du 9 novembre 2026 — architecture d'exposition
- Répartition approuvée proposée par l'assistant, demandée à implémenter avec le nouveau musée : 38 baies physiques espacées de 3,5 m, chacune présentant jusqu'à 3 m de surface commerciale ; 4 réservées aux partenaires, 34 ouvertes aux 116 cadres.
- Les **34 modules commercialisables** sont répartis de façon variée pour maintenir une scénographie muséale (8/12/9/4/1 des formats 1/2/4/8/16).
- **Tous les tarifs de référence divisés par deux**, cadres mensuels et annuels, premium jour/semaine/mois, et anciens prix visibles sur la démo (plafond, sol), sans activer de paiement.
- **Quatre places** pour une sculpture, affiche ou objet 3D dans l'allée : **1,80 × 1,50 m** ; proposition de hauteur maximale **2,50 m**. Implantation latérale pour préserver l'axe de visite.
- **État de livraison** : changements en branche et tests locaux de modèle réalisés, pas encore approuvés/fusionnés/testés sur iPhone ni prouvés déployés.

## Contradictions à résoudre (pas des fonctions terminées)
1. L'interface classique `index.html` / `app.js` utilise encore certaines durées et certains prix historiques alors que le nouveau configurateur fonctionne en mensuel/annuel. **Unifier l'offre avant de lancer les ventes.**
2. Le double joystick de PR #34 a été fusionnée ; les contrôles navigateur CI ont été exercés, mais la validation sur iPhone réel et la correspondance du déploiement exact restent nécessaires.
3. Le sol et l'accueil restent insatisfaisants visuellement malgré les tests logiciels ; validation visuelle nécessaire.
4. PR #34 navigation et #37 accueil sont fusionnées ; PR #35 photoréalisme reste ouverte : préserver les fonctions fusionnées et refaire les tests lors de l'intégration.

## Politique de modifications et d'alertes
- Réutiliser le registre avant toute modification ; compléter les décisions utiles après une discussion et lors de la livraison.
- En cas de CI rouge : examiner le **premier échec réel** dans les logs, corriger sa cause, valider à nouveau ; ne pas couper les notifications, ne pas rendre le test facultatif.
- Cause retrouvée le 09/11 : le test du configurateur utilisait le sélecteur ambigu `[data-days="1"]` (1 bouton + 3 champs numériques). Correctif déjà présent sur `main` : cibler `button[data-days="1"]`. Une autre PR subit parfois un timeout de chargement du rendu Cycles ; investiguer/fiabiliser sans ignorer la validation.
- Le contrôle automatique de cohérence GitHub ne lit **pas** les conversations privées ChatGPT. Les nouvelles décisions doivent être réconciliées explicitement par l'agent qui travaille sur le projet.
