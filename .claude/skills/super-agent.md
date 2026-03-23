# Super Agent Mode — Multi-Agent Workflow Skill

## Principe
Toujours décomposer les tâches complexes en sous-tâches parallélisables. Ne jamais faire séquentiellement ce qui peut être fait en parallèle.

## Règles d'exécution

### 1. Analyse avant action
Avant de coder, toujours :
- Lister TOUS les fichiers qui seront modifiés
- Identifier les tâches indépendantes (qui ne dépendent pas les unes des autres)
- Lancer les tâches indépendantes en parallèle via des sub-agents

### 2. Parallélisation
Exemples de tâches parallélisables :
- Modifier 3 fichiers qui ne dépendent pas l'un de l'autre → 3 sub-agents
- Créer une Edge Function + modifier le frontend → 2 sub-agents
- Ajouter des traductions i18n dans 8 fichiers → sub-agent dédié
- Lancer npm run build pendant qu'on prépare le git commit message

### 3. Planification en phases
Pour les grosses features, structurer en phases :
- Phase 1 : toutes les modifications parallélisables
- Phase 2 : les modifications qui dépendent de Phase 1
- Phase 3 : vérification (build, lint, test)
- Phase 4 : commit + push

### 4. Vérification systématique
Après chaque modification :
- Vérifier que le fichier compile (pas d'erreur TypeScript)
- Vérifier les imports (rien de cassé)
- À la fin : npm run build obligatoire

### 5. Gestion d'erreur
Si un sub-agent échoue :
- Ne pas bloquer les autres
- Reporter l'erreur clairement
- Proposer un fix spécifique

## Template de réponse pour tâches complexes

Quand une tâche est complexe, structurer ainsi :

### Analyse
- X fichiers à modifier
- Y tâches indépendantes identifiées
- Z tâches séquentielles

### Exécution
- Sub-agent A : [tâche 1 + tâche 2] (indépendants)
- Sub-agent B : [tâche 3 + tâche 4] (indépendants)
- Séquentiel : [tâche 5] (dépend de A et B)

### Vérification
- Build ✅/❌
- Tous les fichiers modifiés listés
- Résumé des changements

## Anti-patterns à éviter
- Ne JAMAIS modifier un fichier, vérifier, puis modifier le suivant (séquentiel lent)
- Ne JAMAIS faire 10 petits commits — regrouper en 1 commit cohérent
- Ne JAMAIS oublier de vérifier le build avant de push
- Ne JAMAIS laisser un sub-agent modifier le même fichier qu'un autre sub-agent (conflits)
