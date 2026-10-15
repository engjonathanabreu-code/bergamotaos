# Bergamota OS

Sistema de gestão da confeitaria Bergamota: fichas técnicas, insumos, precificação
e o **modelo financeiro completo** (caixa diário, despesas, DRE, ponto de
equilíbrio, projeção de caixa, orçamento e indicadores).

- **Frontend:** Vite + React 19 + TypeScript + Tailwind v4 (design do guia de UI: laranja #FF9C2E, Roboto)
- **Dados:** Supabase — projeto "Financas Pessoais Casa", tabelas com prefixo `bg_` e RLS
- **Hospedagem:** Vercel (projeto `bergamota-os`)

## Rodar localmente

```
npm install
npm run dev          # http://localhost:5173  (login com o usuário do Supabase)
```

`?preview` na URL (só em `npm run dev`) abre o app com os dados de `scripts/seed/`, sem login e sem gravar no banco.

## Deploy

```
npx vercel login     # uma vez
npx vercel deploy --prod
```

A pasta já está vinculada ao projeto (`.vercel/project.json`) e as variáveis
`VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` já estão cadastradas na Vercel.

## Acesso

Só entra quem estiver em `bg_members` (e-mail). Para liberar alguém, rode no SQL Editor:

```sql
insert into public.bg_members (email) values ('pessoa@exemplo.com');
```

## Estrutura

| Pasta | Conteúdo |
|---|---|
| `src/features/finance` | Painel, Caixa do dia, Despesas, DRE, Planejamento |
| `src/utils/financeModel.ts` | Motor do modelo financeiro (DRE, meta diária, equilíbrio, projeção) |
| `src/data/finance.tsx` | Estado financeiro sincronizado com o Supabase |
| `src/utils/storage.ts` | Catálogo (insumos, fichas, histórico, configurações) no Supabase |
| `src/components` | Telas de produção herdadas do Confeitaria Pro, com o novo visual |
| `supabase/migrations` | Schema do banco |
| `scripts/import_legacy.py` | Importação da planilha "Entradas e saídas" + backup JSON |

## Regras do modelo financeiro

- Tudo por **competência** (mês da despesa), como a planilha.
- **Meta diária** = maior valor entre o piso (R$ 1.500) e saídas do mês ÷ dias abertos.
- **Pró-labore** Jan–Ago: a planilha somava +R$ 7.000 fixos ao total de saídas; foram lançados como "Prolab Fran/Dani" (R$ 3.500 cada) para bater com a "Saúde dos meses".
- **DRE**: Simples/DARE → impostos sobre vendas; Insumos e Embalagens → CMV; INSS → pessoal; empréstimos abaixo do resultado operacional. Taxas de cartão são estimadas pelas taxas configuradas.
