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

## Salle témoin photoréaliste — décision du 10 novembre 2026

- Décision : une **seule salle témoin isolée**, non branchée sur la galerie publique, pour que Guillaume valide le rendu avant toute extension. Elle n’est pas déployée et ne remplace pas `?visit=immersive`.
- Adresse : `/empty-museum/salle-temoin.html`, aussi ouverte par `?visit=salle-temoin` (redirection, sans charger le moteur public).
- Approche : **nouvelle scène**, pas la PR #35. Cette PR reste une boîte blanche en microciment, à ~27 px/m, et son script passe `export_colors`, rejeté par Blender 4.2. La salle témoin est une nef de palais du XIXe : voûte vitrée à laylight (5000 K, pas de soleil), champs d’accrochage rouge pompéien `#7A2E2E` entre pilastres de pierre, parquet de Versailles (losange) calé sur la trame.
- Trame : baie de **3,50 m = pilastre 0,50 m + champ 3,00 m** (un module commercial). Parquet : panneaux de **3,50/3 m**, trois par baie. Un mur présente les 5 formats ; un socle S01 fait **1,80 × 1,50 m**, objet sous **2,50 m**. Aucun pilastre ni la porte ne traverse un cadre (test automatique).
- Éclairage : bake Cycles (diffus direct + indirect, couleur désactivée), débruité OpenImageDenoise, sans soleil et sans monde. Les œuvres louées et l’ombre du socle restent temps réel ; le mobile n’ajoute pas cette ombre dynamique.
- État : **proposé dans une PR brouillon, pas fusionné, pas déployé.** La galerie publique conserve ses défauts connus jusqu’à validation visuelle.
- Quatrième passage. Chaque lame du parquet a son îlot UV et un fil droit (scan Poly Haven `fine_grained_wood`, éclairci en chêne), joints d’environ 1,6 mm. Le rouge est `#7A2E2E` avec un motif de damas à ~55 cm, une normale de tissage et un sheen. La voûte a quatre rangs de caissons en retrait, la corniche des modillons dorés, le socle un piédestal mouluré. Les grands cadres font 16 cm, profil lissé en 14 échantillons. Exposition 1,12. La banquette est capitonnée.
- Cinquième passage, mêmes branche et PR brouillon, pas de fusion. Le lightmap du quatrième passage était coloré (rebond du mur rouge et spots à 3000 K) alors que le passe « couleur » du bake était coupé : c’est ce qui poussait les murs vers un cramoisi et le chêne vers l’orange. Le bake est maintenant ramené à la luminance, les albédos KTX2 sont en sRGB (transfert 2) et les cartes de données en linéaire (transfert 1, `NoColorSpace`). Un test rend un aplat `#7A2E2E` sous lumière neutre et exige ΔE < 8 de la valeur ACES. Le parquet est le placage `white_oak_veneer` (Poly Haven, CC0, 0,50 m), réchauffé en chêne, fil droit, joints géométriques d’environ 1,6 mm. Les caissons sont un plâtre `#E8E0D0` avec filet doré ; le creux est dans la géométrie, l’éclairage du caisson est un ciel neutre parce que l’île du lightmap de la voûte reste noire. La banquette capitonnée est dans le GLB chargé par les deux paliers. Le damas est une rosace dessinée, ton sur ton, à l’échelle des 55 cm, plus un losange.
- Ce n’est pas encore au critère « on hésite entre la photo et le rendu ». Le damas est dessiné, pas une soie photographiée. Les caissons sont des panneaux de plâtre, pas des caissons sculptés et dorés. Le cadre reste une extrusion, avec une normale d’ornement sur la gorge. Le mur reste plus sombre et plus saturé que le nuancier `#7A2E2E` une fois passé dans ACES.
- Contrôle local (Chrome SwiftShader, pas un iPhone) : bureau **12 à 21 appels, 145,1 Mo**. Mobile **18 appels, 56,8 Mo**. Bake 48 échantillons. Sol du lightmap : médiane 0,44, maximum 0,57.

## Salle échantillon lumière — 11 novembre 2026

