/**
 * Estado do módulo financeiro, carregado do Supabase após o login.
 * Todas as escritas são otimistas: a tela atualiza na hora e, se o banco
 * recusar, o estado volta e um alerta é mostrado.
 */
import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { supabase, fetchAll } from '../lib/supabase';
import { reportSyncError } from '../utils/storage';
import { daysInMonth } from '../lib/format';
import type { Budget, ClosedDay, FinGroup, FinTransaction, RecurringExpense, Sale } from '../types';

interface FinanceState {
  sales: Sale[];
  transactions: FinTransaction[];
  recurring: RecurringExpense[];
  closedDays: ClosedDay[];
  budgets: Budget[];
}

interface FinanceApi extends FinanceState {
  loaded: boolean;
  load: () => Promise<void>;
  /** Apenas desenvolvimento (?preview): carrega estado sem banco. */
  prime: (s: Partial<FinanceState>) => void;
  addSales: (rows: Omit<Sale, 'id'>[]) => Promise<void>;
  deleteSale: (id: string) => Promise<void>;
  saveTransaction: (t: Omit<FinTransaction, 'id'> & { id?: string }) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
  saveRecurring: (r: Omit<RecurringExpense, 'id'> & { id?: string }) => Promise<void>;
  deleteRecurring: (id: string) => Promise<void>;
  /** Cria os lançamentos previstos das despesas recorrentes que ainda não existem no mês. */
  generateRecurring: (month: string) => Promise<number>;
  setClosedDay: (date: string, closed: boolean, reason?: string) => Promise<void>;
  setBudget: (competencia: string, grp: FinGroup, value: number) => Promise<void>;
}

const Ctx = createContext<FinanceApi | null>(null);

const num = (v: unknown) => (typeof v === 'number' ? v : Number(v) || 0);
const normSale = (r: any): Sale => ({
  ...r,
  amount: num(r.amount),
  quantity: num(r.quantity) || 1,
  unit_price: r.unit_price == null ? null : num(r.unit_price),
});
const normTx = (r: any): FinTransaction => ({ ...r, value: num(r.value), competencia: String(r.competencia).trim() });
const normRec = (r: any): RecurringExpense => ({ ...r, value: num(r.value) });

