revoke execute on function public.get_track_comments(uuid,uuid) from public;
revoke execute on function public.get_track_comments(uuid,uuid) from anon;
grant execute on function public.get_track_comments(uuid,uuid) to authenticated, service_role;;
