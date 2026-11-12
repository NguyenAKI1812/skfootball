-- Chạy đoạn SQL này trong Supabase Dashboard -> SQL Editor -> New Query -> Run

-- 1. Bảng lưu trạng thái phòng đấu giá (tùy chọn cho persistence / kiểm tra phòng)
create table if not exists public.auction_rooms (
  room_code text primary key,
  status text not null default 'waiting', -- 'waiting' | 'playing' | 'finished'
  top_bid integer not null default 1,
  leader_id text, -- 'p1' | 'p2' | null
  p1_passed boolean not null default false,
  p2_passed boolean not null default false,
  round_ends_at bigint, -- epoch ms timestamp
  state_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. Bật Realtime cho bảng auction_rooms
alter table public.auction_rooms replica identity full;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'auction_rooms'
  ) then
    alter publication supabase_realtime add table public.auction_rooms;
  end if;
end $$;

-- 3. Bật RLS và cho phép client (publishable / anon key) đọc & ghi phòng đấu giá
alter table public.auction_rooms enable row level security;

drop policy if exists "Allow public read auction_rooms" on public.auction_rooms;
create policy "Allow public read auction_rooms"
  on public.auction_rooms for select
  to anon, authenticated
  using (true);

drop policy if exists "Allow public insert auction_rooms" on public.auction_rooms;
create policy "Allow public insert auction_rooms"
  on public.auction_rooms for insert
  to anon, authenticated
  with check (true);

drop policy if exists "Allow public update auction_rooms" on public.auction_rooms;
create policy "Allow public update auction_rooms"
  on public.auction_rooms for update
  to anon, authenticated
  using (true)
  with check (true);

drop policy if exists "Allow public delete auction_rooms" on public.auction_rooms;
create policy "Allow public delete auction_rooms"
  on public.auction_rooms for delete
  to anon, authenticated
  using (true);

-- 4. Tự động cập nhật updated_at mỗi khi sửa phòng
create or replace function public.set_auction_rooms_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_auction_rooms_updated_at on public.auction_rooms;
create trigger trg_auction_rooms_updated_at
  before update on public.auction_rooms
  for each row
  execute function public.set_auction_rooms_updated_at();
