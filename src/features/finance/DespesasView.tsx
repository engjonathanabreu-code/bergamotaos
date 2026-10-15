import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Clock, Repeat, Search, ShoppingCart, Users, Building2, Shuffle, Sparkles, ArrowDownLeft, Trash2, Pencil } from 'lucide-react';
import { Card, Chip, Dialog, EmptyState, Fab, Field, MonthPicker, PageHeader, Progress, Tabs } from '../../ui';
import { useFinance } from '../../data/finance';
import type { ExpenseGroup, FinGroup, FinTransaction, RecurringExpense, SystemSettings } from '../../types';
import { currentMonth, dayMonth, money, todayISO } from '../../lib/format';
import { GROUP_LABELS } from './shared';
import { parseMoney } from './CaixaView';

const GROUPS: ExpenseGroup[] = ['compras', 'funcionario', 'fixa', 'variavel', 'esporadica'];
const GROUP_ICON: Record<string, React.ReactNode> = {
  compras: <ShoppingCart className="w-4 h-4" />,
  funcionario: <Users className="w-4 h-4" />,
  fixa: <Building2 className="w-4 h-4" />,
  variavel: <Shuffle className="w-4 h-4" />,
  esporadica: <Sparkles className="w-4 h-4" />,
  receita: <ArrowDownLeft className="w-4 h-4" />,
};
const GROUP_BG: Record<string, string> = {
  compras: 'bg-amber-500',
  funcionario: 'bg-blue-500',
  fixa: 'bg-stone-600',
  variavel: 'bg-emerald-600',
  esporadica: 'bg-violet-500',
  receita: 'bg-emerald-500',
};

type TabId = 'todos' | FinGroup;

