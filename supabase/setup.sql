create extension if not exists pgcrypto;

create table if not exists public.wedding_admin_settings (
  id integer primary key default 1 check (id = 1),
  admin_pin text not null,
  updated_at timestamptz not null default timezone('utc', now())
);

insert into public.wedding_admin_settings (id, admin_pin)
values (1, 'TROQUE-ESTE-PIN')
on conflict (id) do nothing;

create table if not exists public.wedding_gift_states (
  item_id bigint primary key,
  status text not null default 'available'
    check (status in ('available', 'reserved', 'pending', 'purchased')),
  reserved_by text not null default '',
  purchase_request_id uuid,
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.wedding_purchase_requests (
  id uuid primary key default gen_random_uuid(),
  item_id bigint not null,
  item_name text not null,
  guest_name text not null default 'Convidado',
  receipt_path text not null default '',
  receipt_public_url text not null default '',
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  submitted_at timestamptz not null default timezone('utc', now()),
  reviewed_at timestamptz,
  reviewer_note text not null default ''
);

alter table public.wedding_purchase_requests
  alter column receipt_path set default '',
  alter column receipt_public_url set default '';

create table if not exists public.wedding_rsvp_responses (
  id uuid primary key default gen_random_uuid(),
  guest_name text not null,
  companion_name text not null default '',
  submitted_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.wedding_guest_messages (
  id uuid primary key default gen_random_uuid(),
  guest_name text not null,
  guest_email text not null default '',
  message_text text not null,
  submitted_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists wedding_purchase_requests_one_pending_per_item
  on public.wedding_purchase_requests (item_id)
  where status = 'pending';

alter table public.wedding_gift_states enable row level security;
alter table public.wedding_purchase_requests enable row level security;
alter table public.wedding_rsvp_responses enable row level security;
alter table public.wedding_guest_messages enable row level security;

drop policy if exists "Wedding gift states can be read" on public.wedding_gift_states;
create policy "Wedding gift states can be read"
  on public.wedding_gift_states
  for select
  to anon, authenticated
  using (true);

drop policy if exists "Wedding guest messages can be inserted" on public.wedding_guest_messages;
create policy "Wedding guest messages can be inserted"
  on public.wedding_guest_messages
  for insert
  to anon, authenticated
  with check (
    char_length(trim(coalesce(guest_name, ''))) >= 1
    and char_length(trim(coalesce(message_text, ''))) between 3 and 4000
  );

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'wedding-receipts',
  'wedding-receipts',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Wedding receipts upload" on storage.objects;
create policy "Wedding receipts upload"
  on storage.objects
  for insert
  to anon, authenticated
  with check (bucket_id = 'wedding-receipts');

create or replace function public.wedding_verify_admin_pin(p_pin text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_configured_pin text;
begin
  select admin_pin
  into v_configured_pin
  from public.wedding_admin_settings
  where id = 1;

  return coalesce(v_configured_pin, '') <> ''
    and p_pin = v_configured_pin;
end;
$$;

create or replace function public.wedding_set_reservation(
  p_item_id bigint,
  p_guest_name text,
  p_reserve boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_guest_name text := coalesce(nullif(trim(p_guest_name), ''), 'Convidado');
begin
  if p_reserve then
    if exists (
      select 1
      from public.wedding_gift_states
      where item_id = p_item_id
        and status in ('pending', 'purchased')
    ) then
      raise exception 'Este item nao esta disponivel para reserva.';
    end if;

    insert into public.wedding_gift_states (
      item_id,
      status,
      reserved_by,
      purchase_request_id,
      updated_at
    )
    values (
      p_item_id,
      'reserved',
      v_guest_name,
      null,
      timezone('utc', now())
    )
    on conflict (item_id) do update
    set status = 'reserved',
        reserved_by = excluded.reserved_by,
        purchase_request_id = null,
        updated_at = excluded.updated_at;
  else
    insert into public.wedding_gift_states (
      item_id,
      status,
      reserved_by,
      purchase_request_id,
      updated_at
    )
    values (
      p_item_id,
      'available',
      '',
      null,
      timezone('utc', now())
    )
    on conflict (item_id) do update
    set status = 'available',
        reserved_by = '',
        purchase_request_id = null,
        updated_at = excluded.updated_at;
  end if;
end;
$$;

create or replace function public.wedding_submit_purchase_request(
  p_item_id bigint,
  p_item_name text,
  p_guest_name text,
  p_receipt_path text default '',
  p_receipt_public_url text default ''
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_guest_name text := coalesce(nullif(trim(p_guest_name), ''), 'Convidado');
  v_request_id uuid;
begin
  if exists (
    select 1
    from public.wedding_gift_states
    where item_id = p_item_id
      and status in ('pending', 'purchased')
  ) then
    raise exception 'Este item nao esta mais disponivel.';
  end if;

  insert into public.wedding_purchase_requests (
    item_id,
    item_name,
    guest_name,
    receipt_path,
    receipt_public_url,
    status
  )
  values (
    p_item_id,
    coalesce(nullif(trim(p_item_name), ''), 'Presente'),
    v_guest_name,
    coalesce(p_receipt_path, ''),
    coalesce(p_receipt_public_url, ''),
    'pending'
  )
  returning id into v_request_id;

  insert into public.wedding_gift_states (
    item_id,
    status,
    reserved_by,
    purchase_request_id,
    updated_at
  )
  values (
    p_item_id,
    'pending',
    v_guest_name,
    v_request_id,
    timezone('utc', now())
  )
  on conflict (item_id) do update
  set status = 'pending',
      reserved_by = excluded.reserved_by,
      purchase_request_id = excluded.purchase_request_id,
      updated_at = excluded.updated_at;

  return v_request_id;
end;
$$;

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

create or replace function public.wedding_submit_guest_message(
  p_guest_name text,
  p_guest_email text,
  p_message_text text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_guest_name text := coalesce(nullif(trim(p_guest_name), ''), 'Convidado');
  v_guest_email text := coalesce(trim(p_guest_email), '');
  v_message_text text := coalesce(trim(p_message_text), '');
  v_message_id uuid;
begin
  if char_length(v_message_text) < 3 then
    raise exception 'Mensagem muito curta.';
  end if;

  if char_length(v_message_text) > 4000 then
    raise exception 'Mensagem excede o limite de 4000 caracteres.';
  end if;

  insert into public.wedding_guest_messages (
    guest_name,
    guest_email,
    message_text
  )
  values (
    v_guest_name,
    v_guest_email,
    v_message_text
  )
  returning id into v_message_id;

  return v_message_id;
end;
$$;

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

create or replace function public.wedding_list_pending_requests(p_pin text)
returns table (
  id uuid,
  item_id bigint,
  item_name text,
  guest_name text,
  receipt_path text,
  receipt_public_url text,
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
    request.id,
    request.item_id,
    request.item_name,
    request.guest_name,
    request.receipt_path,
    request.receipt_public_url,
    request.submitted_at
  from public.wedding_purchase_requests as request
  where request.status = 'pending'
  order by request.submitted_at desc;
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

create or replace function public.wedding_delete_purchase_item(
  p_item_id bigint,
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

  delete from public.wedding_purchase_requests
  where item_id = p_item_id;

  delete from public.wedding_gift_states
  where item_id = p_item_id;
end;
$$;

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

create or replace function public.wedding_review_purchase_request(
  p_request_id uuid,
  p_pin text,
  p_action text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.wedding_purchase_requests%rowtype;
  v_now timestamptz := timezone('utc', now());
begin
  if not public.wedding_verify_admin_pin(p_pin) then
    raise exception 'PIN administrativo invalido.';
  end if;

  select *
  into v_request
  from public.wedding_purchase_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'Pedido de compra nao encontrado.';
  end if;

  if v_request.status <> 'pending' then
    raise exception 'Esta compra ja foi analisada.';
  end if;

  if p_action = 'approve' then
    update public.wedding_purchase_requests
    set status = 'approved',
        reviewed_at = v_now
    where id = p_request_id;

    insert into public.wedding_gift_states (
      item_id,
      status,
      reserved_by,
      purchase_request_id,
      updated_at
    )
    values (
      v_request.item_id,
      'purchased',
      v_request.guest_name,
      v_request.id,
      v_now
    )
    on conflict (item_id) do update
    set status = 'purchased',
        reserved_by = excluded.reserved_by,
        purchase_request_id = excluded.purchase_request_id,
        updated_at = excluded.updated_at;
  elsif p_action = 'reject' then
    update public.wedding_purchase_requests
    set status = 'rejected',
        reviewed_at = v_now
    where id = p_request_id;

    insert into public.wedding_gift_states (
      item_id,
      status,
      reserved_by,
      purchase_request_id,
      updated_at
    )
    values (
      v_request.item_id,
      'available',
      '',
      null,
      v_now
    )
    on conflict (item_id) do update
    set status = 'available',
        reserved_by = '',
        purchase_request_id = null,
        updated_at = excluded.updated_at;
  else
    raise exception 'Acao administrativa invalida.';
  end if;
end;
$$;

create or replace function public.wedding_reset_all(p_pin text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := timezone('utc', now());
begin
  if not public.wedding_verify_admin_pin(p_pin) then
    raise exception 'PIN administrativo invalido.';
  end if;

  update public.wedding_purchase_requests
  set status = 'rejected',
      reviewed_at = v_now,
      reviewer_note = 'Reset manual'
  where status = 'pending';

  delete from public.wedding_gift_states;
end;
$$;

grant select on public.wedding_gift_states to anon, authenticated;
grant execute on function public.wedding_verify_admin_pin(text) to anon, authenticated;
grant execute on function public.wedding_set_reservation(bigint, text, boolean) to anon, authenticated;
grant execute on function public.wedding_submit_purchase_request(bigint, text, text, text, text) to anon, authenticated;
grant execute on function public.wedding_submit_rsvp_response(text, text) to anon, authenticated;
grant execute on function public.wedding_submit_guest_message(text, text, text) to anon, authenticated;
grant execute on function public.wedding_list_guest_messages(text) to anon, authenticated;
grant execute on function public.wedding_list_pending_requests(text) to anon, authenticated;
grant execute on function public.wedding_list_rsvp_responses(text) to anon, authenticated;
grant execute on function public.wedding_delete_rsvp_response(uuid, text) to anon, authenticated;
grant execute on function public.wedding_delete_purchase_item(bigint, text) to anon, authenticated;
grant execute on function public.wedding_delete_guest_message(uuid, text) to anon, authenticated;
grant execute on function public.wedding_review_purchase_request(uuid, text, text) to anon, authenticated;
grant execute on function public.wedding_reset_all(text) to anon, authenticated;

revoke all on public.wedding_admin_settings from anon, authenticated;
revoke all on public.wedding_purchase_requests from anon, authenticated;
revoke all on public.wedding_rsvp_responses from anon, authenticated;
revoke all on public.wedding_guest_messages from anon, authenticated;
