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
| Réalisme 3D | Rendu de musée physique très haut de gamme, sol crédible, éclairage et plaques réalistes | Moteur Three.js + Blender/PBR ; qualité du sol contestée ; PR #35 (salle témoin Cycles isolée) en cours de validation, non livrée au public |
| Navigation mobile | **Joystick gauche = regard, joystick droit = déplacement**, zoom dédié, multi-touch, changement de direction immédiat | PR #34 fusionnée dans main ; vérifier la publication et le comportement sur iPhone réel |
| Visite guidée | Depuis la position réelle, reprise vers l'œuvre la plus proche, priorité aux commandes manuelles | Code dans `engine3d.js`, `tour-journey.js` ; parcours navigateur à maintenir |
| Guide d’exposition grand public | Présenter des exemples concrets de créations murales et d’installations 3D, puis un parcours support → place → import et description → aperçu dans la démo | Ajout de la section `#how`, des CTA vers les éditeurs et des tableaux de démonstration ; **aucune publication publique ni vente réelle** |
| Commercialisation murs | Modules de **3 m** découpés en **1/2/4/8/16** cadres, abonnement mensuel et annuel | Configurateur de démonstration dans `commerce-model.mjs` |
| Objets dans l'allée | Sculptures/installations 3D ; visible selon distance ; durées jour/semaine/mois, offre premium | Configuration de démonstration, **pas de réservation/paiement réels** |
| Sécurité | Ne jamais vendre sans stock serveur fiable, droits, modération, paiement et facturation | Chantier non terminé ; traitements de paiement non actifs |
| Qualité | Tests avant fusion, échec diagnostiqué, contrôle de la version exacte en ligne | Workflows 3D/smoke + contrôle de cohérence du registre |

## Présentation des offres d’exposition — décision du 9 novembre 2026
- Montrer dès l’accueil **ce qu’on peut exposer** : images IA, photos, dessins, affiches, textes, statues, objets et panneaux/enseignes 3D, avec illustrations explicitement signalées comme exemples.
- Expliquer clairement le parcours visiteur : **support → emplacement → import / titre / pseudo / description → aperçu démo**, puis préciser que la publication publique ne fonctionne pas encore.
- Afficher tous les **5 formats muraux** (petit à très grand, 16/8/4/2/1 cadres par module de 3 m) avec tarifs mensuels et annuels du **simulateur `commerce-model.mjs`**. Les prix historiques de `app.js` ne sont pas remplacés ici ; cette contradiction reste ouverte avant tout lancement.
- Pour les installations en allée, distinguer trois niveaux de portée (proximité/galerie/monumental) et afficher les tarifs indicatifs d’**une journée** et de **30 jours** du même simulateur ; l’**année** est une simple **projection visuelle (10 × tarif 30 jours)**, non contractualisée, et doit toujours être signalée comme non réservable. Une vraie durée 365 jours nécessitera modèle, inventaire serveur et parcours de réservation adaptés.
- Les exemples sont fictifs ; les tarifs sont simulés ; absence de paiement, de publication publique et de contrôle serveur : ne jamais présenter ces fonctionnalités comme disponibles avant validation technique et juridique.

## Contradictions à résoudre (pas des fonctions terminées)
1. L'interface classique `index.html` / `app.js` utilise encore certaines durées et certains prix historiques alors que le nouveau configurateur fonctionne en mensuel/annuel. **Unifier l'offre avant de lancer les ventes.**
2. Le double joystick de PR #34 a été fusionnée ; les contrôles navigateur CI ont été exercés, mais la validation sur iPhone réel et la correspondance du déploiement exact restent nécessaires.
3. Le sol et l'accueil restent insatisfaisants visuellement malgré les tests logiciels ; validation visuelle nécessaire.
4. PR #34 navigation et #37 accueil sont fusionnées ; PR #35 photoréalisme reste ouverte, synchronisée le 9 novembre avec la sécurité #38 sur `main` ; préserver ses six fichiers isolés et vérifier ses CI avant une éventuelle fusion. Le prototype n'est pas encore intégré à la galerie publique.