- Décision de Guillaume : une **salle échantillon isolée** qui reproduit la cible `cible-v3-02` (éclairage validé), sans l'étendre au musée et **sans pull request** tant qu'il ne l'a pas demandé.
- Branche : `feat/salle-echantillon-lumiere`, partie de la salle témoin (`cursor/salle-temoin-photoreal-f93e`). Elle ne modifie pas `main`, ni la PR #50, ni la PR #51.
- Adresse : `/empty-museum/salle-echantillon.html`, aussi `?visit=salle-echantillon`. La galerie publique (`index.html`, `engine3d.js`) ne la charge pas.
- La pièce est modélisée dans Blender 4.2 (corniche profilée, pilastres, cove, lanterneau à meneaux, rails et spots, cadres dorés à gorge, banquettes de pierre), éclairée en Cycles (lanterneau ~4700 K, un spot 3000 K par cadre, salle blanche au fond) puis réduite à une **lightmap de luminance**. Les albédos KTX2 restent en sRGB ; normales, rugosité et lightmap en `NoColorSpace`.
- Le parquet est un point de Hongrie continu à 45°, assemblé depuis le scan CC0 Poly Haven `wood_floor` (tuile unique de 6,3 m, KTX2). Les murs sont un bordeaux mat `#5A2C28`, sans damas. La lightmap est en luminance (rebond Cycles 2, spots 64° à 3000 K, lanterneau 4700 K), ACES dans le viewer.
- Troisième passage, même branche, toujours sans PR. Cadrage reculé (les grands cadres ne sont plus coupés), parquet miel satiné avec reflet planaire flou qui s'efface au premier plan, murs `#4A1E1F` relevés d'environ un demi-diaphragme, halos plus larges, plinthe sombre, lanterneau élargi.
- Contrôle local Chrome SwiftShader, pas un iPhone : bureau **16 appels, 6998 triangles, 186,7 Mo** décodés. Mobile 390 px : **14 appels, 6994 triangles, 67,6 Mo**, reflet en 160 px.
- Écart qui reste : le plafond n'est pas un caisson crème profond, les cadres ne sont pas une sculpture dorée, le reflet est encore un peu trop net, la porte du fond est un peu plus étroite que le cinquième de l'image. Un reflet flou haute définition et des moulures sculptées demandent une passe de flou et des cartes d'ornement, pas seulement le temps réel actuel.
- **Pas déployé. Pas fusionné. Pas une PR.** La commercialisation reste en démonstration.
- Le critère « on est dans la pièce » se juge sur les captures de la branche, pas sur un test unitaire.

## Salle blanche « no limit » — 11 novembre 2026

- Décision de Guillaume : la salle bordeaux est abandonnée pour l’échantillon. Une salle de marbre de Carrare, sans plafond et sans mur du fond, la remplace. Le musée entier ne change pas. **Pas de pull request**, pas de fusion, `main` et les PR #50 / #51 ne sont pas touchés.
- Branche : `feat/musee-blanc-nolimit`, partie de `feat/salle-echantillon-lumiere`. Adresse inchangée : `/empty-museum/salle-echantillon.html` et `?visit=salle-echantillon`. La galerie publique ne la charge pas.
- La pièce s’ouvre sur un ciel de nuages. Des blocs de marbre brut flottent dans l’axe. Les cadres dorés, les banquettes et les rails de spots restent aux mêmes places ; les banquettes sont en marbre blanc. Le sol est un marbre poli avec un reflet planaire. Le fond se dissout dans la brume. La lightmap Cycles est en luminance ; les halos 3000 K viennent des spots temps réel. Le ciel du viewer est le dôme peint, pas la lightmap.
- Un seul arrêt de visite (la caméra centrée, œil à 1,6 m) peut passer sur une photo 360° équirectangulaire Cycles, au moins 6144×3072, puis revenir à la marche.
- 2026-11-11 16:11 UTC. Le rendu 6144×3072 à 512 échantillons a été arrêté (tuile 2 sur 6, environ 1 h 45 déjà passées, encore environ 2 h 30). Les tuiles partielles et le journal sont dans `salle-echantillon/assets/cc0/pano-partial/`. Cette scène ne pouvait pas atteindre la photo : ciel bleu, veines non bookmatchées, rochers groupés, cadres extrudés.
- 2026-11-11 16:21 UTC. La version de « Le Dernier Bal » avec les enfants est annulée. Le fichier retenu est le couple âgé dansant, sans enfants (`salle-echantillon/assets/cc0/oeuvres/le-dernier-bal.jpg`). Les quatre autres œuvres de Guillaume viennent de `feat/museum-oeuvres-guillaume-5`.
- Le grand équirect 6144 n’est pas lancé tant que Guillaume n’a pas validé les composites basse définition. Une fois le feu vert donné, ce rendu (une seule tuile, plafond 384 échantillons, seuil 0,01, OIDN) prend environ **2 à 3 heures** sur les 4 cœurs de cette machine.
- 2026-11-11 16:30 UTC. Les 360° seront rendus avec des toiles blanches (diffus, rugosité d’une toile vernie). L’œuvre est plaquée ensuite : texture × passe d’éclairage diffuse + passe glossy, dans le masque de la toile. Changer l’image ne relance pas le rendu. Changer la taille ou le ratio d’un cadre, si. Manifeste d’arrêt : `review-renders/stop-manifest.json`. La version avec enfants de « Le Dernier Bal » est retirée.
- 2026-11-11 17:10 UTC. Le viewer ne met plus d’échelle négative sur le glTF. Cette échelle inversait la gauche et la droite et mettait les toiles en miroir. « Le Dernier Bal » est de nouveau sur le mur gauche, femme en rouge à gauche de la toile, comme le fichier source. Les passes d’éclairage du cadre ont été débruitées avec OpenImageDenoise, guidé par l’albédo et la normale. Leur somme (diffus + glossy) vaut environ 1,6 fois le beauty de la toile blanche : le placage demandé reste visiblement trop clair, un voile blanc. Le grand équirect 6144 n’est toujours pas lancé.
- Le cadre sculpté faisait 35 100 triangles, répété 10 fois (351 000), et les rochers ajoutaient environ 136 000. Le GPU en dessinait environ 527 000. Les trois cartes 4K du marbre, décodées, pesaient environ 192 Mo à elles seules, d’où les ~307 Mo. Après décimation (cadre ~2 500 faces, chaque rocher ~1 200) le mesh soumis vaut 45 641 triangles ; Chrome SwiftShader en dessine 34 851 au cadrage d’axe. Mémoire textures décodée : bureau 115 Mo, mobile 92 Mo. Les rochers ne lisent plus la lightmap (leurs îlots ne sont pas recalculés) et prennent la lumière du ciel.
- Deuxième passage, même branche, toujours sans PR. Le marbre est le scan CC0 ambientCG `Marble001` (4K). Le ciel est le HDRI CC0 Poly Haven `kloofendal_48d_partly_cloudy_puresky`. Les blocs sont les meshes CC0 Poly Haven `boulder_01`, `rock_07`, `rock_09`, `namaqualand_boulder_03`, habillés du même marbre, décimés pour la marche. Chaque toile a son image dans la scène Cycles. La photo 360 est en AgX Medium High Contrast, OIDN, 512 échantillons, avec un volume et un soleil le long de l’axe. La lightmap reste en luminance.
- Contrôle local Chrome SwiftShader, pas un iPhone. Marche bureau : **23 appels, 3964 triangles, 166,1 Mo** décodés, reflet planaire 512×288. Mobile 390 px : **21 appels, 3960 triangles, 55,8 Mo**, reflet 192 px. La photo 360 est un JPEG **6144×3072, 564 Ko**, 8 échantillons, débruitée, chargée en **62 ms** dans ce contrôle. Vidéo de marche 12,3 s (1,4 Mo) et passage en 360 (8,3 s).
- Écart qui reste, dit clairement : le ciel temps réel est un dôme peint, plus pâle que les nuages de la cible, et le rayon est une carte additive, pas un volume. Les blocs sont des cubes déplacés : ils se lisent comme des pierres à facettes, pas comme du marbre brut taillé. Le reflet du sol est planaire et basse définition ; le premier plan reste très clair. Les veines sont générées, larges et douces, pas une dalle bookmatch photographiée. Dans la photo 360, les deux grands cadres portent leur toile ; les petits cadres restent vides parce qu’ils partagent un atlas peint seulement par le viewer. Un marbre photographié, des rochers sculptés et un reflet flou haute définition rapprocheraient encore. Le temps réel actuel ne le fait pas tout seul.
- **Pas déployé. Pas fusionné. Pas une PR.** La commercialisation reste en démonstration.

