# GBO Studio — contrats d’URL de confidentialité

Ce fichier documente les URL publiques **à conserver à l’identique** lors de chaque refonte graphique et déploiement. Elles peuvent être renseignées dans les fiches App Store / Google Play ou accessibles depuis les applications.

| Application | URL canonique | Alias historique à conserver |
|---|---|---|
| Conscience | https://gbostudio.fr/conscience-privacy.html | https://gbostudio.fr/conscience-privacy/ |
| Kapsy | https://gbostudio.fr/kapsy-privacy.html | https://gbostudio.fr/kapsy-privacy/ |
| PanneGo | https://gbostudio.fr/pannego-privacy.html | https://gbostudio.fr/pannego-privacy/ |
| LaTeam | https://gbostudio.fr/lateam-privacy.html | https://gbostudio.fr/lateam-privacy/ |
| RusH | https://gbostudio.fr/rush-privacy.html | https://gbostudio.fr/rush-privacy/ |

## Adresses constatées sur les fiches App Store (à ne pas casser)

- **Conscience (Apple)** : `https://conscience-sigma.vercel.app/` — URL externe historique. Le site GBO Studio ne la remplace pas automatiquement ; la conserver accessible tant qu’elle est renseignée dans App Store Connect.
- **PanneGo (Apple)** : `https://gbostudio.fr/pannego-privacy` — sans extension ni barre finale. La route `/pannego-privacy/` et son `index.html` doivent continuer de fonctionner, y compris via redirection HTTP éventuelle.
- **Autres fiches App Store / Google Play** : vérifier les URL exactes dans les consoles avant toute migration. Ne pas présumer que toutes pointent vers les adresses canoniques ci-dessus.

Les URL générales ci-dessous restent également stables :

- https://gbostudio.fr/privacy.html
- https://gbostudio.fr/privacy/
- https://gbostudio.fr/data-deletion.html
- https://gbostudio.fr/data-deletion/

## Règles de déploiement

1. Ne pas renommer, déplacer ni supprimer les fichiers *-privacy.html, leurs pages index.html de redirection, ni les pages générales de confidentialité/suppression.
2. Ne pas modifier les URL App Store, Google Play ou les liens vers les politiques lors d’une simple refonte visuelle.
3. Les textes juridiques peuvent être mis à jour si nécessaire, mais sans changer leurs adresses.
4. Avant chaque publication : vérifier les HTTP 200 des URL canoniques et le bon fonctionnement des anciennes routes alias.
5. Inspecter le diff GitHub pour confirmer l’absence de modifications involontaires sur ces pages.

**V9, 30 octobre 2026 :** les pages de confidentialité, leurs redirections et les URL de support existantes sont volontairement exclues de la refonte.
