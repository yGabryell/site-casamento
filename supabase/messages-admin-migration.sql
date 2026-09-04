drop policy if exists "Wedding guest messages can be read" on public.wedding_guest_messages;

drop function if exists public.wedding_list_guest_messages();

create or replace function public.wedding_list_guest_messages(p_pin text)
returns table (
  id uuid,
  guest_name text,
  guest_email text,
  message_text text,
  submitted_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.wedding_verify_admin_pin(p_pin) then
    raise exception 'PIN administrativo invalido.';
  end if;

  return query
  select
    message.id,
    message.guest_name,
    message.guest_email,
    message.message_text,
    message.submitted_at
  from public.wedding_guest_messages as message
  order by message.submitted_at desc
  limit 200;
end;
$$;

grant execute on function public.wedding_list_guest_messages(text) to anon, authenticated;
