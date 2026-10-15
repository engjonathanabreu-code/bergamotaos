import React, { useMemo, useState } from 'react';
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Card, CardHeader, Chip, MonthPicker, PageHeader, Progress, Tabs, CHART } from '../../ui';
import { useFinance } from '../../data/finance';
import type { FinanceSettings, FinGroup, SystemSettings } from '../../types';
import { breakEven, monthsWithData, projectCashFlow, summarizeMonth, weekdayAverages } from '../../utils/financeModel';
import { addMonths, compact, currentMonth, money, monthShort, pct, weekdayShort } from '../../lib/format';
import { GROUP_LABELS, MoneyTooltip, useModelData } from './shared';
import { parseMoney } from './CaixaView';

type Tab = 'equilibrio' | 'fluxo' | 'orcamento' | 'indicadores';

interface Props {
  fin: FinanceSettings;
  settings: SystemSettings;
  onSaveSettings: (s: SystemSettings) => void;
}

export function PlanejamentoView({ fin, settings, onSaveSettings }: Props) {
  const [tab, setTab] = useState<Tab>('equilibrio');
  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      <PageHeader title="Planejamento" subtitle="Ponto de equilíbrio, projeção de caixa, orçamento e indicadores" />
      <Card padded={false} className="mb-4 px-2">
        <Tabs
          value={tab}
          onChange={setTab}
          items={[
            { id: 'equilibrio', label: 'Equilíbrio e preço' },
            { id: 'fluxo', label: 'Fluxo de caixa' },
            { id: 'orcamento', label: 'Orçamento' },
            { id: 'indicadores', label: 'Indicadores' },
          ]}
        />
      </Card>
      {tab === 'equilibrio' && <Equilibrio fin={fin} settings={settings} onSaveSettings={onSaveSettings} />}
      {tab === 'fluxo' && <Fluxo fin={fin} />}
      {tab === 'orcamento' && <Orcamento fin={fin} />}
      {tab === 'indicadores' && <Indicadores fin={fin} />}
    </div>
  );
}

// ---------------------------------------------------------------------------

