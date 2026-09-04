create table if not exists public.wedding_rsvp_responses (
  id uuid primary key default gen_random_uuid(),
  guest_name text not null,
  companion_name text not null default '',
  submitted_at timestamptz not null default timezone('utc', now())
);

alter table public.wedding_rsvp_responses enable row level security;

create or replace function public.wedding_submit_rsvp_response(
  p_guest_name text,
  p_companion_name text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_guest_name text := coalesce(nullif(trim(p_guest_name), ''), 'Convidado');
  v_companion_name text := coalesce(trim(p_companion_name), '');
  v_response_id uuid;
begin
  insert into public.wedding_rsvp_responses (
    guest_name,
    companion_name
  )
  values (
    v_guest_name,
    v_companion_name
  )
  returning id into v_response_id;

  return v_response_id;
end;
$$;

create or replace function public.wedding_list_rsvp_responses(p_pin text)
returns table (
  id uuid,
  guest_name text,
  companion_name text,
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
    response.id,
    response.guest_name,
    response.companion_name,
    response.submitted_at
  from public.wedding_rsvp_responses as response
  order by response.submitted_at desc;
end;
$$;

create or replace function public.wedding_delete_rsvp_response(
  p_response_id uuid,
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

  delete from public.wedding_rsvp_responses
  where id = p_response_id;
end;
$$;

grant execute on function public.wedding_submit_rsvp_response(text, text) to anon, authenticated;
grant execute on function public.wedding_list_rsvp_responses(text) to anon, authenticated;
grant execute on function public.wedding_delete_rsvp_response(uuid, text) to anon, authenticated;

revoke all on public.wedding_rsvp_responses from anon, authenticated;
