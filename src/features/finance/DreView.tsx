import React, { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell } from 'recharts';
import { Card, CardHeader, PageHeader, Switch, CHART } from '../../ui';
import type { FinanceSettings } from '../../types';
import { monthsWithData, summarizeMonth, type MonthSummary } from '../../utils/financeModel';
import { compact, currentMonth, money, monthShort, pct } from '../../lib/format';
import { MoneyTooltip, useModelData } from './shared';

type Row = {
  label: string;
  get: (s: MonthSummary) => number;
  kind: 'line' | 'minus' | 'total' | 'result';
  hint?: string;
};

const ROWS: Row[] = [
  { label: 'Receita de vendas', get: (s) => s.receitaVendas, kind: 'line' },
  { label: 'Outras receitas', get: (s) => s.outrasReceitas, kind: 'line' },
  { label: 'Receita bruta', get: (s) => s.receitaBruta, kind: 'total' },
  { label: 'Impostos sobre vendas', get: (s) => s.lines.impostos_vendas, kind: 'minus', hint: 'Simples Nacional e DARE' },
  { label: 'Taxas de cartão (estimado)', get: (s) => s.taxasCartao, kind: 'minus', hint: 'Calculado pelas taxas em Configurações' },
  { label: 'Receita líquida', get: (s) => s.receitaLiquida, kind: 'total' },
  { label: 'CMV — insumos e embalagens', get: (s) => s.lines.cmv, kind: 'minus' },
  { label: 'Lucro bruto', get: (s) => s.lucroBruto, kind: 'total' },
  { label: 'Outras compras operacionais', get: (s) => s.lines.outras_compras, kind: 'minus', hint: 'Equipamentos, decoração, limpeza, entrega...' },
  { label: 'Pessoal e encargos', get: (s) => s.lines.pessoal, kind: 'minus' },
  { label: 'Pró-labore', get: (s) => s.lines.prolabore, kind: 'minus' },
  { label: 'Despesas fixas', get: (s) => s.lines.fixas, kind: 'minus' },
  { label: 'Despesas variáveis', get: (s) => s.lines.variaveis, kind: 'minus' },
  { label: 'Despesas esporádicas', get: (s) => s.lines.esporadicas, kind: 'minus' },
  { label: 'Resultado operacional', get: (s) => s.resultadoOperacional, kind: 'total' },
  { label: 'Empréstimos e financiamentos', get: (s) => s.lines.financeiro, kind: 'minus' },
  { label: 'Resultado líquido', get: (s) => s.resultadoLiquido, kind: 'result' },
];