export function DespesasView({ settings }: { settings: SystemSettings }) {
  const { transactions, budgets, saveTransaction, deleteTransaction, generateRecurring } = useFinance();
  const [month, setMonth] = useState(currentMonth());
  const [tab, setTab] = useState<TabId>('todos');
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<Partial<FinTransaction> | null>(null);
  const [recOpen, setRecOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const monthTx = useMemo(() => transactions.filter((t) => t.competencia === month), [transactions, month]);
  const byGroup = useMemo(() => {
    const m: Record<string, { total: number; previsto: number; count: number }> = {};
    for (const g of [...GROUPS, 'receita']) m[g] = { total: 0, previsto: 0, count: 0 };
    for (const t of monthTx) {
      const g = t.type === 'entrada' ? 'receita' : t.grp;
      m[g].total += t.value;
      m[g].count++;
      if (t.status === 'previsto') m[g].previsto += t.value;
    }
    return m;
  }, [monthTx]);
  const totalSaidas = GROUPS.reduce((a, g) => a + byGroup[g].total, 0);
  const totalPrevisto = GROUPS.reduce((a, g) => a + byGroup[g].previsto, 0);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return monthTx
      .filter((t) => tab === 'todos' || (tab === 'receita' ? t.type === 'entrada' : t.type === 'saida' && t.grp === tab))
      .filter((t) => !q || `${t.description} ${t.category} ${t.notes || ''}`.toLowerCase().includes(q))
      .sort((a, b) => (a.status === b.status ? a.date.localeCompare(b.date) : a.status === 'previsto' ? -1 : 1));
  }, [monthTx, tab, query]);

  const budgetOf = (g: FinGroup) => budgets.find((b) => b.competencia === month && b.grp === g)?.value || 0;
  const today = todayISO();

  const markPaid = (t: FinTransaction) => saveTransaction({ ...t, status: 'realizado', date: t.date > today ? today : t.date });

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto pb-24">
      <PageHeader
        title="Despesas"
        subtitle={`${money(totalSaidas)} no mês${totalPrevisto ? ` · ${money(totalPrevisto)} ainda a pagar` : ''}`}
        actions={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setRecOpen(true)}>
              <Repeat className="w-4 h-4" /> Recorrentes
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={async () => {
                const n = await generateRecurring(month);
                setNotice(n ? `${n} conta(s) recorrente(s) lançada(s) como previstas.` : 'Todas as recorrentes deste mês já estão lançadas.');
                setTimeout(() => setNotice(null), 4000);
              }}
            >
              Gerar do mês
            </button>
            <MonthPicker value={month} onChange={setMonth} />
          </>
        }
      />

      {notice && <div className="mb-4 px-4 py-3 bg-blue-50 text-blue-800 text-sm rounded-[4px]">{notice}</div>}

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-4">
        {GROUPS.map((g) => {
          const b = budgetOf(g);
          const used = b ? (byGroup[g].total / b) * 100 : 0;
          return (
            <button key={g} type="button" onClick={() => setTab(g)} className="text-left">
              <Card className={`h-full transition-shadow hover:shadow-md ${tab === g ? 'ring-2 ring-amber-400' : ''}`}>
                <div className="flex items-center gap-2">
                  <span className={`w-7 h-7 rounded-full ${GROUP_BG[g]} text-white flex items-center justify-center`}>{GROUP_ICON[g]}</span>
                  <span className="section-label">{GROUP_LABELS[g]}</span>
                </div>
                <div className="text-lg tabular text-stone-800 mt-2">{money(byGroup[g].total)}</div>
                {b > 0 ? (
                  <div className="mt-1.5">
                    <Progress value={used} tone={used > 100 ? 'bad' : used > 85 ? 'brand' : 'good'} />
                    <div className="text-[11px] text-stone-400 mt-1">orçado {money(b)}</div>
                  </div>
                ) : (
                  <div className="text-[11px] text-stone-400 mt-1">
                    {byGroup[g].count} lançamentos{byGroup[g].previsto ? ` · ${money(byGroup[g].previsto)} a pagar` : ''}
                  </div>
                )}
              </Card>
            </button>
          );
        })}
      </div>

      <Card padded={false}>
        <div className="px-2 sm:px-4 pt-1">
          <Tabs
            value={tab}
            onChange={setTab}
            items={[
              { id: 'todos', label: 'Todos', badge: String(monthTx.length) },
              ...GROUPS.map((g) => ({ id: g as TabId, label: GROUP_LABELS[g] })),
              { id: 'receita', label: 'Outras receitas' },
            ]}
          />
        </div>
        <div className="px-4 py-3 flex items-center gap-2 border-b border-stone-100">
          <Search className="w-4 h-4 text-stone-400" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar fornecedor, categoria..." className="flex-1 text-sm outline-none bg-transparent" />
        </div>
        {list.length === 0 ? (
          <EmptyState icon={<ShoppingCart className="w-6 h-6" />} title="Nada por aqui" text="Nenhum lançamento neste filtro. Use o botão + para lançar." />
        ) : (
          <div>
            {list.map((t) => {
              const g = t.type === 'entrada' ? 'receita' : t.grp;
              const late = t.status === 'previsto' && t.date < today;
              return (
                <div key={t.id} className="flex items-center gap-3 px-4 py-3 border-b border-stone-100 last:border-0 hover:bg-stone-50">
                  <span className={`w-9 h-9 rounded-full ${GROUP_BG[g]} text-white flex items-center justify-center shrink-0`}>{GROUP_ICON[g]}</span>
                  <button type="button" className="flex-1 min-w-0 text-left" onClick={() => setEditing(t)}>
                    <div className="text-[11px] text-stone-400">
                      {dayMonth(t.date)} · {t.category}
                      {t.recurring_id && ' · recorrente'}
                    </div>
                    <div className="text-sm text-stone-800 truncate">{t.description}</div>
                    {t.notes && <div className="text-[11px] text-stone-400 truncate">{t.notes}</div>}
                  </button>
                  <div className="text-right shrink-0">
                    <div className={`text-sm tabular ${t.type === 'entrada' ? 'text-emerald-700' : 'text-stone-800'}`}>
                      {t.type === 'entrada' ? '+' : ''}
                      {money(t.value)}
                    </div>
                    {t.status === 'previsto' ? (
                      <button type="button" onClick={() => markPaid(t)} className="mt-0.5" title="Marcar como pago">
                        <Chip tone={late ? 'bad' : 'brand'}>
                          <Clock className="w-3 h-3 mr-1" />
                          {late ? 'Atrasada · pagar' : 'Prevista · pagar'}
                        </Chip>
                      </button>
                    ) : (
                      <Chip tone="good">
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        Paga
                      </Chip>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Fab
        label="Novo lançamento"
        onClick={() =>
          setEditing({
            type: tab === 'receita' ? 'entrada' : 'saida',
            grp: tab === 'todos' || tab === 'receita' ? (tab === 'receita' ? 'receita' : 'compras') : tab,
            date: month === currentMonth() ? today : `${month}-01`,
            competencia: month,
            status: 'realizado',
          })
        }
      />

      <TransactionDialog
        initial={editing}
        settings={settings}
        onClose={() => setEditing(null)}
        onSave={async (t) => {
          await saveTransaction(t);
          setEditing(null);
        }}
        onDelete={async (id) => {
          await deleteTransaction(id);
          setEditing(null);
        }}
      />
      <RecurringDialog open={recOpen} onClose={() => setRecOpen(false)} settings={settings} />
    </div>
  );
}

function TransactionDialog({
  initial,
  settings,
  onClose,
  onSave,
  onDelete,
}: {
  initial: Partial<FinTransaction> | null;
  settings: SystemSettings;
  onClose: () => void;
  onSave: (t: Omit<FinTransaction, 'id'> & { id?: string }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const { transactions } = useFinance();
  const [f, setF] = useState<Partial<FinTransaction>>({});
  const [valueStr, setValueStr] = useState('');
  const [compTouched, setCompTouched] = useState(false);

  useEffect(() => {
    if (initial) {
      setF(initial);
      setValueStr(initial.value ? String(initial.value).replace('.', ',') : '');
      setCompTouched(Boolean(initial.id));
    }
  }, [initial]);

  // Sugestões aprendidas: descrição → última categoria/grupo usados
  const memory = useMemo(() => {
    const m = new Map<string, FinTransaction>();
    for (const t of transactions) m.set(t.description.trim().toLowerCase(), t);
    return m;
  }, [transactions]);
  const descriptions = useMemo(() => Array.from(new Set(transactions.map((t) => t.description.trim()))).sort(), [transactions]);

  if (!initial) return null;
  const isEntrada = f.type === 'entrada';
  const categories = isEntrada ? settings.incomeCategories : settings.expenseCategories;
  const value = parseMoney(valueStr);
  const valid = Boolean(f.description?.trim() && value > 0 && f.date && f.category);

  const set = (patch: Partial<FinTransaction>) => setF((x) => ({ ...x, ...patch }));

  return (
    <Dialog
      open
      onClose={onClose}
      title={f.id ? 'Editar lançamento' : isEntrada ? 'Nova receita' : 'Nova despesa'}
      footer={
        <>
          {f.id && (
            <button type="button" className="btn btn-text text-rose-600 mr-auto" onClick={() => window.confirm('Excluir este lançamento?') && onDelete(f.id!)}>
              <Trash2 className="w-4 h-4" /> Excluir
            </button>
          )}
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!valid}
            onClick={() =>
              onSave({
                id: f.id,
                type: f.type || 'saida',
                date: f.date!,
                competencia: f.competencia || f.date!.slice(0, 7),
                description: f.description!.trim(),
                category: f.category!,
                grp: isEntrada ? 'receita' : ((f.grp === 'receita' ? 'compras' : f.grp) || 'compras'),
                value,
                status: f.status || 'realizado',
                recurring_id: f.recurring_id ?? null,
                source: f.source || 'app',
                notes: f.notes || null,
                payment_method: f.payment_method ?? null,
              })
            }
          >
            Salvar
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <Tabs
          value={isEntrada ? 'entrada' : 'saida'}
          onChange={(v) => set({ type: v, grp: v === 'entrada' ? 'receita' : 'compras', category: undefined })}
          items={[
            { id: 'saida', label: 'Despesa' },
            { id: 'entrada', label: 'Receita extra' },
          ]}
        />
        <Field label="Descrição / fornecedor">
          <input
            className="field"
            list="bg-desc-list"
            value={f.description || ''}
            onChange={(e) => {
              const description = e.target.value;
              const known = memory.get(description.trim().toLowerCase());
              set(
                known && !f.id
                  ? { description, category: known.category, grp: known.grp, type: known.type }
                  : { description }
              );
            }}
            autoFocus
          />
          <datalist id="bg-desc-list">
            {descriptions.map((d) => (
              <option key={d} value={d} />
            ))}
          </datalist>
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Valor (R$)">
            <input className="field tabular" inputMode="decimal" value={valueStr} onChange={(e) => setValueStr(e.target.value)} placeholder="0,00" />
          </Field>
          <Field label="Data">
            <input
              type="date"
              className="field"
              value={f.date || ''}
              onChange={(e) => set({ date: e.target.value, ...(compTouched ? {} : { competencia: e.target.value.slice(0, 7) }) })}
            />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          {!isEntrada && (
            <Field label="Grupo">
              <select className="field" value={f.grp || 'compras'} onChange={(e) => set({ grp: e.target.value as ExpenseGroup })}>
                {GROUPS.map((g) => (
                  <option key={g} value={g}>{GROUP_LABELS[g]}</option>
                ))}
              </select>
            </Field>
          )}
          <Field label="Categoria">
            <select className="field" value={f.category || ''} onChange={(e) => set({ category: e.target.value })}>
              <option value="" disabled>Selecione…</option>
              {categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
              {f.category && !categories.includes(f.category) && <option value={f.category}>{f.category}</option>}
            </select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Competência (mês do DRE)" hint="Mês ao qual a despesa pertence">
            <input
              type="month"
              className="field"
              value={f.competencia || ''}
              onChange={(e) => {
                setCompTouched(true);
                set({ competencia: e.target.value });
              }}
            />
          </Field>
          <Field label="Situação">
            <select className="field" value={f.status || 'realizado'} onChange={(e) => set({ status: e.target.value as FinTransaction['status'] })}>
              <option value="realizado">Paga / realizada</option>
              <option value="previsto">Prevista (a pagar)</option>
            </select>
          </Field>
        </div>
        <Field label="Observações">
          <input className="field" value={f.notes || ''} onChange={(e) => set({ notes: e.target.value })} />
        </Field>
      </div>
    </Dialog>
  );
}

function RecurringDialog({ open, onClose, settings }: { open: boolean; onClose: () => void; settings: SystemSettings }) {
  const { recurring, saveRecurring, deleteRecurring } = useFinance();
  const [edit, setEdit] = useState<Partial<RecurringExpense> | null>(null);
  const [valueStr, setValueStr] = useState('');
  const total = recurring.filter((r) => r.active).reduce((a, r) => a + r.value, 0);

  const startEdit = (r: Partial<RecurringExpense>) => {
    setEdit(r);
    setValueStr(r.value ? String(r.value).replace('.', ',') : '');
  };

  return (
    <Dialog open={open} onClose={onClose} title="Despesas recorrentes" wide>
      <p className="text-xs text-stone-500 mb-3">
        Contas que se repetem todo mês. Em "Gerar do mês" elas viram lançamentos previstos, que alimentam a projeção de caixa e o ponto de equilíbrio.
        Total ativo: <strong className="text-stone-800">{money(total)}/mês</strong>.
      </p>
      {edit ? (
        <div className="space-y-4 border border-stone-200 rounded-[4px] p-4">
          <Field label="Descrição">
            <input className="field" value={edit.description || ''} onChange={(e) => setEdit({ ...edit, description: e.target.value })} autoFocus />
          </Field>
          <div className="grid grid-cols-3 gap-4">
            <Field label="Valor (R$)">
              <input className="field tabular" inputMode="decimal" value={valueStr} onChange={(e) => setValueStr(e.target.value)} />
            </Field>
            <Field label="Dia de vencimento">
              <input type="number" min={1} max={31} className="field" value={edit.day_of_month || 10} onChange={(e) => setEdit({ ...edit, day_of_month: Number(e.target.value) })} />
            </Field>
            <Field label="Grupo">
              <select className="field" value={edit.grp || 'fixa'} onChange={(e) => setEdit({ ...edit, grp: e.target.value as ExpenseGroup })}>
                {GROUPS.map((g) => (
                  <option key={g} value={g}>{GROUP_LABELS[g]}</option>
                ))}
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Field label="Categoria">
              <select className="field" value={edit.category || ''} onChange={(e) => setEdit({ ...edit, category: e.target.value })}>
                <option value="" disabled>Selecione…</option>
                {settings.expenseCategories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </Field>
            <Field label="Início">
              <input type="month" className="field" value={edit.start_month || currentMonth()} onChange={(e) => setEdit({ ...edit, start_month: e.target.value })} />
            </Field>
            <Field label="Fim (opcional)" hint="Ex.: última parcela">
              <input type="month" className="field" value={edit.end_month || ''} onChange={(e) => setEdit({ ...edit, end_month: e.target.value || null })} />
            </Field>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn btn-secondary" onClick={() => setEdit(null)}>Cancelar</button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={!edit.description || !edit.category || parseMoney(valueStr) <= 0}
              onClick={async () => {
                await saveRecurring({
                  id: edit.id,
                  description: edit.description!,
                  category: edit.category!,
                  grp: edit.grp || 'fixa',
                  value: parseMoney(valueStr),
                  day_of_month: edit.day_of_month || 10,
                  start_month: edit.start_month || currentMonth(),
                  end_month: edit.end_month || null,
                  active: edit.active ?? true,
                });
                setEdit(null);
              }}
            >
              Salvar
            </button>
          </div>
        </div>
      ) : (
        <button type="button" className="btn btn-primary mb-3" onClick={() => startEdit({ grp: 'fixa', day_of_month: 10, start_month: currentMonth(), active: true })}>
          Nova recorrente
        </button>
      )}
      <div className="mt-2 divide-y divide-stone-100">
        {recurring.map((r) => (
          <div key={r.id} className={`flex items-center gap-3 py-2.5 ${r.active ? '' : 'opacity-50'}`}>
            <span className={`w-8 h-8 rounded-full ${GROUP_BG[r.grp]} text-white flex items-center justify-center shrink-0`}>{GROUP_ICON[r.grp]}</span>
            <div className="flex-1 min-w-0">
              <div className="text-sm text-stone-800 truncate">{r.description}</div>
              <div className="text-[11px] text-stone-400">
                dia {r.day_of_month} · {r.category}
                {r.end_month ? ` · até ${r.end_month}` : ''}
              </div>
            </div>
            <span className="tabular text-sm">{money(r.value)}</span>
            <button type="button" className="p-1.5 text-stone-400 hover:text-amber-600" aria-label="Editar" onClick={() => startEdit(r)}>
              <Pencil className="w-4 h-4" />
            </button>
            <button
              type="button"
              className="text-[11px] text-stone-500 hover:text-stone-800 w-14"
              onClick={() => saveRecurring({ ...r, active: !r.active })}
            >
              {r.active ? 'Pausar' : 'Ativar'}
            </button>
            <button
              type="button"
              className="p-1.5 text-stone-300 hover:text-rose-600"
              aria-label="Excluir"
              onClick={() => window.confirm(`Excluir a recorrente "${r.description}"? Lançamentos já gerados continuam.`) && deleteRecurring(r.id)}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </Dialog>
  );
}
