# Marbre Marble019

Texture PBR utilisée par l’essai visuel de la pièce d’origine (`origin-room-look.js`).

- Identifiant : Marble019
- Source : https://ambientcg.com/view?id=Marble019
- Auteur : ambientCG (Lennart Demes)
- Licence : CC0 1.0 — https://creativecommons.org/publicdomain/zero/1.0/
- Fichiers : albédo, normale OpenGL et rugosité, JPEG 2048 (bureau) et 1024 (mobile, réduit depuis le 2K)
- Choix : parmi les marbres CC0 d’ambientCG, c’est le blanc le plus clair qui garde des veines grises fines visibles (mesure du carré couleur : luminance moyenne ≈ 234). Marble012, plus gris, n’est plus chargé.

Le kit d’architecture (`empty-museum/assets/kit/origin-kit.glb`) n’est pas une ressource tierce : il est produit par `empty-museum/tools/build_kit.py`. Les cloisons et le plafond à caissons (`origin-partitions.glb`) sont produits par `empty-museum/tools/build_partitions.py` et reçoivent ce même marbre au chargement. Aucune texture payante.