function Equilibrio({ fin, settings, onSaveSettings }: Props) {
  const data = useModelData(fin);
  const all = useMemo(() => monthsWithData(data, currentMonth()), [data]);
  const closed = all.filter((m) => m < currentMonth());
  const [window_, setWindow] = useState(3);
  const months = closed.slice(-window_);
  const be = useMemo(() => breakEven(months, data), [months, data]);
  const [applied, setApplied] = useState(false);

  const gap = be.receitaMedia - be.pontoEquilibrioMensal;
  const pontoPct = be.receitaMedia ? Math.min(100, (be.pontoEquilibrioMensal / be.receitaMedia) * 100) : 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-sm text-stone-600">
        Base de cálculo:
        {[3, 6, 12].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setWindow(n)}
            className={`px-3 h-8 rounded-full text-xs font-medium ${window_ === n ? 'bg-amber-500 text-white' : 'bg-white shadow-sm text-stone-600'}`}
          >
            últimos {n} meses
          </button>
        ))}
        <span className="text-xs text-stone-400">({months.map(monthShort).join(', ') || 'sem meses fechados'})</span>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Card className="xl:col-span-2">
          <CardHeader title="Ponto de equilíbrio" subtitle="Faturamento mínimo para pagar todas as contas (lucro zero)" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <div className="text-xs text-stone-500">Por mês</div>
              <div className="text-2xl xl:text-3xl font-light tabular text-stone-800">{money(be.pontoEquilibrioMensal)}</div>
            </div>
            <div>
              <div className="text-xs text-stone-500">Por dia aberto ({Math.round(be.diasAbertosMedio)} dias/mês)</div>
              <div className="text-2xl xl:text-3xl font-light tabular text-amber-600">{money(be.pontoEquilibrioDiario)}</div>
            </div>
            <div>
              <div className="text-xs text-stone-500">Faturamento médio</div>
              <div className={`text-2xl xl:text-3xl font-light tabular ${gap >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>{money(be.receitaMedia)}</div>
            </div>
          </div>
          <div className="mt-6">
            <div className="relative h-3 rounded-full bg-emerald-100 overflow-hidden">
              <div className="absolute inset-y-0 left-0 bg-rose-200" style={{ width: `${pontoPct}%` }} />
            </div>
            <div className="flex justify-between text-[11px] text-stone-500 mt-1.5">
              <span>Zona de prejuízo até {money(be.pontoEquilibrioMensal)}</span>
              <span>
                Margem de segurança{' '}
                <strong className={gap >= 0 ? 'text-emerald-700' : 'text-rose-600'}>{pct(be.margemSeguranca, 1)}</strong>
              </span>
            </div>
          </div>
          <div className="mt-5 text-sm text-stone-600 leading-relaxed">
            {gap >= 0 ? (
              <>A Bergamota fatura em média <strong>{money(gap)}</strong> por mês acima do ponto de equilíbrio. Cada R$ 100 vendidos deixam <strong>{money(be.margemContribuicaoPct)}</strong> para pagar custos fixos e lucro.</>
            ) : (
              <>Faltam em média <strong className="text-rose-600">{money(-gap)}</strong> por mês para empatar. É preciso vender cerca de <strong>{money(-gap / be.diasAbertosMedio)}</strong> a mais por dia, reduzir custos fixos ou aumentar a margem.</>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Estrutura de custos" subtitle="Média mensal" />
          <div className="space-y-3 text-sm">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-stone-600">Custos variáveis</span>
                <span className="tabular text-stone-800">{pct(be.custosVariaveisPct)}</span>
              </div>
              <Progress value={be.custosVariaveisPct} tone="brand" />
              <div className="mt-2 space-y-1">
                {Object.entries(be.detalhe.variaveis).map(([k, v]) => (
                  <Line_ key={k} label={k} value={v} base={be.receitaMedia} />
                ))}
              </div>
            </div>
            <div className="pt-2 border-t border-stone-100">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-stone-600">Custos fixos</span>
                <span className="tabular text-stone-800">{money(be.custosFixosMensais)}</span>
              </div>
              <div className="mt-1 space-y-1">
                {Object.entries(be.detalhe.fixos).map(([k, v]) => (
                  <Line_ key={k} label={k} value={v} base={be.receitaMedia} />
                ))}
              </div>
            </div>
            <div className="pt-2 border-t border-stone-100 flex justify-between text-xs">
              <span className="text-stone-600">Margem de contribuição</span>
              <span className="tabular font-medium text-emerald-700">{pct(be.margemContribuicaoPct)}</span>
            </div>
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Markup sugerido pelo financeiro"
          subtitle="Quanto multiplicar o custo direto (ingredientes + embalagem) para cobrir custos fixos, impostos, taxas e ainda sobrar o lucro desejado"
        />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <Info label="Custos fixos / receita" value={pct(be.despesasFixasPct)} />
          <Info label="Impostos + taxas + outras variáveis" value={pct(be.custosVariaveisPct - (be.receitaMedia ? (be.detalhe.variaveis['CMV (insumos e embalagens)'] / be.receitaMedia) * 100 : 0))} />
          <Info label="Lucro desejado" value={pct(fin.targetProfitPct, 0)} />
          <div>
            <div className="text-xs text-stone-500">Markup (divisor)</div>
            <div className="text-3xl font-light tabular text-amber-600">{be.markupSugerido ? `${be.markupSugerido.toFixed(2)}×` : '—'}</div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 mt-4">
          <span className="text-xs text-stone-500">
            Markup padrão atual das fichas: <strong className="text-stone-800">{settings.defaultMarkup.toFixed(2)}×</strong>
          </span>
          {be.markupSugerido > 0 && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                onSaveSettings({ ...settings, defaultMarkup: Math.round(be.markupSugerido * 100) / 100 });
                setApplied(true);
              }}
            >
              Aplicar como markup padrão
            </button>
          )}
          {applied && <Chip tone="good">Markup padrão atualizado</Chip>}
        </div>
        <p className="text-[11px] text-stone-400 mt-3">
          Fórmula: preço = custo direto ÷ (1 − custos fixos% − variáveis% − lucro%). O lucro desejado é ajustado em Configurações › Modelo financeiro.
          {be.markupSugerido === 0 && ' Com a estrutura atual a soma passa de 95% — não existe markup viável sem reduzir custos.'}
        </p>
      </Card>
    </div>
  );
}

function Line_({ label, value, base }: { label: string; value: number; base: number }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-stone-500 flex-1 truncate">{label}</span>
      <span className="tabular text-stone-700">{money(value)}</span>
      <span className="tabular text-stone-400 w-12 text-right">{base ? pct((value / base) * 100, 1) : '—'}</span>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-stone-500">{label}</div>
      <div className="text-xl tabular text-stone-800">{value}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function Fluxo({ fin }: { fin: FinanceSettings }) {
  const data = useModelData(fin);
  const { recurring } = useFinance();
  const [ahead, setAhead] = useState(3);
  const history = useMemo(() => monthsWithData(data, currentMonth()), [data]);
  const rows = useMemo(() => projectCashFlow(history, currentMonth(), ahead, data, recurring), [history, ahead, data, recurring]);
  const firstNeg = rows.find((r) => !r.realizado && r.acumulado < 0);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title="Entradas, saídas e saldo acumulado"
          subtitle="Barras cheias = realizado · barras claras = projeção"
          action={
            <select value={ahead} onChange={(e) => setAhead(Number(e.target.value))} className="h-8 px-2 bg-white border border-stone-200 rounded-[2px] text-xs">
              {[1, 3, 6].map((n) => (
                <option key={n} value={n}>Projetar {n} {n === 1 ? 'mês' : 'meses'}</option>
              ))}
            </select>
          }
        />
        <div className="flex flex-wrap gap-4 text-xs text-stone-600 mb-2">
          <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: CHART.green }} />Entradas</span>
          <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: CHART.brand }} />Saídas</span>
          <span className="inline-flex items-center gap-1.5"><span className="w-4 h-0.5" style={{ background: CHART.dark }} />Saldo acumulado</span>
        </div>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={rows} margin={{ top: 4, right: 4, left: 0, bottom: 0 }} barGap={2}>
              <CartesianGrid vertical={false} stroke={CHART.grid} />
              <XAxis dataKey="month" tickFormatter={monthShort} tick={{ fontSize: 11, fill: '#8A8A8A' }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={compact} tick={{ fontSize: 11, fill: '#8A8A8A' }} axisLine={false} tickLine={false} width={52} />
              <ReferenceLine y={0} stroke="#A6A6A6" />
              <Tooltip content={<MoneyTooltip labelFormatter={monthShort} />} cursor={{ fill: '#FAFAFA' }} />
              <Bar dataKey="receita" name="Entradas" fill={CHART.green} radius={[4, 4, 0, 0]} maxBarSize={22} shape={(p: any) => <rect {...rectProps(p)} fill={CHART.green} fillOpacity={p.payload.realizado ? 1 : 0.4} />} />
              <Bar dataKey="saidas" name="Saídas" fill={CHART.brand} radius={[4, 4, 0, 0]} maxBarSize={22} shape={(p: any) => <rect {...rectProps(p)} fill={CHART.brand} fillOpacity={p.payload.realizado ? 1 : 0.4} />} />
              <Line dataKey="acumulado" name="Acumulado" stroke={CHART.dark} strokeWidth={2} dot={{ r: 3 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        {firstNeg && (
          <p className="mt-3 text-sm text-rose-600">
            Atenção: pela projeção o saldo acumulado fica negativo em {monthShort(firstNeg.month)} ({money(firstNeg.acumulado)}).
          </p>
        )}
      </Card>

      <Card padded={false}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm tabular whitespace-nowrap">
            <thead>
              <tr className="text-[11px] uppercase tracking-wide text-stone-500 border-b border-stone-200 text-right">
                <th className="text-left px-4 py-3 font-medium">Mês</th>
                <th className="px-3 py-3 font-medium">Entradas</th>
                <th className="px-3 py-3 font-medium">Saídas lançadas</th>
                <th className="px-3 py-3 font-medium">Recorrentes a gerar</th>
                <th className="px-3 py-3 font-medium">Compras estimadas</th>
                <th className="px-3 py-3 font-medium">Saldo</th>
                <th className="px-4 py-3 font-medium">Acumulado</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.month} className={`border-b border-stone-100 text-right ${r.realizado ? '' : 'bg-amber-50/40'}`}>
                  <td className="text-left px-4 py-2 text-stone-700">
                    {monthShort(r.month)} {!r.realizado && <Chip tone="brand">projeção</Chip>}
                  </td>
                  <td className="px-3 py-2">{money(r.receita)}</td>
                  <td className="px-3 py-2 text-stone-600">{money(r.saidasPrevistas)}</td>
                  <td className="px-3 py-2 text-stone-400">{r.recorrentes ? money(r.recorrentes) : '—'}</td>
                  <td className="px-3 py-2 text-stone-400">{r.compras ? money(r.compras) : '—'}</td>
                  <td className={`px-3 py-2 font-medium ${r.saldo >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>{money(r.saldo)}</td>
                  <td className={`px-4 py-2 ${r.acumulado >= 0 ? 'text-stone-800' : 'text-rose-600'}`}>{money(r.acumulado)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="px-4 py-3 text-[11px] text-stone-400">
          Projeção: média diária dos últimos 3 meses fechados × dias de funcionamento. Saídas = contas já lançadas + recorrentes ativas ainda não geradas + compras estimadas pelo % histórico de compras sobre a receita.
        </p>
      </Card>
    </div>
  );
}

function rectProps(p: any) {
  const { x, y, width, height } = p;
  const h = Math.max(0, height);
  return { x, y: height < 0 ? y + height : y, width, height: h, rx: 3 };
}

// ---------------------------------------------------------------------------

const BUDGET_GROUPS: FinGroup[] = ['receita', 'compras', 'funcionario', 'fixa', 'variavel', 'esporadica'];

function Orcamento({ fin }: { fin: FinanceSettings }) {
  const data = useModelData(fin);
  const { budgets, setBudget } = useFinance();
  const [month, setMonth] = useState(currentMonth());
  const [draft, setDraft] = useState<Record<string, string>>({});

  const actual = useMemo(() => {
    const s = summarizeMonth(month, data, true);
    const byGrp: Record<string, number> = { receita: s.receitaBruta };
    for (const t of data.transactions.filter((t) => t.competencia === month && t.type === 'saida')) {
      byGrp[t.grp] = (byGrp[t.grp] || 0) + t.value;
    }
    return byGrp;
  }, [month, data]);

  // Sugestão: média dos 3 meses anteriores
  const suggestion = useMemo(() => {
    const prev = [1, 2, 3].map((i) => addMonths(month, -i));
    const out: Record<string, number> = {};
    for (const g of BUDGET_GROUPS) {
      out[g] =
        prev.reduce((acc, m) => {
          if (g === 'receita') return acc + summarizeMonth(m, data, false).receitaBruta;
          return acc + data.transactions.filter((t) => t.competencia === m && t.type === 'saida' && t.grp === g).reduce((a, t) => a + t.value, 0);
        }, 0) / 3;
    }
    return out;
  }, [month, data]);

  const budgetOf = (g: FinGroup) => budgets.find((b) => b.competencia === month && b.grp === g)?.value;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <MonthPicker value={month} onChange={setMonth} />
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => BUDGET_GROUPS.forEach((g) => budgetOf(g) === undefined && suggestion[g] > 0 && setBudget(month, g, Math.round(suggestion[g])))}
        >
          Preencher com média dos últimos 3 meses
        </button>
      </div>
      <Card padded={false}>
        {BUDGET_GROUPS.map((g) => {
          const b = budgetOf(g);
          const a = actual[g] || 0;
          const used = b ? (a / b) * 100 : 0;
          const isRevenue = g === 'receita';
          const tone = !b ? 'neutral' : isRevenue ? (used >= 100 ? 'good' : 'brand') : used > 100 ? 'bad' : used > 85 ? 'brand' : 'good';
          return (
            <div key={g} className="px-4 py-4 border-b border-stone-100 last:border-0">
              <div className="flex flex-wrap items-center gap-3">
                <div className="w-40">
                  <div className="text-sm text-stone-800">{isRevenue ? 'Meta de faturamento' : GROUP_LABELS[g]}</div>
                  <div className="text-[11px] text-stone-400">média 3m: {money(suggestion[g])}</div>
                </div>
                <div className="flex-1 min-w-40">
                  <Progress value={used} tone={tone as any} />
                  <div className="flex justify-between text-[11px] text-stone-500 mt-1">
                    <span>{isRevenue ? 'Faturado' : 'Gasto'} {money(a)}</span>
                    <span>{b ? pct(used, 0) : 'sem orçamento'}</span>
                  </div>
                </div>
                <label className="w-36">
                  <span className="field-label">Orçado (R$)</span>
                  <input
                    className="field tabular"
                    inputMode="decimal"
                    value={draft[`${month}-${g}`] ?? (b !== undefined ? String(b).replace('.', ',') : '')}
                    placeholder={suggestion[g] ? String(Math.round(suggestion[g])) : '0'}
                    onChange={(e) => setDraft({ ...draft, [`${month}-${g}`]: e.target.value })}
                    onBlur={(e) => {
                      if (e.target.value.trim() === '') return;
                      setBudget(month, g, parseMoney(e.target.value));
                    }}
                  />
                </label>
              </div>
            </div>
          );
        })}
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------

function Indicadores({ fin }: { fin: FinanceSettings }) {
  const data = useModelData(fin);
  const months = useMemo(() => monthsWithData(data, currentMonth()).filter((m) => data.sales.some((s) => s.date.startsWith(m))), [data]);
  const monthly = useMemo(
    () =>
      months.map((m) => {
        const s = summarizeMonth(m, data, false);
        return {
          month: m,
          ticket: s.ticketMedio,
          vendas: s.tickets,
          vendasDia: s.diasComVenda ? s.tickets / s.diasComVenda : 0,
          cmvPct: s.receitaBruta ? (s.lines.cmv / s.receitaBruta) * 100 : 0,
          pessoalPct: s.receitaBruta ? ((s.lines.pessoal + s.lines.prolabore) / s.receitaBruta) * 100 : 0,
          fixasPct: s.receitaBruta ? (s.lines.fixas / s.receitaBruta) * 100 : 0,
        };
      }),
    [months, data]
  );
  const last6 = months.slice(-6);
  const weekday = useMemo(() => weekdayAverages(last6, data).filter((w) => w.dias > 0), [last6, data]);
  const bestDay = weekday.reduce((a, b) => (b.media > (a?.media || 0) ? b : a), weekday[0]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card>
        <CardHeader title="Ticket médio por mês" subtitle="Vendas consolidadas ficam fora do cálculo" />
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={monthly} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke={CHART.grid} />
              <XAxis dataKey="month" tickFormatter={monthShort} tick={{ fontSize: 11, fill: '#8A8A8A' }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={(v) => `R$${Math.round(v)}`} tick={{ fontSize: 11, fill: '#8A8A8A' }} axisLine={false} tickLine={false} width={48} domain={['auto', 'auto']} />
              <Tooltip content={<MoneyTooltip labelFormatter={monthShort} />} />
              <Line dataKey="ticket" name="Ticket médio" stroke={CHART.brandDark} strokeWidth={2} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card>
        <CardHeader title="Venda média por dia da semana" subtitle={`Últimos ${last6.length} meses${bestDay ? ` · melhor dia: ${weekdayShort(bestDay.weekday)}` : ''}`} />
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={weekday} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke={CHART.grid} />
              <XAxis dataKey="weekday" tickFormatter={weekdayShort} tick={{ fontSize: 11, fill: '#8A8A8A' }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={compact} tick={{ fontSize: 11, fill: '#8A8A8A' }} axisLine={false} tickLine={false} width={48} />
              <Tooltip content={<MoneyTooltip labelFormatter={(d: number) => weekdayShort(d)} />} cursor={{ fill: '#FFF6EB' }} />
              <Bar dataKey="media" name="Média do dia" fill={CHART.brand} radius={[4, 4, 0, 0]} maxBarSize={40} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card className="lg:col-span-2" padded={false}>
        <div className="p-4 sm:p-5 pb-2">
          <CardHeader title="Indicadores mensais" subtitle="Percentuais sobre a receita bruta do mês" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm tabular whitespace-nowrap">
            <thead>
              <tr className="text-[11px] uppercase tracking-wide text-stone-500 border-b border-stone-200 text-right">
                <th className="text-left px-4 py-2 font-medium">Mês</th>
                <th className="px-3 py-2 font-medium">Vendas</th>
                <th className="px-3 py-2 font-medium">Vendas/dia</th>
                <th className="px-3 py-2 font-medium">Ticket</th>
                <th className="px-3 py-2 font-medium">CMV</th>
                <th className="px-3 py-2 font-medium">Pessoal</th>
                <th className="px-4 py-2 font-medium">Fixas</th>
              </tr>
            </thead>
            <tbody>
              {monthly.map((r) => (
                <tr key={r.month} className="border-b border-stone-100 text-right">
                  <td className="text-left px-4 py-2 text-stone-700">{monthShort(r.month)}</td>
                  <td className="px-3 py-2">{r.vendas}</td>
                  <td className="px-3 py-2">{r.vendasDia.toFixed(1)}</td>
                  <td className="px-3 py-2">{money(r.ticket)}</td>
                  <td className="px-3 py-2">{pct(r.cmvPct)}</td>
                  <td className="px-3 py-2">{pct(r.pessoalPct)}</td>
                  <td className="px-4 py-2">{pct(r.fixasPct)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
