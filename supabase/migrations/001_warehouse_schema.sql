-- supabase/migrations/001_warehouse_schema.sql
-- Запускается один раз в Supabase Dashboard → SQL Editor

-- Включаем UUID
create extension if not exists "pgcrypto";

create table if not exists categories (
  id text primary key default gen_random_uuid()::text,
  name text not null,
  description text,
  color text default '#6366f1',
  created_at bigint
);

create table if not exists units (
  id text primary key,
  name text not null,
  short_name text not null
);

create table if not exists products (
  id text primary key default gen_random_uuid()::text,
  name text not null,
  sku text unique,
  barcode text unique,
  description text,
  category_id text references categories(id),
  unit_id text references units(id),
  cost_price real default 0,
  sale_price real default 0,
  quantity real default 0,
  min_quantity real default 0,
  is_active integer default 1,
  barcode_type text default 'standard',
  plu_code integer,
  created_at bigint,
  updated_at bigint
);

create table if not exists movements (
  id text primary key default gen_random_uuid()::text,
  product_id text not null references products(id),
  type text not null,
  quantity real not null,
  price real,
  note text,
  invoice_id text,
  created_at bigint
);

create table if not exists suppliers (
  id text primary key default gen_random_uuid()::text,
  name text not null,
  phone text,
  address text,
  notes text,
  total_debt real default 0,
  created_at bigint
);

create table if not exists invoices (
  id text primary key default gen_random_uuid()::text,
  supplier_id text references suppliers(id),
  supplier_name text not null,
  invoice_number text,
  payment_status text not null default 'paid',
  payment_method text default 'cash',
  due_date bigint,
  total real not null default 0,
  paid_amount real not null default 0,
  notes text,
  created_at bigint not null
);

create table if not exists invoice_items (
  id text primary key default gen_random_uuid()::text,
  invoice_id text not null references invoices(id),
  product_id text not null references products(id),
  product_name text not null,
  quantity real not null,
  price real not null,
  total real not null
);

create table if not exists sales (
  id text primary key default gen_random_uuid()::text,
  total real not null,
  paid real not null,
  change real not null,
  payment_method text default 'cash',
  note text,
  created_at bigint not null
);

create table if not exists sale_items (
  id text primary key default gen_random_uuid()::text,
  sale_id text not null references sales(id),
  product_id text not null,
  product_name text not null,
  quantity real not null,
  price real not null,
  total real not null
);

-- Включаем Replication (нужно для PowerSync)
alter table categories    replica identity full;
alter table units         replica identity full;
alter table products      replica identity full;
alter table movements     replica identity full;
alter table suppliers     replica identity full;
alter table invoices      replica identity full;
alter table invoice_items replica identity full;
alter table sales         replica identity full;
alter table sale_items    replica identity full;

-- Добавляем таблицы в publication для логической репликации
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'powersync') then
    create publication powersync for table
      categories, units, products, movements,
      suppliers, invoices, invoice_items,
      sales, sale_items;
  end if;
end $$;

-- Стартовые единицы измерения
insert into units (id, name, short_name) values
  ('unit-pcs',  'Штука',      'шт'),
  ('unit-kg',   'Килограмм',  'кг'),
  ('unit-g',    'Грамм',      'г'),
  ('unit-m',    'Метр',       'м'),
  ('unit-l',    'Литр',       'л'),
  ('unit-box',  'Коробка',    'кор'),
  ('unit-pack', 'Упаковка',   'уп')
on conflict (id) do nothing;