## Galerie blanche — architecture décidée, pas encore construite — 14 novembre 2026

Décision de Guillaume, enregistrée seulement. **Aucun code, aucun mesh, aucune entrée dans `project-contract.json`.** L’échantillon actuel (environ 18 m, ouvert sur le ciel, sans mur du fond) n’est pas cette salle. Il ne faut pas le rallonger ni le figer à sa place.

- Une seule nef droite. Seule l’entrée a une forme différente.
- La première salle est gelée à **100 m** : entrée à `z = 0`, mur du fond réel à `z = 100`, porte d’environ **2,1 × 3,4 m**. Un retour en baïonnette juste derrière la porte cache tout ce qui suit. Sur chacun des deux murs courts de part et d’autre de la porte, un cadre face au visiteur (2 cadres en tout), comme sur la cible.
- Des salles modulaires identiques s’ajoutent après le retour, au fur et à mesure du remplissage. Le seuil d’occupation n’est pas choisi. Ajouter un module ne modifie ni les salles déjà construites ni leurs vues 360°.
- Quand Guillaume aura validé l’échantillon, les cotes de cette salle de 100 m seront écrites dans `project-contract.json`, avec un test qui échoue si elles changent. Pas avant.
- D’ici là, l’échantillon doit rester paramétrique (pas de baie, module de mur, dalles de marbre, ciel et lumière, kit cadre + spot) pour que la salle de 100 m et ses copies réutilisent les mêmes assets et le même éclairage. Le placage d’œuvre interchangeable reste par arrêt, afin que les 360° d’un module restent valables.

## Contradictions à résoudre (pas des fonctions terminées)
1. L'interface classique `index.html` / `app.js` utilise encore certaines durées et certains prix historiques alors que le nouveau configurateur fonctionne en mensuel/annuel. **Unifier l'offre avant de lancer les ventes.**
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
