import React, { useMemo, useState } from 'react';
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { AlertTriangle, CalendarClock, Receipt, ShoppingBag, TrendingUp, Wallet, Cake } from 'lucide-react';
import { Card, CardHeader, Chip, ListItem, MonthPicker, PageHeader, Progress, Stat, CHART } from '../../ui';
import { useFinance } from '../../data/finance';
import type { FinanceSettings, Ingredient, Recipe, SystemSettings } from '../../types';
import { SALE_METHOD_LABELS } from '../../types';
import { dailySeries, monthsWithData, summarizeMonth } from '../../utils/financeModel';
import { calculateRecipeCost } from '../../utils/pricing';
import { addMonths, compact, currentMonth, dayMonth, fullDate, money, monthShort, pct, todayISO } from '../../lib/format';
import { METHODS, MoneyTooltip, useModelData } from './shared';
import type { ActiveTab } from '../../nav';

interface Props {
  fin: FinanceSettings;
  settings: SystemSettings;
  recipes: Recipe[];
  ingredients: Ingredient[];
  onNavigate: (tab: ActiveTab) => void;
}

export function PainelView({ fin, settings, recipes, ingredients, onNavigate }: Props) {
  const data = useModelData(fin);
  const { transactions } = useFinance();
  const [month, setMonth] = useState(currentMonth());

  const s = useMemo(() => summarizeMonth(month, data), [month, data]);
  const prev = useMemo(() => summarizeMonth(addMonths(month, -1), data), [month, data]);
  const series = useMemo(() => {
    const pts = dailySeries(month, data);
    const withSales = pts.filter((p) => p.total > 0);
    const media = withSales.length ? withSales.reduce((a, p) => a + p.total, 0) / withSales.length : 0;
    return pts.map((p) => ({ ...p, media, meta: s.metaDiaria }));
  }, [month, data, s.metaDiaria]);

  const months = useMemo(() => monthsWithData(data, currentMonth()), [data]);
  const health = useMemo(() => {
    let acc = 0;
    return months
      .filter((m) => m.startsWith(month.slice(0, 4)))
      .map((m) => {
        const x = summarizeMonth(m, data);
        acc += x.saldoCaixa;
        return { month: m, entradas: x.receitaBruta, saidas: x.totalSaidas, saldo: x.saldoCaixa, acumulado: acc };
      });
  }, [months, month, data]);

  const today = todayISO();
  const upcoming = useMemo(
    () =>
      transactions
        .filter((t) => t.status === 'previsto' && t.type === 'saida')
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(0, 6),
    [transactions]
  );

  const ingredientMap = useMemo(() => new Map(ingredients.map((i) => [i.id, i])), [ingredients]);
  const marginAlerts = useMemo(
    () =>
      recipes
        .filter((r) => r.active && (r.practicedPrice || 0) > 0 && (r.markup || 0) > 1)
        .map((r) => ({ r, c: calculateRecipeCost(r, ingredientMap, settings) }))
        .filter(({ c }) => c.realMarginPercentage < 30)
        .sort((a, b) => a.c.realMarginPercentage - b.c.realMarginPercentage)
        .slice(0, 5),
    [recipes, ingredientMap, settings]
  );

  const delta = (a: number, b: number) => (b ? ((a - b) / b) * 100 : null);
  const isCurrent = month === currentMonth();
  const vendidoHoje = data.sales.filter((x) => x.date === today).reduce((a, x) => a + x.amount, 0);
  const metaPct = s.metaDiaria ? (s.mediaDiaria / s.metaDiaria) * 100 : 0;
  const saldoTone = s.saldoCaixa >= 0 ? 'good' : 'bad';

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      <PageHeader
        title={`Olá, ${settings.companyName || 'Bergamota'}`}
        subtitle="Visão geral do negócio no mês"
        actions={<MonthPicker value={month} onChange={setMonth} />}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Stat
          label="Faturamento"
          value={money(s.receitaBruta)}
          tone="brand"
          icon={<TrendingUp className="w-4 h-4" />}
          delta={delta(s.receitaBruta, prev.receitaBruta)}
          hint={<span>vs {monthShort(addMonths(month, -1))}</span>}
        />
        <Stat
          label="Saídas"
          value={money(s.totalSaidas)}
          icon={<Receipt className="w-4 h-4" />}
          hint={s.previstoPendente > 0 ? <span>{money(s.previstoPendente)} a pagar</span> : <span>tudo pago</span>}
        />
        <Stat
          label="Saldo do mês"
          value={money(s.saldoCaixa)}
          tone={saldoTone}
          icon={<Wallet className="w-4 h-4" />}
          hint={<span>resultado DRE {money(s.resultadoLiquido)}</span>}
        />
        <Stat
          label="Ticket médio"
          value={money(s.ticketMedio)}
          icon={<ShoppingBag className="w-4 h-4" />}
          delta={delta(s.ticketMedio, prev.ticketMedio)}
          hint={<span>{s.tickets} vendas</span>}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Venda diária × média × meta"
            subtitle={`Meta do dia ${money(s.metaDiaria)} · média ${money(s.mediaDiaria)} em ${s.diasComVenda} dias`}
            action={
              <div className="hidden sm:flex items-center gap-3 text-xs text-stone-600">
                <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: CHART.brand }} />Venda</span>
                <span className="inline-flex items-center gap-1.5"><span className="w-4 h-0.5" style={{ background: CHART.blue }} />Média</span>
                <span className="inline-flex items-center gap-1.5"><span className="w-4 h-0.5 border-t-2 border-dashed" style={{ borderColor: CHART.red }} />Meta</span>
              </div>
            }
          />
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={series} margin={{ top: 4, right: 4, left: 0, bottom: 0 }} barCategoryGap={3}>
                <CartesianGrid vertical={false} stroke={CHART.grid} />
                <XAxis dataKey="date" tickFormatter={(d) => d.slice(8, 10)} tick={{ fontSize: 11, fill: '#8A8A8A' }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={compact} tick={{ fontSize: 11, fill: '#8A8A8A' }} axisLine={false} tickLine={false} width={48} />
                <Tooltip content={<MoneyTooltip labelFormatter={(d: string) => fullDate(d)} />} cursor={{ fill: '#FFF6EB' }} />
                <Bar dataKey="total" name="Venda" fill={CHART.brand} radius={[4, 4, 0, 0]} maxBarSize={26} />
                <Line dataKey="media" name="Média" stroke={CHART.blue} strokeWidth={2} dot={false} />
                <Line dataKey="meta" name="Meta" stroke={CHART.red} strokeWidth={2} strokeDasharray="5 4" dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <CardHeader title={isCurrent ? 'Hoje' : 'Ritmo do mês'} />
          {isCurrent && (
            <div className="mb-5">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <span className="text-3xl font-light tabular text-stone-800">{money(vendidoHoje)}</span>
                <span className="text-xs text-stone-500">meta {money(s.metaDiaria)}</span>
              </div>
              <div className="mt-2">
                <Progress value={s.metaDiaria ? (vendidoHoje / s.metaDiaria) * 100 : 0} tone={vendidoHoje >= s.metaDiaria ? 'good' : 'brand'} />
              </div>
              <button type="button" className="btn btn-primary w-full mt-4" onClick={() => onNavigate('fin-caixa')}>
                Abrir caixa do dia
              </button>
            </div>
          )}
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-xs text-stone-600 mb-1">
                <span>Média diária vs meta</span>
                <span className="tabular">{pct(metaPct, 0)}</span>
              </div>
              <Progress value={metaPct} tone={metaPct >= 100 ? 'good' : metaPct >= 85 ? 'brand' : 'bad'} />
            </div>
            <div className="pt-2">
              <span className="section-label">Formas de pagamento</span>
              <div className="flex h-2.5 mt-2 rounded-full overflow-hidden gap-[2px] bg-white">
                {METHODS.map((m) =>
                  s.byMethod[m] > 0 ? (
                    <div key={m} style={{ width: `${(s.byMethod[m] / (s.receitaVendas || 1)) * 100}%`, background: CHART.methods[m] }} title={SALE_METHOD_LABELS[m]} />
                  ) : null
                )}
              </div>
              <div className="mt-2 space-y-1">
                {METHODS.map((m) => (
                  <div key={m} className="flex items-center gap-2 text-xs">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: CHART.methods[m] }} />
                    <span className="text-stone-600">{SALE_METHOD_LABELS[m]}</span>
                    <span className="ml-auto tabular text-stone-800">{money(s.byMethod[m])}</span>
                    <span className="w-10 text-right tabular text-stone-400">{pct(s.receitaVendas ? (s.byMethod[m] / s.receitaVendas) * 100 : 0, 0)}</span>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-stone-400 mt-2">Taxas de cartão estimadas: {money(s.taxasCartao)}</p>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
        <Card className="lg:col-span-2" padded={false}>
          <div className="p-4 sm:p-5 pb-2">
            <CardHeader title={`Saúde dos meses — ${month.slice(0, 4)}`} subtitle="Entradas − saídas por competência, como na planilha" />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm tabular whitespace-nowrap">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-stone-500 border-b border-stone-100">
                  <th className="px-4 sm:px-5 py-2 font-medium">Mês</th>
                  <th className="px-3 py-2 font-medium text-right">Entradas</th>
                  <th className="px-3 py-2 font-medium text-right">Saídas</th>
                  <th className="px-3 py-2 font-medium text-right">Saldo</th>
                  <th className="px-4 sm:px-5 py-2 font-medium text-right">Acumulado</th>
                </tr>
              </thead>
              <tbody>
                {health.map((h) => (
                  <tr
                    key={h.month}
                    onClick={() => setMonth(h.month)}
                    className={`border-b border-stone-50 cursor-pointer hover:bg-stone-50 ${h.month === month ? 'bg-amber-50/60' : ''}`}
                  >
                    <td className="px-4 sm:px-5 py-2 text-stone-700 capitalize">
                      {monthShort(h.month)} {h.month > currentMonth() && <span className="text-[10px] text-amber-600 normal-case">previsto</span>}
                    </td>
                    <td className="px-3 py-2 text-right">{money(h.entradas)}</td>
                    <td className="px-3 py-2 text-right text-stone-600">{money(h.saidas)}</td>
                    <td className={`px-3 py-2 text-right font-medium ${h.saldo >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>{money(h.saldo)}</td>
                    <td className={`px-4 sm:px-5 py-2 text-right ${h.acumulado >= 0 ? 'text-stone-700' : 'text-rose-600'}`}>{money(h.acumulado)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <div className="space-y-4">
          <Card padded={false}>
            <div className="p-4 pb-1 flex items-center justify-between">
              <span className="section-label">Próximas contas</span>
              <button type="button" className="btn btn-text h-7" onClick={() => onNavigate('fin-despesas')}>
                Ver todas
              </button>
            </div>
            {upcoming.length === 0 ? (
              <p className="px-4 pb-4 text-xs text-stone-500">Nenhuma conta prevista.</p>
            ) : (
              upcoming.map((t) => (
                <ListItem
                  key={t.id}
                  icon={<CalendarClock className="w-4 h-4" />}
                  iconBg={t.date < today ? 'bg-rose-500' : 'bg-stone-400'}
                  title={t.description}
                  subtitle={t.category}
                  right={
                    <>
                      <div className="text-sm tabular text-stone-800">{money(t.value)}</div>
                      <div className={`text-[11px] ${t.date < today ? 'text-rose-600' : 'text-stone-400'}`}>{dayMonth(t.date)}</div>
                    </>
                  }
                />
              ))
            )}
          </Card>

          <Card padded={false}>
            <div className="p-4 pb-1 flex items-center justify-between">
              <span className="section-label">Margens baixas (&lt; 30%)</span>
              <button type="button" className="btn btn-text h-7" onClick={() => onNavigate('pricing')}>
                Precificar
              </button>
            </div>
            {marginAlerts.length === 0 ? (
              <p className="px-4 pb-4 text-xs text-stone-500">Todas as fichas vendidas estão com margem saudável.</p>
            ) : (
              marginAlerts.map(({ r, c }) => (
                <ListItem
                  key={r.id}
                  icon={c.realMarginPercentage < 0 ? <AlertTriangle className="w-4 h-4" /> : <Cake className="w-4 h-4" />}
                  iconBg={c.realMarginPercentage < 0 ? 'bg-rose-500' : 'bg-amber-500'}
                  title={r.name}
                  subtitle={`Custo ${money(c.costPerUnit)} · preço ${money(c.practicedPrice)}`}
                  right={<Chip tone={c.realMarginPercentage < 0 ? 'bad' : 'brand'}>{pct(c.realMarginPercentage, 0)}</Chip>}
                />
              ))
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