export function DreView({ fin }: { fin: FinanceSettings }) {
  const data = useModelData(fin);
  const allMonths = useMemo(() => monthsWithData(data, currentMonth()), [data]);
  const years = useMemo(() => Array.from(new Set(allMonths.map((m) => m.slice(0, 4)))), [allMonths]);
  const [year, setYear] = useState(currentMonth().slice(0, 4));
  const [includePrevisto, setIncludePrevisto] = useState(false);
  const [showPct, setShowPct] = useState(false);

  const months = allMonths.filter((m) => m.startsWith(year));
  const sums = useMemo(() => months.map((m) => summarizeMonth(m, data, includePrevisto)), [months, data, includePrevisto]);

  const total = (r: Row) => sums.reduce((a, s) => a + r.get(s), 0);
  const receitaTotal = sums.reduce((a, s) => a + s.receitaBruta, 0);
  const closedSums = sums.filter((s) => s.month < currentMonth());
  const avgPct = (f: (s: MonthSummary) => number) => {
    const rec = closedSums.reduce((a, s) => a + s.receitaBruta, 0);
    return rec ? (closedSums.reduce((a, s) => a + f(s), 0) / rec) * 100 : 0;
  };

  const chart = sums.map((s) => ({ month: s.month, resultado: s.resultadoLiquido }));

  const cell = (v: number, rec: number, kind: Row['kind']) => {
    const val = kind === 'minus' ? -v : v;
    if (showPct) return rec ? pct((val / rec) * 100, 1) : '—';
    return v === 0 && kind === 'minus' ? '—' : money(val);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      <PageHeader
        title="DRE — Demonstração do Resultado"
        subtitle="Por competência. Entradas = vendas do caixa; saídas classificadas pelas categorias."
        actions={
          <>
            <Switch checked={showPct} onChange={setShowPct} label="% da receita" />
            <Switch checked={includePrevisto} onChange={setIncludePrevisto} label="Incluir previstos" />
            <select value={year} onChange={(e) => setYear(e.target.value)} className="h-9 px-3 bg-white shadow-sm rounded-[2px] text-sm">
              {years.map((y) => (
                <option key={y}>{y}</option>
              ))}
            </select>
          </>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <Kpi label="Margem bruta" value={pct(avgPct((s) => s.lucroBruto))} hint="Receita líquida − CMV" />
        <Kpi label="CMV" value={pct(avgPct((s) => s.lines.cmv))} hint="Insumos e embalagens / receita" />
        <Kpi label="Pessoal + pró-labore" value={pct(avgPct((s) => s.lines.pessoal + s.lines.prolabore))} hint="Folha / receita" />
        <Kpi label="Margem líquida" value={pct(avgPct((s) => s.resultadoLiquido))} hint="Meses fechados do ano" tone={avgPct((s) => s.resultadoLiquido) >= 0 ? 'good' : 'bad'} />
      </div>

      <Card padded={false}>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px] tabular">
            <thead>
              <tr className="text-[11px] uppercase tracking-wide text-stone-500 border-b border-stone-200">
                <th className="sticky left-0 bg-white text-left font-medium px-4 py-3 min-w-56">Conta</th>
                {sums.map((s) => (
                  <th key={s.month} className={`text-right font-medium px-3 py-3 whitespace-nowrap ${s.month >= currentMonth() ? 'text-amber-600' : ''}`}>
                    {monthShort(s.month)}
                  </th>
                ))}
                <th className="text-right font-medium px-4 py-3 bg-stone-50">Total</th>
                <th className="text-right font-medium px-4 py-3 bg-stone-50">%</th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map((r) => {
                const tot = total(r);
                const strong = r.kind === 'total' || r.kind === 'result';
                return (
                  <tr
                    key={r.label}
                    className={`border-b border-stone-100 ${r.kind === 'result' ? 'bg-amber-50/50' : strong ? 'bg-stone-50/60' : ''}`}
                    title={r.hint}
                  >
                    <td className={`sticky left-0 px-4 py-2 ${r.kind === 'result' ? 'bg-amber-50' : strong ? 'bg-stone-50' : 'bg-white'} ${strong ? 'font-medium text-stone-800' : 'text-stone-600 pl-7'}`}>
                      {r.kind === 'minus' ? '(−) ' : strong ? '= ' : ''}
                      {r.label}
                    </td>
                    {sums.map((s) => {
                      const v = r.get(s);
                      const neg = (r.kind === 'total' || r.kind === 'result') && v < 0;
                      return (
                        <td key={s.month} className={`text-right px-3 py-2 whitespace-nowrap ${neg ? 'text-rose-600' : strong ? 'text-stone-800 font-medium' : 'text-stone-600'}`}>
                          {cell(v, s.receitaBruta, r.kind)}
                        </td>
                      );
                    })}
                    <td className={`text-right px-4 py-2 bg-stone-50 whitespace-nowrap ${strong ? 'font-medium' : ''} ${(strong && tot < 0) ? 'text-rose-600' : 'text-stone-800'}`}>
                      {cell(tot, receitaTotal, r.kind)}
                    </td>
                    <td className="text-right px-4 py-2 bg-stone-50 text-stone-500 whitespace-nowrap">
                      {receitaTotal ? pct(((r.kind === 'minus' ? -tot : tot) / receitaTotal) * 100, 1) : '—'}
                    </td>
                  </tr>
                );
              })}
              <tr className="text-stone-500">
                <td className="sticky left-0 bg-white px-4 py-2 text-xs">Saldo de caixa (planilha: entradas − saídas)</td>
                {sums.map((s) => (
                  <td key={s.month} className="text-right px-3 py-2 text-xs whitespace-nowrap">{money(s.saldoCaixa)}</td>
                ))}
                <td className="text-right px-4 py-2 text-xs bg-stone-50">{money(sums.reduce((a, s) => a + s.saldoCaixa, 0))}</td>
                <td className="bg-stone-50" />
              </tr>
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="mt-4">
        <CardHeader title="Resultado líquido por mês" subtitle="Verde = lucro, vermelho = prejuízo" />
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chart} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke={CHART.grid} />
              <XAxis dataKey="month" tickFormatter={monthShort} tick={{ fontSize: 11, fill: '#8A8A8A' }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={compact} tick={{ fontSize: 11, fill: '#8A8A8A' }} axisLine={false} tickLine={false} width={48} />
              <ReferenceLine y={0} stroke="#A6A6A6" />
              <Tooltip content={<MoneyTooltip labelFormatter={monthShort} />} cursor={{ fill: '#FAFAFA' }} />
              <Bar dataKey="resultado" name="Resultado" radius={[4, 4, 0, 0]} maxBarSize={36}>
                {chart.map((c) => (
                  <Cell key={c.month} fill={c.resultado >= 0 ? CHART.green : CHART.red} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}

function Kpi({ label, value, hint, tone }: { label: string; value: string; hint: string; tone?: 'good' | 'bad' }) {
  return (
    <Card>
      <div className="section-label">{label}</div>
      <div className={`text-2xl tabular mt-1 ${tone === 'good' ? 'text-emerald-700' : tone === 'bad' ? 'text-rose-600' : 'text-stone-800'}`}>{value}</div>
      <div className="text-[11px] text-stone-400 mt-0.5">{hint}</div>
    </Card>
  );
}
