# RPCs SECURITY DEFINER — Trakalog

Toutes les queries DB sensibles passent par des RPCs pour contourner l'instabilité de `auth.uid()`.

## RPCs existantes

| RPC | Paramètres | Fichier | Usage |
|-----|-----------|---------|-------|
| `get_user_workspaces` | `_user_id uuid` | WorkspaceContext.tsx | Lister les workspaces de l'utilisateur |
| `create_workspace_with_member` | `_name text, _description text, _user_id uuid` | WorkspaceContext.tsx | Auto-créer workspace + membre |
| `update_user_profile` | `_user_id uuid, _first_name text, ...` | SettingsPage.tsx | Sauvegarder le profil utilisateur |
| `save_track_to_trakalog` | `_track_id uuid, _source_ws uuid, _target_ws uuid, _user_id uuid` | SharedLinkPage.tsx | Sauvegarder un track partagé |
| `remove_track_from_trakalog` | `_track_id uuid, _user_id uuid` | TrackDetail.tsx | Retirer un track sauvegardé |
| `get_workspace_catalog_shares` | `_workspace_id uuid` | TrackContext.tsx | Lister les catalog shares entrants |
| `get_track_comments` | `_track_id uuid` | TrackReviewContext.tsx | Lire les commentaires d'un track |
| `add_track_comment` | `_track_id uuid, _user_id uuid, _content text, ...` | TrackReviewContext.tsx | Ajouter un commentaire |
| `delete_track_comment` | `_comment_id uuid, _user_id uuid` | TrackReviewContext.tsx | Supprimer un commentaire |

## Pattern pour créer une nouvelle RPC

```sql
CREATE OR REPLACE FUNCTION nom_de_la_rpc(_user_id uuid, _autres_params ...)
RETURNS ... AS $$
BEGIN
  -- Vérifier que l'utilisateur a le droit
  -- Exécuter la query
  -- Retourner le résultat
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

Règles :
1. Toujours `SECURITY DEFINER` (bypass RLS)
2. Toujours `_user_id uuid` comme premier paramètre
3. Toujours vérifier les permissions dans la fonction elle-même
4. Fournir le SQL à Yannick — JAMAIS exécuter automatiquement