export function FinanceProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<FinanceState>({
    sales: [],
    transactions: [],
    recurring: [],
    closedDays: [],
    budgets: [],
  });
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    const [sales, transactions, recurring, closedDays, budgets] = await Promise.all([
      fetchAll<any>((f, t) => supabase.from('bg_sales').select('*').order('date').order('created_at').range(f, t)),
      fetchAll<any>((f, t) => supabase.from('bg_transactions').select('*').order('date').range(f, t)),
      fetchAll<any>((f, t) => supabase.from('bg_recurring').select('*').order('description').range(f, t)),
      fetchAll<any>((f, t) => supabase.from('bg_closed_days').select('*').range(f, t)),
      fetchAll<any>((f, t) => supabase.from('bg_budgets').select('*').range(f, t)),
    ]);
    setState({
      sales: sales.map(normSale),
      transactions: transactions.map(normTx),
      recurring: recurring.map(normRec),
      closedDays,
      budgets: budgets.map((b: any) => ({ ...b, value: num(b.value), competencia: String(b.competencia).trim() })),
    });
    setLoaded(true);
  }, []);

  const prime = useCallback((s: Partial<FinanceState>) => {
    setState((cur) => ({ ...cur, ...s }));
    setLoaded(true);
  }, []);

  /** Aplica uma mudança otimista e desfaz se a operação no banco falhar. */
  const optimistic = useCallback(
    async (apply: (s: FinanceState) => FinanceState, run: () => PromiseLike<{ error: { message: string } | null }>) => {
      let snapshot: FinanceState | null = null;
      setState((s) => {
        snapshot = s;
        return apply(s);
      });
      const { error } = await run();
      if (error) {
        if (snapshot) setState(snapshot);
        reportSyncError(error.message);
        throw new Error(error.message);
      }
    },
    []
  );

  const addSales = useCallback(async (rows: Omit<Sale, 'id'>[]) => {
    const withIds = rows.map((r) => ({ ...r, id: crypto.randomUUID() }));
    await optimistic(
      (s) => ({ ...s, sales: [...s.sales, ...withIds] }),
      () => supabase.from('bg_sales').insert(withIds.map(({ created_at, ...r }) => r))
    );
  }, [optimistic]);

  const deleteSale = useCallback(async (id: string) => {
    await optimistic(
      (s) => ({ ...s, sales: s.sales.filter((x) => x.id !== id) }),
      () => supabase.from('bg_sales').delete().eq('id', id)
    );
  }, [optimistic]);

  const saveTransaction = useCallback(async (t: Omit<FinTransaction, 'id'> & { id?: string }) => {
    const row = { ...t, id: t.id || crypto.randomUUID() } as FinTransaction;
    await optimistic(
      (s) => ({
        ...s,
        transactions: t.id ? s.transactions.map((x) => (x.id === t.id ? row : x)) : [...s.transactions, row],
      }),
      () => supabase.from('bg_transactions').upsert({ ...row, updated_at: new Date().toISOString() })
    );
  }, [optimistic]);

  const deleteTransaction = useCallback(async (id: string) => {
    await optimistic(
      (s) => ({ ...s, transactions: s.transactions.filter((x) => x.id !== id) }),
      () => supabase.from('bg_transactions').delete().eq('id', id)
    );
  }, [optimistic]);

  const saveRecurring = useCallback(async (r: Omit<RecurringExpense, 'id'> & { id?: string }) => {
    const row = { ...r, id: r.id || crypto.randomUUID() } as RecurringExpense;
    await optimistic(
      (s) => ({
        ...s,
        recurring: r.id ? s.recurring.map((x) => (x.id === r.id ? row : x)) : [...s.recurring, row],
      }),
      () => supabase.from('bg_recurring').upsert(row)
    );
  }, [optimistic]);

  const deleteRecurring = useCallback(async (id: string) => {
    await optimistic(
      (s) => ({
        ...s,
        recurring: s.recurring.filter((x) => x.id !== id),
        transactions: s.transactions.map((t) => (t.recurring_id === id ? { ...t, recurring_id: null } : t)),
      }),
      () => supabase.from('bg_recurring').delete().eq('id', id)
    );
  }, [optimistic]);

  const generateRecurring = useCallback(async (month: string) => {
    const existing = new Set(
      state.transactions.filter((t) => t.competencia === month && t.recurring_id).map((t) => t.recurring_id)
    );
    const due = state.recurring.filter(
      (r) =>
        r.active &&
        r.start_month <= month &&
        (!r.end_month || r.end_month >= month) &&
        !existing.has(r.id)
    );
    if (!due.length) return 0;
    const last = daysInMonth(month);
    const rows: FinTransaction[] = due.map((r) => ({
      id: crypto.randomUUID(),
      type: 'saida',
      date: `${month}-${String(Math.min(r.day_of_month, last)).padStart(2, '0')}`,
      competencia: month,
      description: r.description,
      category: r.category,
      grp: r.grp,
      value: r.value,
      status: 'previsto',
      recurring_id: r.id,
      source: 'recorrente',
    }));
    await optimistic(
      (s) => ({ ...s, transactions: [...s.transactions, ...rows] }),
      () => supabase.from('bg_transactions').insert(rows)
    );
    return rows.length;
  }, [optimistic, state.recurring, state.transactions]);

  const setClosedDay = useCallback(async (date: string, closed: boolean, reason?: string) => {
    await optimistic(
      (s) => ({
        ...s,
        closedDays: closed
          ? [...s.closedDays.filter((d) => d.date !== date), { date, reason: reason || null }]
          : s.closedDays.filter((d) => d.date !== date),
      }),
      () =>
        closed
          ? supabase.from('bg_closed_days').upsert({ date, reason: reason || null })
          : supabase.from('bg_closed_days').delete().eq('date', date)
    );
  }, [optimistic]);

  const setBudget = useCallback(async (competencia: string, grp: FinGroup, value: number) => {
    await optimistic(
      (s) => ({
        ...s,
        budgets: [...s.budgets.filter((b) => !(b.competencia === competencia && b.grp === grp)), { competencia, grp, value }],
      }),
      () => supabase.from('bg_budgets').upsert({ competencia, grp, value })
    );
  }, [optimistic]);

  const api = useMemo<FinanceApi>(
    () => ({
      ...state,
      loaded,
      load,
      prime,
      addSales,
      deleteSale,
      saveTransaction,
      deleteTransaction,
      saveRecurring,
      deleteRecurring,
      generateRecurring,
      setClosedDay,
      setBudget,
    }),
    [state, loaded, load, prime, addSales, deleteSale, saveTransaction, deleteTransaction, saveRecurring, deleteRecurring, generateRecurring, setClosedDay, setBudget]
  );

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useFinance(): FinanceApi {
  const v = useContext(Ctx);
  if (!v) throw new Error('useFinance fora do FinanceProvider');
  return v;
}
