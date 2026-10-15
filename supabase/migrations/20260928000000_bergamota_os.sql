-- Bergamota OS — schema inicial
-- Todas as tabelas usam o prefixo bg_ para conviver com outros apps no mesmo projeto.
-- Acesso: somente e-mails cadastrados em bg_members (RLS em todas as tabelas).

-- ---------------------------------------------------------------------------
-- Controle de acesso
-- ---------------------------------------------------------------------------
create table if not exists public.bg_members (
  email       text primary key,
  role        text not null default 'admin' check (role in ('admin', 'operador')),
  created_at  timestamptz not null default now()
);

create or replace function public.bg_is_member()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.bg_members m
    where lower(m.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

revoke all on function public.bg_is_member() from public, anon;
grant execute on function public.bg_is_member() to authenticated;

-- ---------------------------------------------------------------------------
-- Cadastros (espelham os tipos do app; guardados como jsonb)
-- ---------------------------------------------------------------------------
create table if not exists public.bg_ingredients (
  id          text primary key,
  data        jsonb not null,
  updated_at  timestamptz not null default now()
);

create table if not exists public.bg_recipes (
  id          text primary key,
  data        jsonb not null,
  updated_at  timestamptz not null default now()
);

create table if not exists public.bg_price_history (
  id          text primary key,
  data        jsonb not null,
  updated_at  timestamptz not null default now()
);

create table if not exists public.bg_settings (
  id          text primary key default 'default',
  data        jsonb not null,
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Financeiro
-- ---------------------------------------------------------------------------

-- Cada venda (ticket) do caixa. is_aggregate = lançamento consolidado do dia
-- (não entra no cálculo de ticket médio).
create table if not exists public.bg_sales (
  id            uuid primary key default gen_random_uuid(),
  date          date not null,
  method        text not null check (method in ('dinheiro', 'pix', 'debito', 'credito', 'outro')),
  amount        numeric(12, 2) not null check (amount > 0),
  register      text not null default 'principal',
  is_aggregate  boolean not null default false,
  note          text,
  created_at    timestamptz not null default now(),
  created_by    text default (auth.jwt() ->> 'email')
);
create index if not exists bg_sales_date_idx on public.bg_sales (date);

-- Saídas (e entradas não operacionais, ex.: aporte, empréstimo recebido)
create table if not exists public.bg_transactions (
  id              uuid primary key default gen_random_uuid(),
  type            text not null default 'saida' check (type in ('saida', 'entrada')),
  date            date not null,
  competencia     char(7) not null,               -- YYYY-MM usado no DRE
  description     text not null,
  category        text not null,
  grp             text not null default 'compras'
                  check (grp in ('compras', 'funcionario', 'fixa', 'variavel', 'esporadica', 'receita')),
  value           numeric(12, 2) not null check (value >= 0),
  status          text not null default 'realizado' check (status in ('realizado', 'previsto')),
  payment_method  text,
  recurring_id    uuid,
  source          text not null default 'app',
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists bg_transactions_comp_idx on public.bg_transactions (competencia);
create index if not exists bg_transactions_date_idx on public.bg_transactions (date);

-- Despesas recorrentes (contas fixas, parcelas) que geram lançamentos previstos
create table if not exists public.bg_recurring (
  id              uuid primary key default gen_random_uuid(),
  description     text not null,
  category        text not null,
  grp             text not null default 'fixa'
                  check (grp in ('compras', 'funcionario', 'fixa', 'variavel', 'esporadica')),
  value           numeric(12, 2) not null check (value >= 0),
  day_of_month    int not null default 10 check (day_of_month between 1 and 31),
  start_month     char(7) not null,
  end_month       char(7),                         -- null = sem fim
  active          boolean not null default true,
  created_at      timestamptz not null default now()
);
alter table public.bg_transactions
  drop constraint if exists bg_transactions_recurring_fk;
alter table public.bg_transactions
  add constraint bg_transactions_recurring_fk
  foreign key (recurring_id) references public.bg_recurring (id) on delete set null;
create index if not exists bg_transactions_recurring_idx on public.bg_transactions (recurring_id);

-- Dias em que a loja não abriu (não contam como "venda zero" nas médias)
create table if not exists public.bg_closed_days (
  date    date primary key,
  reason  text
);

-- Orçamento mensal por grupo de despesa (e meta de faturamento em grp='receita')
create table if not exists public.bg_budgets (
  competencia  char(7) not null,
  grp          text not null
               check (grp in ('compras', 'funcionario', 'fixa', 'variavel', 'esporadica', 'receita')),
  value        numeric(12, 2) not null check (value >= 0),
  primary key (competencia, grp)
);

-- ---------------------------------------------------------------------------
-- Views de agregação (security_invoker => respeitam o RLS de quem consulta)
-- ---------------------------------------------------------------------------
create or replace view public.bg_v_daily_sales
with (security_invoker = true) as
select
  date,
  sum(amount)                                         as total,
  count(*) filter (where not is_aggregate)            as tickets,
  sum(amount) filter (where method = 'dinheiro')      as dinheiro,
  sum(amount) filter (where method = 'pix')           as pix,
  sum(amount) filter (where method = 'debito')        as debito,
  sum(amount) filter (where method = 'credito')       as credito,
  sum(amount) filter (where method = 'outro')         as outro
from public.bg_sales
group by date;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'bg_ingredients', 'bg_recipes', 'bg_price_history', 'bg_settings',
    'bg_sales', 'bg_transactions', 'bg_recurring', 'bg_closed_days', 'bg_budgets'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "%s_members" on public.%I', t, t);
    execute format(
      'create policy "%s_members" on public.%I for all to authenticated
         using ((select public.bg_is_member())) with check ((select public.bg_is_member()))', t, t);
  end loop;
end $$;

alter table public.bg_members enable row level security;
drop policy if exists "bg_members_read_self" on public.bg_members;
create policy "bg_members_read_self" on public.bg_members for select to authenticated
  using (lower(email) = lower(coalesce((select auth.jwt()) ->> 'email', '')));

-- updated_at automático
create or replace function public.bg_touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['bg_ingredients', 'bg_recipes', 'bg_price_history', 'bg_settings', 'bg_transactions'] loop
    execute format('drop trigger if exists %s_touch on public.%I', t, t);
    execute format('create trigger %s_touch before update on public.%I
                    for each row execute function public.bg_touch_updated_at()', t, t);
  end loop;
end $$;
