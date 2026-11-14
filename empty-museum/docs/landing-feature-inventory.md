# Inventaire de l’accueil — avant / après les corrections du 14 novembre 2026

Mesuré sur la branche `proposal/landing-blanche-nolimit` avant et après les points d’audit 1, 2, 4 à 13. Le fichier `AUDIT.md` joint à la demande n’était pas dans l’espace de travail : l’inventaire est celui de la page elle-même (titres, liens, dialogues, grilles, marque). Les points 3, 14 et 15 ne sont pas appliqués. Le point 16 (minification) est écarté : Pages sert les sources sans build.

| Fonction | Avant | Après |
| --- | --- | --- |
| Titre « The Unreal Museum — l’irréel a trouvé son musée » | présent | présent |
| Image héro `salle-blanche-hero-1920x840.jpg` | présente | présente, non régénérée |
| Légende « Image de direction artistique · la visite 3D évolue vers cet univers » | le complément était masqué sur mobile | entière, y compris sur mobile |
| Marque ™ dans la visite (`THE UNREAL MUSEUM` + TM) | présente | présente |
| Bandeau « VERSION DÉMONSTRATION · Œuvres d’exemple fictives · Ajouts visibles uniquement sur votre appareil · Aucun paiement » | présent | présent, plus compact |
| Quatre liens de visite (`?visit=immersive`) | « Entrer », « Entrer → », « Démarrer la visite → », « Visiter le musée → » | les quatre boutons restent ; libellé unifié « Entrer dans le musée » |
| Bouton d’en-tête mobile à côté du menu | masqué | visible |
| Navigation Exposer / L’offre / Le parcours, menu mobile | présente | présente |
| Sections : exposer, quatre types d’œuvres, parcours, offre, cadres, allée 3D, plafond, démonstration, final | présentes | présentes |
| Grille cadres, 5 lignes, prix inchangés | présente | présente ; colonne « Par module » visible sur mobile |
| Grille allée, 6 portées, 18 tarifs | présente | présente ; 4 colonnes lisibles sur mobile |
| Plafond C01–C03 sans prix | présent | présent |
| Offre Mur total | absente | absente |
| Filtres Tout, Image, 3D, Design, Fabriqué, Mots, Insolite | présents (hauteur 40 px) | présents, cible 44 px |
| Boutons « Découvrir au hasard » et « Revenir au début » | présents | présents, cible 44 px |
| Dialogues sol, œuvre, exposition, partage | présents | présents |
| Mot-marque vers le haut de page | `#top` (sous l’en-tête) | `#page-top`, défilement à 0 |
| Moteur 3D au premier affichage | chargé tout de suite | seulement au clic ou à l’URL `?visit=immersive` (et ancres de visite) ; la visite s’ouvre comme avant |
| CSS de visite `walk.css` | dans le premier rendu | chargée avec le moteur |
