import React, { useMemo, useRef, useState } from 'react';
import { Banknote, CreditCard, QrCode, Trash2, Wallet, Store, Layers, Moon, Minus, Plus, X } from 'lucide-react';
import { Card, CardHeader, Chip, Dialog, Field, PageHeader, Progress, Switch, Tabs } from '../../ui';
import { useFinance, type NewSaleItem } from '../../data/finance';
import type { FinanceSettings, Recipe, SaleMethod } from '../../types';
import { SALE_METHOD_LABELS } from '../../types';
import { summarizeMonth } from '../../utils/financeModel';
import { loadStoredRecipes } from '../../utils/storage';
import { fullDate, money, parseDate, pct, toISODate, todayISO } from '../../lib/format';
import { METHODS, useModelData } from './shared';
import { CHART } from '../../ui';
import { ProductPicker } from './ProductPicker';
import { itemLabel, saleTitle } from './saleSummary';

const ICONS: Record<SaleMethod, React.ReactNode> = {
  dinheiro: <Banknote className="w-5 h-5" />,
  pix: <QrCode className="w-5 h-5" />,
  debito: <CreditCard className="w-5 h-5" />,
  credito: <Wallet className="w-5 h-5" />,
  outro: <Layers className="w-5 h-5" />,
};

/** "56,50" | "56.5" | "R$ 1.234,00" → número */
export function parseMoney(v: string): number {
  const clean = v.replace(/[^\d,.-]/g, '');
  if (!clean) return 0;
  const normalized = clean.includes(',') ? clean.replace(/\./g, '').replace(',', '.') : clean;
  const n = Number(normalized);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

const toInput = (n: number) => n.toFixed(2).replace('.', ',');
const round2 = (n: number) => Math.round(n * 100) / 100;

/** Item do pedido em montagem; `key` só existe na tela. */
interface CartLine extends NewSaleItem {
  key: string;
}

export function CaixaView({ fin }: { fin: FinanceSettings }) {
  const { sales, addSale, deleteSale, closedDays, setClosedDay } = useFinance();
  const data = useModelData(fin);
  const products = useMemo(
    () => loadStoredRecipes().filter((r) => r.active).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
    []
  );
  const [date, setDate] = useState(todayISO());
  const [register, setRegister] = useState<'principal' | 'cz'>('principal');
  // editor do item atual
  const [product, setProduct] = useState<Recipe | null>(null);
  const [livre, setLivre] = useState(false); // item sem produto (valor livre)
  const [quantity, setQuantity] = useState(1);
  const [amount, setAmount] = useState(''); // preço unitário (com produto) ou valor (sem produto)
  // pedido: itens já adicionados, todos pagos juntos numa única venda
  const [cart, setCart] = useState<CartLine[]>([]);
  const [busy, setBusy] = useState(false);
  const [aggOpen, setAggOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const daySales = useMemo(
    () => sales.filter((s) => s.date === date).sort((a, b) => (b.created_at || '').localeCompare(a.created_at || '')),
    [sales, date]
  );
  const month = useMemo(() => summarizeMonth(date.slice(0, 7), data), [date, data]);
  const closed = closedDays.find((d) => d.date === date);

  const totals = useMemo(() => {
    const byMethod: Record<SaleMethod, number> = { dinheiro: 0, pix: 0, debito: 0, credito: 0, outro: 0 };
    let tickets = 0;
    let ticketSum = 0;
    for (const s of daySales) {
      byMethod[s.method] += s.amount;
      if (!s.is_aggregate) {
        tickets++;
        ticketSum += s.amount;
      }
    }
    const total = Object.values(byMethod).reduce((a, b) => a + b, 0);
    const fees = (Object.keys(byMethod) as SaleMethod[]).reduce((a, m) => a + byMethod[m] * (fin.cardFees[m] / 100), 0);
    return { byMethod, total, tickets, ticketMedio: tickets ? ticketSum / tickets : 0, fees };
  }, [daySales, fin]);

  const unit = parseMoney(amount);
  const pendingValue = round2(unit * (product ? quantity : 1));
  const hasPending = pendingValue > 0;
  const showPicker = !product && !livre;
  const cartTotal = round2(cart.reduce((t, l) => t + l.amount, 0));
  const payTotal = round2(cartTotal + (hasPending ? pendingValue : 0));

  const choose = (p: Recipe) => {
    setProduct(p);
    setLivre(false);
    setQuantity(1);
    setAmount(p.practicedPrice ? toInput(p.practicedPrice) : '');
  };
  const chooseLivre = () => {
    setProduct(null);
    setLivre(true);
    setQuantity(1);
    setAmount('');
  };
  const clearSelection = () => {
    setProduct(null);
    setLivre(false);
    setQuantity(1);
    setAmount('');
  };

  /** Item do editor, se houver valor preenchido. */
  const pendingLine = (): CartLine | null => {
    if (!hasPending) return null;
    return {
      key: crypto.randomUUID(),
      recipe_id: product?.id ?? null,
      product_name: product?.name ?? null,
      quantity: product ? quantity : 1,
      unit_price: product ? unit : null,
      amount: pendingValue,
    };
  };

  const addToCart = () => {
    const line = pendingLine();
    if (!line) {
      inputRef.current?.focus();
      return;
    }
    setCart((c) => [...c, line]);
    clearSelection();
  };

  const removeFromCart = (key: string) => setCart((c) => c.filter((l) => l.key !== key));

  /** Registra o pedido inteiro (itens do carrinho + editor) como uma venda. */
  const pay = async (method: SaleMethod) => {
    const line = pendingLine();
    const lines = [...cart, ...(line ? [line] : [])];
    if (!lines.length || busy) {
      inputRef.current?.focus();
      return;
    }
    setBusy(true);
    try {
      await addSale({
        date,
        method,
        register,
        is_aggregate: false,
        items: lines.map(({ key: _key, ...item }) => item),
      });
      setCart([]);
      // Só com um item avulso no editor: mantém o produto e o preço para a próxima venda.
      if (line) {
        setQuantity(1);
        if (!product) setAmount('');
      }
    } catch {
      // erro já reportado pelo provider; o pedido continua na tela para nova tentativa
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  };

  const shiftDay = (n: number) => {
    const d = parseDate(date);
    d.setDate(d.getDate() + n);
    setDate(toISODate(d));
  };

  const metaPct = month.metaDiaria ? (totals.total / month.metaDiaria) * 100 : 0;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
      <PageHeader
        title="Caixa do dia"
        subtitle="Monte o pedido com um ou mais itens e toque na forma de pagamento"
        actions={
          <div className="inline-flex items-center bg-white rounded-[2px] shadow-sm h-9">
            <button type="button" className="px-3 h-full text-stone-600 hover:text-amber-600" onClick={() => shiftDay(-1)} aria-label="Dia anterior">‹</button>
            <input
              type="date"
              value={date}
              onChange={(e) => e.target.value && setDate(e.target.value)}
              className="h-full px-1 text-sm text-stone-800 bg-transparent outline-none"
            />
            <button type="button" className="px-3 h-full text-stone-600 hover:text-amber-600" onClick={() => shiftDay(1)} aria-label="Próximo dia">›</button>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-3 space-y-4">
          <Card>
            <div className="flex items-center justify-between mb-3">
              <span className="section-label capitalize">{fullDate(date)}</span>
              <Tabs
                value={register}
                onChange={setRegister}
                items={[
                  { id: 'principal', label: 'Caixa' },
                  { id: 'cz', label: 'CZ' },
                ]}
              />
            </div>

            {closed ? (
              <div className="flex items-center gap-3 p-4 rounded-[4px] bg-stone-100 text-stone-600 text-sm">
                <Moon className="w-5 h-5" />
                <span className="flex-1">Loja fechada neste dia{closed.reason ? ` — ${closed.reason}` : ''}. Não entra nas médias.</span>
                <button type="button" className="btn btn-text" onClick={() => setClosedDay(date, false)}>Reabrir</button>
              </div>
            ) : (
              <>
                {showPicker ? (
                  <>
                    <span className="field-label">Adicionar item</span>
                    <ProductPicker products={products} onPick={choose} />
                    <div className="flex justify-end mt-2">
                      <button type="button" className="btn btn-text h-8" onClick={chooseLivre}>Item sem produto</button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="section-label truncate flex-1">{product ? product.name : 'Item sem produto'}</span>
                      <button type="button" aria-label="Cancelar item" className="p-1.5 text-stone-400 hover:text-stone-700" onClick={clearSelection}>
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="flex items-end gap-4">
                      <label className="flex-1 block min-w-0">
                        <span className="field-label">{product ? 'Preço unitário' : 'Valor do item'}</span>
                        <div className="flex items-baseline gap-2 border-b-2 border-amber-500 pb-1">
                          <span className="text-2xl text-stone-400">R$</span>
                          <input
                            ref={inputRef}
                            autoFocus
                            inputMode="decimal"
                            placeholder="0,00"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') addToCart();
                            }}
                            className="w-full text-4xl font-light tabular text-stone-800 outline-none bg-transparent placeholder:text-stone-300"
                          />
                        </div>
                      </label>

                      {product && (
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            aria-label="Diminuir quantidade"
                            disabled={quantity <= 1}
                            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                            className="w-9 h-9 rounded-[4px] bg-stone-100 text-stone-700 flex items-center justify-center disabled:opacity-40"
                          >
                            <Minus className="w-4 h-4" />
                          </button>
                          <span className="w-10 text-center tabular text-lg text-stone-800">{quantity}</span>
                          <button
                            type="button"
                            aria-label="Aumentar quantidade"
                            onClick={() => setQuantity((q) => Math.min(999, q + 1))}
                            className="w-9 h-9 rounded-[4px] bg-stone-100 text-stone-700 flex items-center justify-center"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>

                    {product && (
                      <div className="text-xs text-stone-500 mt-2">
                        Total do item <span className="tabular text-sm text-stone-800 ml-1">{money(pendingValue)}</span>
                      </div>
                    )}

                    <button
                      type="button"
                      disabled={!hasPending}
                      onClick={addToCart}
                      className="btn btn-secondary w-full mt-4 h-10 disabled:opacity-40"
                    >
                      <Plus className="w-4 h-4" /> Adicionar ao pedido
                    </button>
                  </>
                )}

                {cart.length > 0 && (
                  <div className="mt-5 pt-4 border-t border-stone-100">
                    <span className="section-label">
                      Pedido ({cart.length} {cart.length === 1 ? 'item' : 'itens'})
                    </span>
                    <div className="mt-2 divide-y divide-stone-100">
                      {cart.map((l) => (
                        <div key={l.key} className="flex items-center gap-3 py-2">
                          <div className="flex-1 min-w-0">
                            <div className="text-sm text-stone-800 truncate">{itemLabel(l)}</div>
                            {l.product_name && l.quantity > 1 && (
                              <div className="text-[11px] text-stone-400">{l.quantity} × {money(l.unit_price ?? 0)}</div>
                            )}
                          </div>
                          <span className="tabular text-sm text-stone-800">{money(l.amount)}</span>
                          <button
                            type="button"
                            aria-label="Remover item do pedido"
                            className="p-1.5 text-stone-300 hover:text-rose-600"
                            onClick={() => removeFromCart(l.key)}
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {payTotal > 0 && (
                  <div className="mt-5 pt-4 border-t border-stone-100">
                    <div className="flex items-baseline justify-between mb-3">
                      <span className="section-label">Pagamento</span>
                      <span className="tabular text-2xl text-stone-800">{money(payTotal)}</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {METHODS.map((m) => (
                        <button
                          key={m}
                          type="button"
                          disabled={busy}
                          onClick={() => pay(m)}
                          className="h-16 rounded-[4px] text-white shadow-sm flex flex-col items-center justify-center gap-1 text-xs font-medium uppercase tracking-wide transition-transform active:scale-[0.98] disabled:opacity-60"
                          style={{ background: CHART.methods[m] }}
                        >
                          {ICONS[m]}
                          {SALE_METHOD_LABELS[m]}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-2 mt-4 text-xs text-stone-500">
                  <span>{showPicker ? 'Escolha um produto para começar.' : 'Enter adiciona o item ao pedido.'}</span>
                  <div className="flex gap-1">
                    <button type="button" className="btn btn-text h-8" onClick={() => setAggOpen(true)}>Lançar total do dia</button>
                    <button
                      type="button"
                      className="btn btn-text h-8"
                      onClick={() => {
                        const reason = window.prompt('Motivo (feriado, folga...)', 'Feriado');
                        if (reason !== null) setClosedDay(date, true, reason);
                      }}
                    >
                      Marcar fechado
                    </button>
                  </div>
                </div>
              </>
            )}
          </Card>

          <Card padded={false}>
            <div className="p-4 pb-2 flex items-center justify-between">
              <span className="section-label">Vendas lançadas ({daySales.length})</span>
            </div>
            {daySales.length === 0 ? (
              <p className="px-4 pb-5 text-sm text-stone-500">Nenhuma venda neste dia ainda.</p>
            ) : (
              <div className="max-h-[420px] overflow-y-auto">
                {daySales.map((s, i) => (
                  <div key={s.id} className="flex items-center gap-3 px-4 py-2.5 border-b border-stone-100 last:border-0">
                    <span className="w-8 h-8 rounded-full flex items-center justify-center text-white shrink-0 [&_svg]:w-4 [&_svg]:h-4" style={{ background: CHART.methods[s.method] }}>
                      {ICONS[s.method]}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-stone-800 truncate">{saleTitle(s)}</div>
                      <div className="text-[11px] text-stone-400">
                        #{daySales.length - i} · {SALE_METHOD_LABELS[s.method]}
                        {s.items.length > 1 && ` · ${s.items.length} itens`}
                        {s.register === 'cz' && ' · CZ'}
                        {s.created_at && ` · ${new Date(s.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`}
                      </div>
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
                ))}
              </div>
            )}
          </Card>
        </div>

        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader title="Fechamento do dia" />
            <div className="text-4xl font-light tabular text-stone-800">{money(totals.total)}</div>
            <div className="text-xs text-stone-500 mt-1">
              Líquido de taxas ≈ {money(totals.total - totals.fees)} · {totals.tickets} vendas · ticket {money(totals.ticketMedio)}
            </div>
            <div className="mt-4">
              <div className="flex justify-between text-xs text-stone-600 mb-1">
                <span>Meta do dia {money(month.metaDiaria)}</span>
                <span className="tabular">{pct(metaPct, 0)}</span>
              </div>
              <Progress value={metaPct} tone={metaPct >= 100 ? 'good' : 'brand'} />
              {totals.total < month.metaDiaria && !closed && (
                <p className="text-[11px] text-stone-500 mt-1.5">Faltam {money(month.metaDiaria - totals.total)} para a meta.</p>
              )}
            </div>
            <div className="mt-5 space-y-2">
              {METHODS.map((m) => (
                <div key={m} className="flex items-center gap-2 text-sm">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: CHART.methods[m] }} />
                  <span className="text-stone-600">{SALE_METHOD_LABELS[m]}</span>
                  {fin.cardFees[m] > 0 && <Chip>{pct(fin.cardFees[m], 1)}</Chip>}
                  <span className="ml-auto tabular text-stone-800">{money(totals.byMethod[m])}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <CardHeader title="Acumulado do mês" />
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-xs text-stone-500">Vendido</div>
                <div className="tabular text-lg text-stone-800">{money(month.receitaVendas)}</div>
              </div>
              <div>
                <div className="text-xs text-stone-500">Média diária</div>
                <div className="tabular text-lg text-stone-800">{money(month.mediaDiaria)}</div>
              </div>
              <div>
                <div className="text-xs text-stone-500">Dias com venda</div>
                <div className="tabular text-lg text-stone-800">{month.diasComVenda} / {month.diasAbertos}</div>
              </div>
              <div>
                <div className="text-xs text-stone-500">Ticket médio</div>
                <div className="tabular text-lg text-stone-800">{money(month.ticketMedio)}</div>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs text-stone-500 mt-4">
              <Store className="w-4 h-4" /> Caixa e CZ somam no mesmo faturamento da loja.
            </div>
          </Card>
        </div>
      </div>

      <AggregateDialog
        open={aggOpen}
        onClose={() => setAggOpen(false)}
        onSave={async (vals) => {
          // Total consolidado: uma venda de um único item por forma de pagamento.
          try {
            for (const m of METHODS) {
              if (vals[m] <= 0) continue;
              await addSale({
                date,
                method: m,
                register,
                is_aggregate: true,
                items: [{ recipe_id: null, product_name: null, quantity: 1, unit_price: null, amount: vals[m] }],
              });
            }
            setAggOpen(false);
          } catch {
            // erro já reportado pelo provider; o diálogo continua aberto
          }
        }}
      />
    </div>
  );
}

function AggregateDialog({
  open,
  onClose,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (v: Record<SaleMethod, number>) => Promise<void>;
}) {
  const [vals, setVals] = useState<Record<string, string>>({});
  const [confirmSplit, setConfirmSplit] = useState(true);
  const parsed = Object.fromEntries(METHODS.map((m) => [m, parseMoney(vals[m] || '')])) as Record<SaleMethod, number>;
  const total = METHODS.reduce((a, m) => a + parsed[m], 0);
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Lançar total do dia"
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={total <= 0 || !confirmSplit}
            onClick={async () => {
              await onSave(parsed);
              setVals({});
            }}
          >
            Lançar {money(total)}
          </button>
        </>
      }
    >
      <p className="text-xs text-stone-500 mb-4">
        Use quando não der para lançar venda a venda (ex.: fechamento da maquininha). O total entra no faturamento, mas não no cálculo do ticket médio.
      </p>
      <div className="grid grid-cols-2 gap-4">
        {METHODS.map((m) => (
          <Field key={m} label={SALE_METHOD_LABELS[m]}>
            <input className="field tabular" inputMode="decimal" placeholder="0,00" value={vals[m] || ''} onChange={(e) => setVals({ ...vals, [m]: e.target.value })} />
          </Field>
        ))}
      </div>
      <div className="mt-4">
        <Switch checked={confirmSplit} onChange={setConfirmSplit} label="Valores conferidos" />
      </div>
    </Dialog>
  );
}
