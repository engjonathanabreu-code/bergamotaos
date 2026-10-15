"""Gera SQL compacto de carga a partir de scripts/seed/*.json (para rodar no SQL Editor do Supabase)."""
import json
from collections import defaultdict
from pathlib import Path

SEED = Path(__file__).parent / 'seed'
OUT = SEED / 'sql'
OUT.mkdir(exist_ok=True)
load = lambda n: json.load(open(SEED / f'{n}.json', encoding='utf-8'))
js = lambda o: json.dumps(o, ensure_ascii=False, separators=(',', ':')).replace("'", "''")


def jsonb_table(table, rows, chunk=None):
    parts = [rows] if not chunk else [rows[i:i + chunk] for i in range(0, len(rows), chunk)]
    out = []
    for p in parts:
        out.append(f"insert into public.{table} (id, data) select e->>'id', e from jsonb_array_elements('{js(p)}'::jsonb) e "
                   f"on conflict (id) do update set data = excluded.data;")
    return out


files = {}
files['01_catalog'] = [
    f"insert into public.bg_settings (id, data) values ('default', '{js(load('settings'))}'::jsonb) on conflict (id) do update set data = excluded.data;",
    *jsonb_table('bg_ingredients', load('ingredients')),
]
files['02_price_history'] = jsonb_table('bg_price_history', load('price_history'))
rec = jsonb_table('bg_recipes', load('recipes'), chunk=18)
files['03_recipes_a'], files['04_recipes_b'] = [rec[0]], rec[1:]

# vendas: {data: {"d":[..], "p":[..], "b":[..], "c":[..], "zd":[..], ...}}
codes = {'dinheiro': 'd', 'pix': 'p', 'debito': 'b', 'credito': 'c', 'outro': 'o'}
days = defaultdict(lambda: defaultdict(list))
for s in load('sales'):
    k = ('z' if s['register'] == 'cz' else '') + codes[s['method']]
    days[s['date']][k].append(s['amount'])
v = ",".join(f"('{c}','{m}','principal'),('z{c}','{m}','cz')" for m, c in codes.items())
files['05_sales'] = [
    "delete from public.bg_sales where created_by is null and note = 'legado';",
    f"insert into public.bg_sales (date, method, amount, register, note, created_by) "
    f"select d.key::date, m.method, a.value::numeric, m.reg, 'legado', null "
    f"from jsonb_each('{js(days)}'::jsonb) d cross join (values {v}) m(k, method, reg) "
    f"cross join lateral jsonb_array_elements_text(coalesce(d.value->m.k, '[]'::jsonb)) a;",
]

# despesas: arrays posicionais
cols = ['date', 'competencia', 'description', 'category', 'group', 'value', 'status', 'notes']
rows = [[t[c] for c in cols] for t in load('transactions')]
files['06_transactions'] = [
    "delete from public.bg_transactions where source = 'planilha';",
    "insert into public.bg_transactions (date, competencia, description, category, grp, value, status, notes, source) "
    "select (r->>0)::date, r->>1, r->>2, r->>3, r->>4, (r->>5)::numeric, r->>6, r->>7, 'planilha' "
    f"from jsonb_array_elements('{js(rows)}'::jsonb) r;",
]
for name, stmts in files.items():
    (OUT / f'{name}.sql').write_text('\n'.join(stmts), encoding='utf-8')
    print(name, sum(len(s) for s in stmts))
