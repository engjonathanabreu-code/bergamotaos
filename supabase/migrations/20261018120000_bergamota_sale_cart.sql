-- Venda com vários itens: o lançamento (bg_sales) guarda data, forma de pagamento
-- e total; cada produto ou valor avulso da venda vai para bg_sale_items.
create table if not exists public.bg_sale_items (
  id           uuid primary key default gen_random_uuid(),
  sale_id      uuid not null references public.bg_sales (id) on delete cascade,
  recipe_id    text,                 -- id da ficha técnica (null = valor avulso)
  product_name text,                 -- snapshot do nome no momento da venda
  quantity     numeric(12, 3) not null default 1 check (quantity > 0),
  unit_price   numeric(12, 2) check (unit_price >= 0),
  amount       numeric(12, 2) not null check (amount > 0),
  created_at   timestamptz not null default now()
);
create index if not exists bg_sale_items_sale_idx on public.bg_sale_items (sale_id);
create index if not exists bg_sale_items_recipe_idx on public.bg_sale_items (recipe_id);

alter table public.bg_sale_items enable row level security;
drop policy if exists "bg_sale_items_members" on public.bg_sale_items;
create policy "bg_sale_items_members" on public.bg_sale_items for all to authenticated
  using ((select public.bg_is_member())) with check ((select public.bg_is_member()));

-- Copia os itens de produto gravados na versão anterior (uma venda = um item).
-- Idempotente: só copia venda que ainda não tem item. As colunas antigas de
-- bg_sales ficam no lugar, sem uso pelo código novo; o app antigo continua
-- conseguindo gravar até o deploy. Remover depois, em migração separada.
insert into public.bg_sale_items (sale_id, recipe_id, product_name, quantity, unit_price, amount)
select s.id, s.recipe_id, s.product_name, coalesce(s.quantity, 1), s.unit_price, s.amount
from public.bg_sales s
where s.product_name is not null
  and not exists (select 1 from public.bg_sale_items i where i.sale_id = s.id);

-- Cria a venda e seus itens numa única transação. O total é a soma dos itens.
-- security invoker: o RLS de quem chama continua valendo.
create or replace function public.bg_create_sale(
  p_date date,
  p_method text,
  p_register text,
  p_is_aggregate boolean,
  p_items jsonb
) returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
  v_total numeric(12, 2);
begin
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'A venda precisa de pelo menos um item';
  end if;

  select coalesce(sum((x->>'amount')::numeric), 0) into v_total
  from jsonb_array_elements(p_items) x;

  insert into public.bg_sales (date, method, amount, register, is_aggregate)
  values (p_date, p_method, v_total, p_register, coalesce(p_is_aggregate, false))
  returning id into v_id;

  insert into public.bg_sale_items (sale_id, recipe_id, product_name, quantity, unit_price, amount)
  select v_id,
         nullif(x->>'recipe_id', ''),
         nullif(x->>'product_name', ''),
         coalesce((x->>'quantity')::numeric, 1),
         nullif(x->>'unit_price', '')::numeric,
         (x->>'amount')::numeric
  from jsonb_array_elements(p_items) x;

  return v_id;
end $$;

revoke all on function public.bg_create_sale(date, text, text, boolean, jsonb) from public, anon;
grant execute on function public.bg_create_sale(date, text, text, boolean, jsonb) to authenticated;
