import React, { useMemo, useState } from 'react';
import { Banknote, CreditCard, Layers, QrCode, ShoppingBag, Trash2, Wallet } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card, CardHeader, CHART, EmptyState, MonthPicker, PageHeader, Stat, Tabs } from '../../ui';
import { useFinance } from '../../data/finance';
import { SALE_METHOD_LABELS, type Sale, type SaleMethod } from '../../types';
import { compact, currentMonth, daysInMonth, fullDate, money, monthLong, pct } from '../../lib/format';
import { MoneyTooltip } from './shared';

const ALL_METHODS: SaleMethod[] = ['dinheiro', 'pix', 'debito', 'credito', 'outro'];

const ICONS: Record<SaleMethod, React.ReactNode> = {
  dinheiro: <Banknote />,
  pix: <QrCode />,
  debito: <CreditCard />,
  credito: <Wallet />,
  outro: <Layers />,
};

type View = 'dashboard' | 'historico';
type Grain = 'dia' | 'semana';

const pad = (n: number) => String(n).padStart(2, '0');

export function VendasView() {
  const { sales, deleteSale } = useFinance();
  const [month, setMonth] = useState(currentMonth());
  const [view, setView] = useState<View>('dashboard');
  const [grain, setGrain] = useState<Grain>('dia');

  const monthSales = useMemo(() => sales.filter((s) => s.date.startsWith(month)), [sales, month]);

  const stats = useMemo(() => {
    const byMethod: Record<SaleMethod, number> = { dinheiro: 0, pix: 0, debito: 0, credito: 0, outro: 0 };
    const products = new Map<string, { name: string; qty: number; total: number }>();
    const byDay = new Map<string, number>();
    let revenue = 0;
    let tickets = 0;
    let ticketSum = 0;
    let items = 0;
    for (const s of monthSales) {
      revenue += s.amount;
      byMethod[s.method] += s.amount;
      byDay.set(s.date, (byDay.get(s.date) ?? 0) + s.amount);
      if (!s.is_aggregate) {
        tickets++;
        ticketSum += s.amount;
      }
      if (s.product_name) {
        const qty = s.quantity ?? 1;
        const key = s.recipe_id || s.product_name;
        const cur = products.get(key) ?? { name: s.product_name, qty: 0, total: 0 };
        cur.qty += qty;
        cur.total += s.amount;
        items += qty;
        products.set(key, cur);
      }
    }
    const ranking = [...products.values()].sort((a, b) => b.qty - a.qty || b.total - a.total).slice(0, 10);
    return { byMethod, byDay, ranking, revenue, tickets, items, ticketMedio: tickets ? ticketSum / tickets : 0 };
  }, [monthSales]);

  const chartData = useMemo(() => {
    const last = daysInMonth(month);
    if (grain === 'dia') {
      return Array.from({ length: last }, (_, i) => {
        const day = i + 1;
        return { label: `${pad(day)}`, total: stats.byDay.get(`${month}-${pad(day)}`) ?? 0 };
      });
    }
    const weeks: { label: string; total: number }[] = [];
    for (let start = 1; start <= last; start += 7) {
      const end = Math.min(start + 6, last);
      let total = 0;
      for (let d = start; d <= end; d++) total += stats.byDay.get(`${month}-${pad(d)}`) ?? 0;
      weeks.push({ label: start === end ? `${start}` : `${start}–${end}`, total });
    }
    return weeks;
  }, [month, grain, stats.byDay]);

  const historico = useMemo(() => {
    const groups = new Map<string, Sale[]>();
    for (const s of monthSales) groups.set(s.date, [...(groups.get(s.date) ?? []), s]);
    return [...groups.entries()]
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([date, rows]) => ({
        date,
        total: rows.reduce((t, r) => t + r.amount, 0),
        rows: [...rows].sort((a, b) => (b.created_at || '').localeCompare(a.created_at || '')),
      }));
  }, [monthSales]);

  const topQty = stats.ranking[0]?.qty ?? 0;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
      <PageHeader
        title="Vendas"
        subtitle={`Produtos vendidos em ${monthLong(month)}`}
        actions={<MonthPicker value={month} onChange={setMonth} />}
      />

      <div className="mb-5">
        <Tabs
          value={view}
          onChange={setView}
          items={[
            { id: 'dashboard', label: 'Dashboard' },
            { id: 'historico', label: 'Histórico' },
          ]}
        />
      </div>

      {monthSales.length === 0 ? (
        <Card>
          <EmptyState
            icon={<ShoppingBag className="w-6 h-6" />}
            title="Nenhuma venda neste mês"
            text="As vendas lançadas no Caixa do dia aparecem aqui."
          />
        </Card>
      ) : view === 'dashboard' ? (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            <Stat label="Faturamento" value={money(stats.revenue)} hint="no mês" />
            <Stat label="Vendas" value={String(stats.tickets)} hint="tickets" />
            <Stat label="Itens vendidos" value={String(stats.items)} hint="unidades de produtos" />
            <Stat label="Ticket médio" value={money(stats.ticketMedio)} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-4">
            <Card className="lg:col-span-3">
              <CardHeader
                title="Faturamento"
                action={
                  <div className="flex gap-1 shrink-0">
                    {(['dia', 'semana'] as Grain[]).map((g) => (
                      <button
                        key={g}
                        type="button"
                        onClick={() => setGrain(g)}
                        className={`px-2.5 h-7 rounded-[2px] text-[11px] font-medium uppercase tracking-wide ${
                          grain === g ? 'bg-amber-50 text-amber-700' : 'text-stone-500 hover:text-stone-800'
                        }`}
                      >
                        {g === 'dia' ? 'Dia' : 'Semana'}
                      </button>
                    ))}
                  </div>
                }
              />
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke={CHART.grid} vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke={CHART.grey} interval={grain === 'dia' ? 1 : 0} />
                    <YAxis tickFormatter={compact} tick={{ fontSize: 11 }} stroke={CHART.grey} width={48} />
                    <Tooltip content={<MoneyTooltip />} cursor={{ fill: '#FFF7EC' }} />
                    <Bar dataKey="total" name="Faturamento" fill={CHART.brand} radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader title="Forma de pagamento" />
              {ALL_METHODS.map((m) => {
                const v = stats.byMethod[m];
                const share = stats.revenue ? (v / stats.revenue) * 100 : 0;
                return (
                  <div key={m} className="mb-3 last:mb-0">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ background: CHART.methods[m] }} />
                      <span className="text-stone-600">{SALE_METHOD_LABELS[m]}</span>
                      <span className="ml-auto tabular text-stone-800">{money(v)}</span>
                      <span className="w-12 text-right text-xs tabular text-stone-500">{pct(share, 0)}</span>
                    </div>
                    <div className="h-1.5 mt-1.5 rounded-full bg-stone-100 overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${share}%`, background: CHART.methods[m] }} />
                    </div>
                  </div>
                );
              })}
            </Card>
          </div>

          <Card>
            <CardHeader title="Mais vendidos" subtitle="Ordenado por quantidade no mês" />
            {stats.ranking.length === 0 ? (
              <p className="text-sm text-stone-500">Nenhuma venda com produto neste mês. Use a seleção de produto no Caixa do dia.</p>
            ) : (
              <div className="space-y-3">
                {stats.ranking.map((p, i) => (
                  <div key={`${p.name}-${i}`}>
                    <div className="flex items-center gap-3 text-sm">
                      <span className="w-6 text-xs tabular text-stone-400">{i + 1}</span>
                      <span className="flex-1 min-w-0 truncate text-stone-800">{p.name}</span>
                      <span className="tabular text-stone-600 text-xs">{p.qty} un</span>
                      <span className="tabular text-stone-800 w-24 text-right">{money(p.total)}</span>
                    </div>
                    <div className="h-1.5 ml-9 mt-1.5 rounded-full bg-stone-100 overflow-hidden">
                      <div className="h-full rounded-full bg-amber-500" style={{ width: `${topQty ? (p.qty / topQty) * 100 : 0}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </>
      ) : (
        <div>
          {historico.map((g) => (
            <Card key={g.date} padded={false} className="mb-4">
              <div className="flex items-center justify-between px-4 pt-4 pb-2">
                <span className="section-label capitalize">{fullDate(g.date)}</span>
                <span className="tabular text-sm text-stone-800">{money(g.total)}</span>
              </div>
              {g.rows.map((s) => {
                const qty = s.quantity ?? 1;
                const time = s.created_at ? new Date(s.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '';
                const details = [
                  qty > 1 && `${qty}×`,
                  s.product_name && s.unit_price != null && `${money(s.unit_price)} un.`,
                  SALE_METHOD_LABELS[s.method],
                  s.register === 'cz' && 'CZ',
                  s.is_aggregate && 'total consolidado',
                  time,
                ].filter(Boolean);
                return (
                  <div key={s.id} className="flex items-center gap-3 px-4 py-2.5 border-b border-stone-100 last:border-0">
                    <span
                      className="w-8 h-8 rounded-full flex items-center justify-center text-white shrink-0 [&_svg]:w-4 [&_svg]:h-4"
                      style={{ background: CHART.methods[s.method] }}
                    >
                      {ICONS[s.method]}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-stone-800 truncate">{s.product_name || 'Venda avulsa'}</div>
                      <div className="text-[11px] text-stone-400 truncate">{details.join(' · ')}</div>
                    </div>
                    <span className="tabular text-sm text-stone-800">{money(s.amount)}</span>
                    <button
                      type="button"
                      aria-label="Excluir venda"
                      className="p-1.5 text-stone-300 hover:text-rose-600"
                      onClick={() => window.confirm(`Excluir venda de ${money(s.amount)}?`) && deleteSale(s.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
