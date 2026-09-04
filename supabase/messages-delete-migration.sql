create or replace function public.wedding_delete_guest_message(
  p_message_id uuid,
  p_pin text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.wedding_verify_admin_pin(p_pin) then
    raise exception 'PIN administrativo invalido.';
  end if;

  delete from public.wedding_guest_messages
  where id = p_message_id;
end;
$$;

grant execute on function public.wedding_delete_guest_message(uuid, text) to anon, authenticated;