## Fiabilité du chargement immersif — correctif proposé
- Incident confirmé sur le contrôle public du 9 novembre : `luxury-v8.js` a temporairement répondu HTTP 503 sur desktop, déclenchant le secours 2D. Le mobile a ensuite réussi. L'origine de l'erreur HTTP n'est pas confirmée ; un test source vert ne garantit pas la disponibilité du CDN.
- Une modification isolée propose une unique récupération après un échec réseau de chargement des modules ; un défaut persistant ou une erreur de code reste détectable et utilise le secours 2D. Ne considérer la reprise comme effective qu'après CI et déploiement du SHA précis.

## Politique de modifications et d'alertes
- Réutiliser le registre avant toute modification ; compléter les décisions utiles après une discussion et lors de la livraison.
- En cas de CI rouge : examiner le **premier échec réel** dans les logs, corriger sa cause, valider à nouveau ; ne pas couper les notifications, ne pas rendre le test facultatif.
- Cause retrouvée le 09/11 : le test du configurateur utilisait le sélecteur ambigu `[data-days="1"]` (1 bouton + 3 champs numériques). Correctif déjà présent sur `main` : cibler `button[data-days="1"]`. Une autre PR subit parfois un timeout de chargement du rendu Cycles ; investiguer/fiabiliser sans ignorer la validation.
- Le contrôle automatique de cohérence GitHub ne lit **pas** les conversations privées ChatGPT. Les nouvelles décisions doivent être réconciliées explicitement par l'agent qui travaille sur le projet.

## Sécurité — PR #38 fusionnée le 9 novembre 2026
- La PR #38 a été **fusionnée dans `main`** (commit `91e5d915`) : neutralisation des champs non fiables affichés en HTML, validation des œuvres mémorisées par le navigateur et limites des images importées.
- Tests de régression sécurité ajoutés aux contrôles CI/quotidiens. Les tests 3D et de cohérence de la branche #38 avaient réussi ; les contrôles post-fusion doivent être consultés pour la révision exacte de `main`.
- **La commercialisation demeure en démonstration.** Aucun compte administrateur, paiement réel ni publication serveur ne doit être activé sans autorisations serveur, modération, vérification des règles RLS effectivement déployées et audit des en-têtes HTTP.
- Référence de sécurité : `empty-museum/docs/SECURITY.md` ; la validation finale exige tests PR puis contrôles de déploiement de la révision exacte.

## Protection des fusions de `main` — 9 novembre 2026

- Décision : un seul statut **`Museum PR quality gate`**, toujours présent sur les PR vers `main`, doit devenir obligatoire dans GitHub.
- Les PR qui modifient le musée exigent à la fois la validation des modules, de la cohérence, de la sécurité, du configurateur et le rendu de navigation desktop/mobile. Les PR sans changement du musée ne sont pas soumises aux tests 3D lourds.
- La PR `feature/museum-required-main-gate-20261109` prépare le contrôle fail-closed et sa documentation. **La protection n'est PAS encore active** tant qu'un administrateur GitHub n'a pas appliqué une règle à `main` exigeant `Museum PR quality gate`.
- Guide d'activation et vérification : `.github/MUSEUM_MAIN_PROTECTION.md`.
- Interdiction de fusionner cette PR avant tous ses checks verts ; ne jamais considérer un simple workflow comme équivalent à une protection de branche.

## Renforcement de la coordination — 9 novembre 2026
- Contrôler les références statiques réellement chargées par l'entrée, le moteur 3D et les styles associés pour détecter les dépendances locales manquantes avant fusion.
- Vérifier le contrat des deux joysticks + zoom, la priorité des commandes manuelles et la présence des tests de sécurité dans les pipelines.
- Exécuter des jeux de tests positifs **et négatifs** du garde-fou : un contrôle qui ne sait pas échouer lors d'une rupture simulée ne fournit aucune garantie.
- Les tests statiques ne prouvent ni la qualité visuelle ni le succès de publication. Utiliser séparément Playwright et la vérification du déploiement GitHub Pages correspondant au SHA exact.
