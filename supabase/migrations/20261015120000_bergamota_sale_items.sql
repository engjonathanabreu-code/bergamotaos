-- Venda por produto: cada lançamento do caixa pode apontar para um produto
-- (ficha técnica) com quantidade e preço unitário. O nome do produto é guardado
-- como snapshot, para o histórico não mudar se a ficha for renomeada ou removida.
alter table public.bg_sales
  add column if not exists recipe_id   text,
  add column if not exists product_name text,
  add column if not exists quantity    numeric(12, 3) not null default 1 check (quantity > 0),
  add column if not exists unit_price  numeric(12, 2) check (unit_price >= 0);

create index if not exists bg_sales_recipe_idx on public.bg_sales (recipe_id);
