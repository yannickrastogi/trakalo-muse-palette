-- get_workspace_seats n'avait aucune verification d'appelant : n'importe qui
-- connaissant un UUID de workspace pouvait lire le plan, le nombre de sieges,
-- de membres et d'invitations en attente.
-- Seul appelant : le hook authentifie useWorkspaceSeats, toujours sur le
-- workspace courant de l'utilisateur (verifie dans le repo).

create or replace function public.get_workspace_seats(_workspace_id uuid)
returns jsonb
language plpgsql security definer set search_path = public
as $func$
declare
  v_owner uuid; v_plan text; v_included int; v_purchased int;
  v_total int; v_used int; v_viewers int; v_pending int;
  v_uid uuid := auth.uid();
begin
  -- Membre du workspace, ou appel serveur.
  if auth.role() is distinct from 'service_role' then
    if v_uid is null or _workspace_id is null
       or not public.is_workspace_member(v_uid, _workspace_id) then
      return jsonb_build_object('error','not_authorized');
    end if;
  end if;

  select owner_id into v_owner from public.workspaces where id = _workspace_id;
  if v_owner is null then return jsonb_build_object('error','workspace_not_found'); end if;

  select s.plan, pl.seats_included, s.purchased_seats
    into v_plan, v_included, v_purchased
  from public.subscriptions s
  join public.plan_limits pl on pl.plan = s.plan
  where s.user_id = v_owner;

  v_plan      := coalesce(v_plan,'free');
  v_included  := coalesce(v_included,1);
  v_purchased := coalesce(v_purchased,0);
  v_total     := v_included + v_purchased;

  select count(*) filter (where access_level <> 'viewer'),
         count(*) filter (where access_level = 'viewer')
    into v_used, v_viewers
  from public.workspace_members where workspace_id = _workspace_id;

  select count(*) into v_pending
  from public.invitations
  where workspace_id = _workspace_id and status='pending'
    and access_level <> 'viewer' and expires_at > now();

  return jsonb_build_object(
    'plan', v_plan,
    'seats_included', v_total,
    'seats_from_plan', v_included,
    'seats_purchased', v_purchased,
    'seats_used', coalesce(v_used,0),
    'seats_pending', coalesce(v_pending,0),
    'seats_available', greatest(v_total - coalesce(v_used,0) - coalesce(v_pending,0), 0),
    'viewers', coalesce(v_viewers,0),
    'can_invite_active', (coalesce(v_used,0) + coalesce(v_pending,0)) < v_total
  );
end
$func$;

revoke execute on function public.get_workspace_seats(uuid) from public, anon;
grant  execute on function public.get_workspace_seats(uuid) to authenticated, service_role;;
