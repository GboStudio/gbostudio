# THE EMPTY MUSEUM — scanned PBR & GI

## Publié sur GBO Studio

- `/empty-museum/` — musée principal, moteur Three.js, scénographie complète et fallback 2D
- `/empty-museum/3d.html` — visite 3D architecturale supplémentaire
- `/empty-museum/pbr-scanned.js` — amélioration **du moteur 3D principal** avec PBR scannés

## État technique

### Disponible directement
- Surfaces blanc plâtre mat et pierre marbre par Poly Haven (CC0).
- Albedo/diffuse en sRGB, normal en données linéaires, roughness linéaire.
- Chargement asynchrone et repli sur les matériaux procéduraux existants en cas d'échec CDN.
- Réglages de résolution mobile et limitation du ratio de pixels.
- Spots orientés vers les œuvres, matériaux physiques, tonemapping ACES, reflets PMREM.
- Éclairage d'appoint statique / cartes d'illumination **approximatives** dans la visite `3d.html`.

### Non encore réalisé dans la version déployée
- **Vraie GI baked par path tracing dans Blender**. Le fichier `bake_gallery.py` fournit le pipeline Cycles pour la générer, mais les textures calculées en sortie ne sont pas encore intégrées car Blender n'est pas disponible dans l'environnement d'édition.
- Self-hosting des JPG scannés : actuellement les textures sont lues depuis Poly Haven, avec fallback en cas d'échec.
- Paiement Stripe, stockage cloud des créations et modération. La page reste une démo.

Il serait techniquement faux de présenter la lightmap procédurale comme une GI Cycles réellement baked.

## Assets PBR (CC0)

- [White Plaster 02](https://polyhaven.com/a/white_plaster_02) (Rob Tuytel), murs très légèrement granuleux.
- [Marble 01](https://polyhaven.com/a/marble_01) (Rob Tuytel), sol beige/crème poli.
- [Licence Poly Haven](https://polyhaven.com/license), y compris usage commercial.

Format du CDN public utilisé :
```
https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/<asset>/<asset>_diff_1k.jpg
https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/<asset>/<asset>_nor_gl_1k.jpg
https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/<asset>/<asset>_rough_1k.jpg
```
Ne jamais déclarer qu'un fichier CDN est disponible sans avoir vérifié la réponse HTTP et le CORS côté navigateur. Le code dispose d'un repli.

## Passer à une vraie GI précalculée

1. Ouvrir Blender 4.2+ sur Mac/PC avec Cycles activé.
2. Exécuter `blender --background --python bake_gallery.py -- /chemin/vers/output`.
3. Le script produit les textures `gi_wall.png`, `gi_floor.png`, `gi_ceiling.png` et un rapport JSON.
4. Importer ces PNG dans `/empty-museum/assets/gi/` et mettre en place UV2/lightMap dans Three.js.
5. Re-baker après modifications du volume architectural ou des luminaires fixes, pas à chaque nouvelle œuvre.

**Attention** : la vraie lightmap doit correspondre à la géométrie et aux UV2 du mesh final. Le script est un outillage de base, non un bake validé sur le moteur existant.

## Performance

- Desktop: 1.75x pixel ratio max dans la visite 3D
- Mobile: 1.45x max
- Désactiver les ombres dynamiques dans la visite complémentaire, garder l'éclairage indirect approximatif
- La visite principale possède un fallback 2D sur navigateurs sans WebGL

## Vérifications avant commercialisation

- Vérifier le bon chargement de toutes les textures PBR en DevTools et éviter le mix incorrect de map normal OpenGL / DirectX.
- Tester iPhone et Safari WebGL, erreurs de chargement CORS et temps de chargement.
- Ne pas monétiser en démo ; connecter une authentification, la modération et Stripe côté serveur.
