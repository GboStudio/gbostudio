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

## Présentation des offres d’exposition — décision du 9 novembre 2026
- Montrer dès l’accueil **ce qu’on peut exposer** : images IA, photos, dessins, affiches, textes, statues, objets et panneaux/enseignes 3D, avec illustrations explicitement signalées comme exemples.
- Expliquer clairement le parcours visiteur : **support → emplacement → import / titre / pseudo / description → aperçu démo**, puis préciser que la publication publique ne fonctionne pas encore.
- Afficher tous les **5 formats muraux** (petit à très grand, 16/8/4/2/1 cadres par module de 3 m) avec tarifs mensuels et annuels du **simulateur `commerce-model.mjs`**. Les prix historiques de `app.js` ne sont pas remplacés ici ; cette contradiction reste ouverte avant tout lancement.
- Pour les installations en allée, distinguer trois niveaux de portée (proximité/galerie/monumental) et afficher les tarifs indicatifs d’**une journée** et de **30 jours** du même simulateur ; l’**année** est une simple **projection visuelle (10 × tarif 30 jours)**, non contractualisée, et doit toujours être signalée comme non réservable. Une vraie durée 365 jours nécessitera modèle, inventaire serveur et parcours de réservation adaptés.
- Les exemples sont fictifs ; les tarifs sont simulés ; absence de paiement, de publication publique et de contrôle serveur : ne jamais présenter ces fonctionnalités comme disponibles avant validation technique et juridique.

## Contradictions à résoudre (pas des fonctions terminées)
1. L'interface classique `index.html` / `app.js` utilise encore certaines durées et certains prix historiques alors que le nouveau configurateur fonctionne en mensuel/annuel. **Unifier l'offre avant de lancer les ventes.** (Corrigé dans la branche proposée `proposal/landing-blanche-nolimit`, non fusionnée : voir la section du 11 novembre.)
2. Le double joystick de PR #34 a été fusionnée ; les contrôles navigateur CI ont été exercés, mais la validation sur iPhone réel et la correspondance du déploiement exact restent nécessaires.
3. Le sol et l'accueil restent insatisfaisants visuellement malgré les tests logiciels ; validation visuelle nécessaire.
4. PR #34 navigation et #37 accueil sont fusionnées ; PR #35 photoréalisme reste ouverte, synchronisée le 9 novembre avec la sécurité #38 sur `main` ; préserver ses six fichiers isolés et vérifier ses CI avant une éventuelle fusion. Le prototype n'est pas encore intégré à la galerie publique.

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

