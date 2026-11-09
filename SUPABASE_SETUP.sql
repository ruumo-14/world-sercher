-- World Sercher / Supabase schema
-- Run in Supabase SQL Editor. Existing account/save tables are retained.

create table if not exists public.game_users (
  id uuid primary key default gen_random_uuid(),
  username varchar(16) not null,
  username_lower varchar(16) not null unique,
  password_hash text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.game_saves (
  user_id uuid primary key references public.game_users(id) on delete cascade,
  character_name varchar(12) not null default '冒険者',
  x double precision not null default 1600,
  y double precision not null default 1370,
  level integer not null default 1,
  gold bigint not null default 0,
  game_data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.game_users enable row level security;
alter table public.game_saves enable row level security;
grant usage on schema public to service_role;
grant all privileges on all tables in schema public to service_role;
grant all privileges on all sequences in schema public to service_role;

create table if not exists public.chat_blocked_terms (
  id bigint generated always as identity primary key,
  term text not null unique,
  active boolean not null default true
);

create table if not exists public.global_chat_messages (
  id bigint generated always as identity primary key,
  sender_user_id uuid not null references public.game_users(id) on delete cascade,
  username varchar(16) not null,
  body varchar(50) not null,
  created_at timestamptz not null default now()
);
create index if not exists global_chat_created_idx on public.global_chat_messages(created_at desc);
create index if not exists global_chat_sender_idx on public.global_chat_messages(sender_user_id,created_at desc);

create table if not exists public.player_blocks (
  blocker_user_id uuid not null references public.game_users(id) on delete cascade,
  blocked_user_id uuid not null references public.game_users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(blocker_user_id,blocked_user_id),
  check(blocker_user_id <> blocked_user_id)
);

create table if not exists public.player_reports (
  id bigint generated always as identity primary key,
  reporter_user_id uuid not null references public.game_users(id) on delete cascade,
  target_user_id uuid references public.game_users(id) on delete set null,
  category varchar(24) not null default 'other',
  details varchar(1000) not null,
  status varchar(16) not null default 'open',
  created_at timestamptz not null default now()
);

create table if not exists public.market_listings (
  id uuid primary key default gen_random_uuid(),
  seller_user_id uuid not null references public.game_users(id) on delete cascade,
  seller_name varchar(16) not null,
  item_data jsonb not null,
  rarity varchar(3) not null check (rarity in ('N','R','SR','SSR','UR')),
  quantity integer not null check(quantity > 0),
  unit_price bigint not null check(unit_price > 0),
  status varchar(16) not null default 'active',
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days')
);
create index if not exists market_active_price_idx on public.market_listings(status,unit_price asc,created_at desc);

create table if not exists public.market_payouts (
  id bigint generated always as identity primary key,
  seller_user_id uuid not null references public.game_users(id) on delete cascade,
  amount bigint not null check(amount > 0),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 days'),
  claimed_at timestamptz
);

create or replace function public.market_create_listing(
  p_user_id uuid, p_seller_name text, p_item_data jsonb, p_rarity text,
  p_quantity integer, p_unit_price bigint, p_listing_fee bigint
) returns jsonb language plpgsql security definer set search_path=public as $$
declare
  v_save public.game_saves%rowtype;
  v_listing public.market_listings%rowtype;
  v_count integer;
begin
  select * into v_save from public.game_saves where user_id=p_user_id for update;
  if not found then raise exception 'player save missing'; end if;
  select count(*) into v_count from public.market_listings
    where seller_user_id=p_user_id and status='active' and expires_at>now();
  if v_count>=5 then raise exception 'listing limit'; end if;
  if p_quantity<1 or p_unit_price<1 or p_listing_fee<0 then raise exception 'invalid listing'; end if;
  if v_save.gold<p_listing_fee then raise exception 'not enough gold'; end if;
  update public.game_saves set gold=gold-p_listing_fee,
    game_data=jsonb_set(coalesce(game_data,'{}'::jsonb),'{gold}',to_jsonb(greatest(0,gold-p_listing_fee)),true),
    updated_at=now() where user_id=p_user_id;
  insert into public.market_listings(seller_user_id,seller_name,item_data,rarity,quantity,unit_price)
    values(p_user_id,left(p_seller_name,16),p_item_data,p_rarity,p_quantity,p_unit_price)
    returning * into v_listing;
  return to_jsonb(v_listing);
end $$;

create or replace function public.market_buy_listing(
  p_buyer_id uuid, p_listing_id uuid, p_quantity integer
) returns jsonb language plpgsql security definer set search_path=public as $$
declare
  v_listing public.market_listings%rowtype;
  v_buyer public.game_saves%rowtype;
  v_total bigint;
  v_payout bigint;
  v_inventory jsonb;
begin
  if p_quantity<1 or p_quantity>99 then raise exception 'invalid quantity'; end if;
  select * into v_listing from public.market_listings where id=p_listing_id for update;
  if not found or v_listing.status<>'active' or v_listing.expires_at<=now() then raise exception 'listing unavailable'; end if;
  if v_listing.quantity<p_quantity then raise exception 'not enough stock'; end if;
  v_total=v_listing.unit_price*p_quantity;
  select * into v_buyer from public.game_saves where user_id=p_buyer_id for update;
  if not found or v_buyer.gold<v_total then raise exception 'not enough gold'; end if;
  update public.game_saves set gold=gold-v_total, updated_at=now() where user_id=p_buyer_id;
  v_payout=floor(v_total*0.90);
  insert into public.market_payouts(seller_user_id,amount) values(v_listing.seller_user_id,v_payout);
  v_inventory=coalesce(v_buyer.game_data->'inventory','[]'::jsonb);
  update public.game_saves set
    game_data=jsonb_set(
      jsonb_set(coalesce(game_data,'{}'::jsonb),'{gold}',to_jsonb(greatest(0,gold-v_total)),true),
      '{inventory}',v_inventory || jsonb_build_array(jsonb_build_object(
        'item',v_listing.item_data,'rarity',v_listing.rarity,'quantity',p_quantity,'acquiredAt',now()
      )),true),
    updated_at=now()
    where user_id=p_buyer_id;
  update public.market_listings set quantity=quantity-p_quantity,
    status=case when quantity-p_quantity=0 then 'sold' else 'active' end
    where id=p_listing_id;
  return jsonb_build_object('total',v_total,'sellerPayout',v_payout,'quantity',p_quantity);
end $$;

create or replace function public.market_cancel_listing(p_user_id uuid,p_listing_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_listing public.market_listings%rowtype;
begin
  select * into v_listing from public.market_listings
    where id=p_listing_id and seller_user_id=p_user_id for update;
  if not found or v_listing.status<>'active' then raise exception 'listing unavailable'; end if;
  update public.market_listings set status='cancelled' where id=p_listing_id;
  update public.game_saves set game_data=jsonb_set(
    coalesce(game_data,'{}'::jsonb),'{inventory}',
    coalesce(game_data->'inventory','[]'::jsonb) || jsonb_build_array(jsonb_build_object(
      'item',v_listing.item_data,'rarity',v_listing.rarity,'quantity',v_listing.quantity
    )),true),updated_at=now()
    where user_id=p_user_id;
  return jsonb_build_object('returned',v_listing.quantity);
end $$;

create or replace function public.market_claim_payouts(p_user_id uuid)
returns bigint language plpgsql security definer set search_path=public as $$
declare v_total bigint;
begin
  select coalesce(sum(amount),0) into v_total from public.market_payouts
    where seller_user_id=p_user_id and claimed_at is null and expires_at>now();
  if v_total>0 then
    update public.market_payouts set claimed_at=now()
      where seller_user_id=p_user_id and claimed_at is null and expires_at>now();
    update public.game_saves set gold=gold+v_total,
      game_data=jsonb_set(coalesce(game_data,'{}'::jsonb),'{gold}',to_jsonb(gold+v_total),true),
      updated_at=now() where user_id=p_user_id;
  end if;
  update public.market_payouts set claimed_at=expires_at
    where seller_user_id=p_user_id and claimed_at is null and expires_at<=now();
  return v_total;
end $$;

revoke all on function public.market_create_listing(uuid,text,jsonb,text,integer,bigint,bigint) from public, anon, authenticated;
revoke all on function public.market_buy_listing(uuid,uuid,integer) from public, anon, authenticated;
revoke all on function public.market_cancel_listing(uuid,uuid) from public, anon, authenticated;
revoke all on function public.market_claim_payouts(uuid) from public, anon, authenticated;
grant execute on function public.market_create_listing(uuid,text,jsonb,text,integer,bigint,bigint) to service_role;
grant execute on function public.market_buy_listing(uuid,uuid,integer) to service_role;
grant execute on function public.market_cancel_listing(uuid,uuid) to service_role;
grant execute on function public.market_claim_payouts(uuid) to service_role;

alter table public.chat_blocked_terms enable row level security;
alter table public.global_chat_messages enable row level security;
alter table public.player_blocks enable row level security;
alter table public.player_reports enable row level security;
alter table public.market_listings enable row level security;
alter table public.market_payouts enable row level security;
grant all privileges on public.chat_blocked_terms,public.global_chat_messages,public.player_blocks,
  public.player_reports,public.market_listings,public.market_payouts to service_role;
