# Protection de `main` — GBO Studio / THE UNREAL MUSEUM

**À activer dans l'interface GitHub par le propriétaire du dépôt.**
Ce dépôt ne possède actuellement aucune protection active sur `main`. La connexion GitHub de cet agent permet de lire les règles, mais renvoie HTTP 403 sur l'administration des protections. Un workflow seul ne peut pas empêcher une fusion.

## Mise en place (après fusion de la PR ajoutant le contrôle)

1. Ouvrir [Settings → Rules → Rulesets](https://github.com/GboStudio/gbostudio/settings/rules).
2. Créer un **New branch ruleset**, le nommer `Main — vérification obligatoire`, l'appliquer à la branche **`main`**, et définir son statut sur **Active**.
3. Exiger une **pull request avant toute fusion**, et cocher l'option de **vérification des checks de statut avant fusion**.
4. Ajouter **exactement** la vérification : `Museum PR quality gate` (workflow `Museum 3D checks`). Sélectionner la source GitHub Actions si GitHub la propose. Attention à ne pas sélectionner `Node inventory and module checks` ou `Architectural staging render (desktop and mobile)` directement, car ces jobs sont volontairement ignorés pour les PR étrangères au musée.
5. Activer « Require branches to be up to date before merging » si possible. **Ne pas autoriser de contournement administrateur**, et interdire force-push et suppression de `main`.
6. Enregistrer puis vérifier que les changements destinés à `main` sont refusés tant que `Museum PR quality gate` n'est pas vert. Tester aussi un échec volontaire sur une PR de test, sans fusionner cette PR.

Si l'interface du dépôt présente **Settings → Branches → Add branch protection rule** plutôt que des rulesets, créer une règle sur `main` et appliquer les mêmes exigences.

## Ce que vérifie ce contrôle

- Le job `Museum PR quality gate` est déclenché pour **toutes** les PR vers `main` et doit être **required** dans GitHub. Il est bloquant en cas d'échec de détection ou de tests.
- Lorsque la PR touche `empty-museum/`, `AGENTS.md` ou les workflows/scripts du musée, il exige les tests Node (architecture, sécurité, commerce, cohérence) **ET** le parcours navigateur 3D sur desktop/mobile. Un job supprimé, annulé ou en échec ne donne jamais une validation verte.
- Si la PR ne touche pas au musée, seul le contrôle de détection est requis ; les autres applications de GBO Studio ne subissent pas les tests 3D.
- Après fusion, les contrôles existants sur `main` et sur le site public vérifient le déploiement. Ceux-ci détectent les problèmes post-déploiement ; ils ne peuvent **pas** remplacer un contrôle bloquant avant fusion.

## Vérification et responsabilité

Une PR ne doit pas être fusionnée au seul motif que les tests Node ont réussi. **Les contrôles navigateur doivent également être verts**, sur le commit de la PR actuellement proposé à la fusion. Aucun agent ne doit prétendre que la protection est active tant que GitHub ne retourne pas `protected:true` ou un ruleset actif applicable à `main`.

Dans GitHub Actions, une vérification historique rouge ne devient pas verte après un correctif : c'est la nouvelle exécution sur le nouveau commit qui fait foi. Ne jamais désactiver les notifications ni assouplir les tests pour cacher une erreur.