## Proposition d’accueil « grand musée » — 10 novembre 2026 (proposée, non fusionnée)
- Branche `proposal/landing-premium` : refonte de `empty-museum/index.html` (typographie Cormorant Garamond + Inter auto-hébergées, menu mobile accessible, emplacements visuels réservés « Visuel de la salle témoin à venir », offre créateurs, parcours en 4 étapes, mentions DÉMO conservées).
- Aucun visuel inventé : seuls les rendus validés de la salle témoin rempliront les emplacements réservés. Le mur d’exemples fictifs de la démo est replié par défaut.
- Corrections incluses : débordement horizontal mobile des tableaux de tarifs, balises og:/twitter:, canonical, favicon, entrée sitemap, nom « Empty Museum » visible retiré (carte d’accueil du studio, nom du fichier téléchargé), libellés anglais traduits, logo unifié, aria-label des tuiles.
- Plafond : les prix 9,95 / 14,95 / 20 € (absents du modèle commercial) sont remplacés par « Tarif à définir » sur l’accueil ; `app.js` conserve ses prix historiques (contradiction n° 1 toujours ouverte). Supplanté le 11 novembre pour C01–C03 : plus aucune mention de tarif (voir la décision du jour sur la PR #52).
- État : **proposé** — ni fusionné, ni déployé ; validation visuelle de Guillaume requise.

## Direction artistique « blanche no limit » — 11 novembre 2026 (proposée, non fusionnée)
- Décision de Guillaume relayée par le coordinateur : « Oui, la version blanche no limit remplace la salle classique pour tout le musée » ; « Oui go » pour aligner la page marketing. Image cible validée : galerie en marbre de Carrare blanc, plafond ouvert sur un ciel lumineux, blocs de marbre en apesanteur, sol miroir, cadres dorés sous spots chauds (grandiose, serein, rien de religieux).
- Branche locale `proposal/landing-blanche-nolimit` (partant de `proposal/landing-premium`, PR brouillon #49) : accueil refondu en blanc / marbre / or. Hero = image cible recadrée (16:7 desktop, 1:1 mobile, WebP + JPEG en `srcset`, `assets/direction/`), signalée « Image de direction artistique · la visite 3D évolue vers cet univers ». Aucun autre visuel généré ; ambiances en CSS (dégradés ciel, veinage léger, filets or). Image de partage `assets/og/partage-salle-blanche.jpg` recadrée de la même image.
- Accroches : « L’irréel a trouvé son musée. », « Ici, rien ne pèse… l’imaginaire n’a plus de limite. », « Ce qui n’existe nulle part a sa place ici. », « L’imaginaire sans limite, des places comptées. », « Entrez dans l’irréel. ».
- Tarifs : grille de `commerce-model.mjs` conservée sans changement de montant (décision de Guillaume). Les prix historiques en dur de `app.js` (4,95 / 9,95 / 15 / 249,50 / 14,95 / 20 €) et de `walk.js` (499 €) sont supprimés : cadres muraux = miroir `gallery-mix.js` vérifié identique au modèle par test ; sol = `floor.js` via `aislePrice()` ; anciens formats = « Tarif à définir ». Le plafond et l’offre de mur entier sont précisés dans la décision suivante. Libellés 3D « € / 12 MOIS » erronés pour un tarif mensuel remplacés par « € / MOIS ». **Contradiction n° 1 résolue dans cette branche uniquement**, tant qu’elle n’est pas fusionnée.
- Limites : l’image source fait 1280 × 720 ; les déclinaisons 2880 × 1260 et 1170 × 1170 sont agrandies (≈ × 2,25 et × 1,6). Un master haute définition de la salle cible est nécessaire avant publication. La visite 3D publique n’a pas encore ce rendu. L’image d’accueil n’est pas régénérée : le master HD attend le rendu réel du moteur 3D.
- État : **proposé** dans la PR brouillon #52 — non fusionné, non déployé ; validation visuelle de Guillaume requise.

## Décision du 11 novembre 2026 — cadres, allée 3D, plafond, pas de mur entier (PR brouillon #52, non fusionnée)
- Décision de Guillaume : « Ils peuvent pas acheter le mur mais les différentes tailles de cadres » ; « Les œuvres 3D aussi à mettre dans l'allée » ; « On vend ça aussi » ; « On vend les œuvres 3 d aussi » ; « Les prix étaient sur la page qui présente les prix ».
- On vend les cinq tailles de cadres et les quatre emplacements 3D S01–S04 dans l’allée. Les cadres gardent la grille du site en ligne. Les spots 3D passent à la grille à six portées validée par Guillaume (15, 25, 35, 45, 55 et 75 m), lue uniquement dans `commerce-model.mjs` et affichée dans `#pricing`. Les identifiants `near`, `gallery` et `landmark` restent ceux de 15, 35 et 75 m. Le site en ligne a encore l’ancienne grille à trois portées.
- Il n’y a plus d’offre « Mur total » sur l’accueil, ni de fonction `wholeWallPrice`. Le site en ligne (`main`) affiche encore cette offre avec « prix sur proposition » ; elle est retirée seulement dans cette PR.
- Plafond C01, C02 et C03 : emplacements conservés, sans prix. Le site en ligne affiche encore 9,95 €, 14,95 € et 20 €, absents du modèle ; cet écart n’est pas recopié ici.
- La marque ™ est conservée. L’image d’accueil n’est pas modifiée ; le master HD attend le rendu réel du moteur 3D.
- État : proposé dans la PR brouillon #52, **non fusionné**, non déployé.

## Corrections d’accueil du 14 novembre 2026 (PR brouillon #52, non fusionnée)
- Décision de Guillaume : « Oui, lance toutes les corrections sauf celles qui attendent la 4K ». Les points 3 et 15 (master 4K) et 14 (hors page marketing) ne sont pas appliqués.
- Le moteur 3D, Three.js, le GLB d’entrée et les textures Polyhaven ne se chargent qu’au clic d’un lien `?visit=immersive`, à l’arrivée sur cette URL, ou sur une ancre de visite. `engine3d.js` et `engine-loader.js` ne sont pas modifiés.
- Les ancres `#visite`, `#visit`, `#tour`, `#walk` et `#visite-3d` réécrivent d’abord l’adresse en `?visit=immersive` (l’ancre est conservée), puis chargent le moteur, pour que la visite s’ouvre. Un clic avec Ctrl, Cmd, Maj, Alt ou le bouton du milieu laisse le navigateur ouvrir un onglet sur `?visit=immersive`.
- Le hero (image, légende complète, deux boutons) tient au-dessus de la ligne de flottaison à 1280×800, 390×844 et 360×740. Le bouton « Entrer dans le musée » reste dans l’en-tête mobile. Les libellés de visite sont alignés, aucun bouton n’est retiré.
- Les colonnes « Par module » et les quatre colonnes de l’allée restent lisibles sur mobile. La légende validée est entière. Le bandeau DÉMO est plus compact, texte inchangé. Les ancres ont un `scroll-margin-top` ; le mot-marque ramène en haut de page.
- Les graisses 500/600 et l’italique sont dans `fonts-extended.css`, chargée après le premier rendu. La minification (point 16) n’est pas faite : GitHub Pages sert les fichiers tels quels, sans chaîne de build.
- Inventaire des fonctions : `empty-museum/docs/landing-feature-inventory.md`.
- État : proposé dans la PR brouillon #52, **non fusionné**, non déployé.

## Master 4K de l’accueil — 22 novembre 2026 (PR brouillon #52, non déployé)
- Guillaume : « La 4K me va : fais-la intégrer sur la page d'accueil (sans mise en ligne) ». Les points 3 et 15 de l’audit sont donc faits ici ; le point 14 (textes du moteur) reste hors de cette PR.
- Le hero lit le master validé 3840×2160, servi en AVIF, WebP et JPEG de repli (640 à 1920). Le JPEG 4K brut n’est pas une ressource de la page. Favicon 16 et 32, apple-touch 180 et image de partage 1200×630 en sont dérivés. `commerce-model.mjs` et les fichiers du moteur 3D ne changent pas.
- Rien n’est publié : la PR reste un brouillon.

## On ne parle pas de taille — 22 novembre 2026 (PR brouillon #52)
- Guillaume : « On ne parle pas de taille ». La statistique « 7,5 M / Longueur simulée de la galerie » devient « 2 / Visites, libre et guidée ». La visite guidée et le mode libre sont bien les deux modes du dock (`museum-v5.js`, non modifié).
- Les distances 15 à 75 m de la grille 3D et les cinq formats de cadres restent. Les mentions de longueur du lieu ont été retirées des textes d’accueil.

## Pièce d’origine, essai marbre en temps réel — 23 novembre 2026 (brouillon, non fusionné, non déployé)
- Demande de Guillaume : améliorer la pièce d’origine avec le look de la direction 4K, en version de test, fonctionnelle et soignée. Pas de panorama 360° (la PR #53 reste abandonnée). Pas de Blender ni de rendu hors ligne.
- La salle procédurale de `engine3d.js` garde la même longueur, le même pas de 3,50 m, les mêmes baies et les mêmes positions d’œuvres le long des murs. Visite libre, visite guidée, cadres, places d’allée, deux joysticks, zoom, secours `walk.js` et commerce en démonstration restent.
- Le rendu d’essai est derrière `enabled` dans `empty-museum/origin-room-look.js`. `false` rend le calcaire et les cadres précédents. Le marbre est un shader procédural (veines en coordonnées monde, sans image répétée). L’or est un PBR métallique (metalness 1, rugosité 0,32) éclairé par l’environnement déjà présent. Le sol miroir est un `Reflector` basse résolution (512 bureau, 256 mobile, un passage sur deux au mobile) fondu avec la distance. Le plafond central s’ouvre sur un ciel procédural. Aucune texture tierce n’est téléchargée.
- Les cadres sont plaqués à 1,5 cm du mur structurel, orientés vers l’allée. Le test `empty-museum/tests/flush-frames.test.mjs` vérifie les 4 baies partenaires et les 116 cadres, ainsi que le dégagement des pilastres.
- La barre de progression ne montre plus la longueur en mètres (`engine3d.js` et `walk.js`). Le curseur de position reste. Exemple attendu avec le stock de démo : « 6 CRÉATIONS · 114 PLACES LIBRES ».
- État : **proposé** dans une PR brouillon. Ni fusionné, ni déployé. La validation visuelle de Guillaume et une mesure sur téléphone réel restent ouvertes. Les prix restent des prix de démonstration.

## Second essai, salle plus construite — 27 novembre 2026 (même PR brouillon #54, non fusionné, non déployé)
- Guillaume : « je veux quelque chose de bien. Une vraie salle » et « que ça fonctionne », y compris le déplacement libre. Toujours un essai, pas une mise en ligne.
- Le déplacement libre (clavier, souris, deux joysticks) glisse contre les murs, les pilastres, les banquettes, les socles d’allée et les cadres. On ne traverse pas ces volumes et on peut revenir dans l’allée. La visite guidée s’arrête à la position courante.
- La coque (murs, plinthes, corniche, rails), les pilastres à base et chapiteau, les banquettes et les cadres vides sont fusionnés ou instanciés. Le miroir planaire (1024 px, environ 36 %) n’est calculé que sur ordinateur. Le mobile utilise l’environnement, ratio de pixels ≤ 1,25.
- Le marbre reste un shader procédural (veines diagonales). Pas de texture payante. Les veines ne sont pas encore un marbre de Carrare ramifié, et le reflet du sol ne renvoie pas les cadres avec la netteté de la référence.
- État : proposé dans la PR brouillon #54. Ni fusionné, ni déployé.

## Marbre CC0, exposition baissée, reflet — 27 novembre 2026 (même PR #54, non fusionné)
- Guillaume : « Go pour la passe visuelle : vrai marbre, moins d'exposition, reflet au sol ». Rien d’autre ne change : déplacement, collisions, joysticks, visite guidée, clic, instanciation.
- Le marbre procédural est remplacé par Marble012 d’ambientCG (CC0), albédo, normale et rugosité, 2K au bureau et 1K au mobile. Crédit : `empty-museum/assets/marble/CREDITS.md`.
- L’exposition ACES de l’essai passe à 0,72. Le miroir du bureau reste un `Reflector` 1024, plus lisible, et s’efface avec la distance. Le mobile garde l’environnement, sans second passage.
- État : proposé, non fusionné, non déployé.

## Ivoire et reflet latéral — 27 novembre 2026 (même PR #54, non fusionné)
- Guillaume : « Oui il faut être plus proche de la cible ». Passe visuelle seulement. Marble012 (CC0) est conservé, ramené vers l’ivoire `#f3eee6`, veines fines. L’exposition de l’essai est 0,86. Le miroir du bureau atténue le ciel et renforce le reflet près des murs. Le mobile ne prend pas de second passage.
- État : proposé, non fusionné, non déployé.

## Chantier 3D, jalon 1 — kit modelé et marbre blanc — 27 novembre 2026 (nouvelle PR brouillon, non fusionnée, non déployée)
- Guillaume : « Lance le chantier 3D avec de vrais éléments pour coller à la 4K ». Seulement le jalon 1 dans cette branche. Les jalons lumière, sol miroir net et ciel restent en attente d’un feu vert.
- Branche partie de `dbd7479` (`cursor/origin-room-marble-look-be39`). Le drapeau `enabled` de `origin-room-look.js` reste le retour arrière : `false` rend le calcaire précédent. Déplacement libre, collisions, joysticks, zoom, visite guidée, clic, commerce démo et `walk.js` ne sont pas retirés. Les boîtes de collision gardent leurs dimensions.
- `empty-museum/tools/build_kit.py` produit un glTF meshopt : pilastre (base et chapiteau), plinthe moulurée, corniche, panneau de mur en creux (deux largeurs réelles, 4,08 m et 0,92 m), banquette. UV0 pour le marbre, UV2 réservé au bake. Le moteur les instance aux positions actuelles.
- Marble012 est remplacé par Marble019 (ambientCG, CC0), le blanc veiné de gris le plus clair du comparatif. 2K bureau, 1K mobile. Crédit : `empty-museum/assets/marble/CREDITS.md`.
- Le shader du miroir atténue le ciel au centre. La tache blanche à l’entrée reste visible sur les captures : le reflet net des cadres et cette tache restent le jalon 3.
- État : proposé, non fusionné, non déployé. La validation visuelle de Guillaume reste ouverte.

## Chantier 3D, jalon 2 — lumière précalculée et halo chaud — 27 novembre 2026 (même PR brouillon #55, non fusionné, non déployé)
- Guillaume : « Oui, lance l'étape 2 : éclairage précalculé et lumière chaude sur les œuvres ». Le jalon 3 (reflet net, cadres ouvragés) n’est pas commencé.
- `empty-museum/tools/bake_kit_light.py` refait les pièces du kit et cuit, en quelques échantillons Cycles, une atlas WebP sur UV2 : occlusion de contact au pied des volumes et lumière douce venant du dessus. 1024 au bureau, 512 au mobile. Le drapeau `enabled` reste le retour arrière.
- Un halo chaud instancié éclaire le marbre au-dessus de chaque cadre. Sur mobile, le titre 3D et la ligne d’aide ne se superposent plus au bandeau.
- État : proposé, non fusionné, non déployé. Le jalon 3 suit dans la même PR.

## Chantier 3D, jalon 3 — reflet net et tache d’entrée — 27 novembre 2026 (même PR brouillon #55, non fusionné, non déployé)
- Guillaume : « Oui, lance l'étape 3 : reflet net au sol, zone blanche supprimée et titre mobile corrigé ». Le jalon 4 n’est pas commencé.
- Au bureau, le miroir planaire est fort près des murs et s’efface avec la distance. L’ouverture du plafond et le ciel en sont exclus. Le marbre du centre d’allée est un peu plus sombre pour ne plus brûler. Sur mobile, un reflet faux instancié remplace le second passage.
- L’inscription 3D du portail est cachée sur mobile, le bandeau la porte déjà. L’or des cadres est un peu plus chaud, sans appel de dessin en plus.
- État : proposé, non fusionné, non déployé.

## Mobile : ouverture refermée, marbre plus clair — 28 novembre 2026 (même PR brouillon #55, non fusionné, non déployé)
- Sur téléphone, les nuages ne descendent plus sur le mur du fond. Trois poutres de marbre traversent l’ouverture. Le marbre est plus clair. Le bureau ne change pas.
- État : proposé, non fusionné, non déployé.

## Mobile : marbre blanc, plafond cuit caché — 28 novembre 2026 (même PR brouillon #55, non fusionné, non déployé)
- Sur téléphone, le plafond cuit plat qui bouchait le ciel est caché. La chaleur du marbre passe par la lumière, plus légère : les murs ne sont plus sable. Le bureau ne change pas.
- État : proposé, non fusionné, non déployé.

## Mobile plus chaud — 28 novembre 2026 (même PR brouillon #55, non fusionné, non déployé)
- Sur téléphone seulement, le marbre des murs et du sol est teinté crème, et la lumière est plus chaude. Le bureau ne change pas. Le ciel et les nuages restent.
- État : proposé, non fusionné, non déployé.

## Vrais cumulus et mobile plus lumineux — 28 novembre 2026 (même PR brouillon #55, non fusionné, non déployé)
- Le ciel de l’ouverture est Kloofendal 38d (CC0), bleu avec des cumulus, plus des masses blanches à dessous gris-bleu. Le mobile est un peu plus clair et plus chaud (exposition 0,76). Pas de rochers. Le compteur ne change pas.
- État : proposé, non fusionné, non déployé.

## Ouverture moins brûlée, sans rochers — 28 novembre 2026 (même PR brouillon #55, non fusionné, non déployé)
- Les sept instances de Boulder 01 sont retirées, ainsi que le fichier et son crédit. Le plafond cuit de l’entrée, qui formait une bande beige granuleuse en regardant en haut, est un plâtre blanc uni dans cet essai. Le rayon est plus faible pour que le ciel et les nuages restent lisibles. Le mobile est un peu moins exposé (0,72). Le compteur et les panneaux partenaires ne changent pas.
- État : proposé, non fusionné, non déployé.

## Plafond, nuages, tableaux nets, rocher CC0 — 28 novembre 2026 (même PR brouillon #55, non fusionné, non déployé)
- Dernière des trois passes. Le dessous des bandes de plafond, près de l’ouverture, reçoit une lumière d’ambiance venue du ciel : il ne reste pas gris. Les cumulus sont plus denses et plus blancs, et le rayon diffus est plus lisible. Nuages, rayon et rochers restent hors du miroir.
- Les tableaux du domaine public passent à environ 1600 px au bureau et 768 px au mobile, avec mipmaps et filtrage anisotrope. Le compteur et le clic pour exposer ne changent pas. Les panneaux « The Partner Collection » non plus.
- Sept instances d’un seul scan CC0 Poly Haven (`boulder_01`, Rico Cilliers), maillage réduit, au bureau seulement. Le mobile ne le charge pas. Crédit : `assets/rocks/CREDITS.md`.
- Le test de visite guidée attend que la scène soit prête et que la visite soit vraiment lancée, puis exige toujours que la caméra avance de 0,2 m.
- État : proposé, non fusionné, non déployé.

## Huiles plus lisibles, sans rochers — 27 novembre 2026 (même PR brouillon #55, non fusionné, non déployé)
- Deuxième passe. Les cadres libres du hall montrent des huiles plus sombres, sans mapping de tons. Les rochers flottants sont retirés : ils ne lisaient pas comme du marbre. Le téléphone est un peu plus clair. Le plafond autour de l’ouverture aussi. Le compteur et le clic pour exposer ne changent pas.
- État : proposé, non fusionné, non déployé.

## Affichage des cadres libres — 27 novembre 2026 (même PR brouillon #55, non fusionné, non déployé)
- Guillaume autorise trois passes. Celle-ci pose une image du domaine public devant les cadres libres du hall, sans changer le compteur « 114 PLACES LIBRES » ni le clic pour exposer. Le mur du fond reprend Marble019. Le plafond est un peu plus large. Les spots chauds sont baissés. Cinq rochers blancs flottent au bureau seulement.
- État : proposé, non fusionné, non déployé.

## Grand hall d'entrée — 27 novembre 2026 (même PR brouillon #55, non fusionné, non déployé)
- Guillaume : « Oui, réorganise les emplacements dans les salles suivantes et fais le grand hall d'entrée comme la 4K ». Le hall d'entrée tient trois travées, avec un mur de fond éclairé, une porte sur le côté et un tableau au centre. Douze cadres d'origine y sont répartis (deux ou trois par travée et par côté, plus les deux grands de la première travée). Les autres gardent leur identifiant et continuent dans les salles derrière. Les 120 emplacements et les 12 tableaux ajoutés restent. Le socle S01 passe à gauche du hall pour laisser la porte libre.
- État : proposé, non fusionné, non déployé.

## Marbre réel et tableaux sur les murs du fond — 27 novembre 2026 (même PR brouillon #55, non fusionné, non déployé)
- Guillaume : « On pousse encore ». Les dalles du fond prennent le même Marble019 que les murs latéraux, en coordonnées monde, avec des joints clairs. Les douze cadres ajoutés montrent des tableaux du domaine public (crédit `assets/paintings/CREDITS.md`). Les 120 emplacements d’origine ne bougent pas.
- État : proposé, non fusionné, non déployé.

## Mobile, dalles du fond et plafond — 27 novembre 2026 (même PR brouillon #55, non fusionné, non déployé)
- Guillaume : « Go : mobile réparé, murs du fond avec dalles et œuvre, plafond lumineux ». L’exposition mobile de l’essai baisse, les ombres mobiles de cet essai sont coupées, et le téléphone ne dessine que le premier mur de l’enfilade. Les 120 cadres du commerce restent. Chaque mur du fond gagne des dalles en relief et un cadre en plus, testé à part. Le dessous du plafond est éclairci.
- État : proposé, non fusionné, non déployé.

## Salles fermées, dalles et sol uniforme — 27 novembre 2026 (même PR brouillon #55, non fusionné, non déployé)
- Guillaume : « Go : vraie salle avec mur du fond, murs en grandes dalles de marbre blanc, sol uniforme et nuages corrigés ». Les 120 cadres restent à leur place. La salle est une enfilade : un mur éclairé avec une porte tous les trois travées environ, le premier à 10,85 m (seul intervalle libre avant la sculpture d’allée). Le marbre Marble019 (CC0) est éclairci, veines plus larges, joints de dalles d’environ 1,5 × 3 m. Le sol n’a plus de bande grise ; le reflet est basse résolution. Les nuages sont coupés aux bords de l’ouverture.
- État : proposé, non fusionné, non déployé.

## Nuages en volume — 27 novembre 2026 (même PR brouillon #55, non fusionné, non déployé)
- Guillaume : « Pas encore, lance d'abord les nuages en volume 3D ». Devant la photo CC0, des sprites de cumulus (bruit, un seul appel instancié) occupent l’ouverture à plusieurs profondeurs. Le mobile en a moins. Ils sont exclus du miroir, comme le dôme et le rayon.
- État : proposé, non fusionné, non déployé.

## Ciel plus clair et titre 3D retiré — 27 novembre 2026 (même PR brouillon #55, non fusionné, non déployé)
- Guillaume : « Oui encore mieux allez ». Même ciel CC0 Kloofendal, éclairci et désaturé pour que l’ouverture soit un cumulus blanc plutôt qu’une bande bleue. Le rayon est plus large et plus diffus. L’inscription 3D « THE UNREAL MUSEUM » (portail et panneau flottant) est cachée dans cet essai, y compris dans le miroir, parce qu’elle se lisait à l’envers. Le titre HTML reste.
- État : proposé, non fusionné, non déployé.

## Ciel CC0 dans l’ouverture — 27 novembre 2026 (même PR brouillon #55, non fusionné, non déployé)
- Guillaume : « Avant la mise en ligne, fais le vrai ciel nuageux dans l'ouverture ». Seul le ciel change.
- L’ouverture lit Kloofendal 48d Partly Cloudy (Pure Sky) de Poly Haven, CC0, 2K au bureau et 1K au mobile. Crédit : `empty-museum/assets/sky/CREDITS.md`. Le rayon est quelques cartes additives sous la fente, exclues du miroir du sol avec le dôme.
- État : proposé, non fusionné, non déployé.

## Chantier 3D, jalon 4 — cadres, ciel et bande d’allée — 27 novembre 2026 (même PR brouillon #55, non fusionné, non déployé)
- Guillaume : « Oui, lance l'étape 4 : cadres ornementés, ciel nuageux avec rayon de lumière, bande centrale lissée et titre mobile corrigé ». Dernier jalon de cet essai. Rien n’est fusionné ni déployé.
- `empty-museum/tools/build_frames.py` produit une baguette sculptée et un coin à feuilles, instanciés sur les cadres existants. Le clic sur l’œuvre reste. Le ciel est un cumulus procédural (voir `assets/sky/CREDITS.md`) avec un rayon additif. La jonction entre l’allée mate et le miroir est un dégradé. Sur mobile, le second titre flottant est caché.
- État : proposé, non fusionné, non déployé.
