/**
 * Persistência do catálogo (insumos, fichas, histórico de preços, configurações)
 * no Supabase.
 *
 * As telas herdadas trabalham com a lista inteira em memória e chamam
 * `saveStoredX(listaNova)`. Aqui mantemos um cache do último estado salvo e,
 * a cada chamada, enviamos ao banco só a diferença (linhas novas/alteradas via
 * upsert e linhas removidas via delete). Falhas são avisadas pelo evento
 * `bg:sync-error`, que o App mostra como alerta.
 */
import { Ingredient, Recipe, PriceHistory, SystemSettings, FinanceSettings } from '../types';
import { DEFAULT_SETTINGS } from './pricing';
import { supabase, fetchAll } from '../lib/supabase';

export const DEFAULT_FINANCE: FinanceSettings = {
  cardFees: { dinheiro: 0, pix: 0, debito: 1.6, credito: 2.3, outro: 0 },
  minDailyTarget: 1500,
  openWeekdays: [2, 3, 4, 5, 6],
  targetProfitPct: 10,
};

type Row = { id: string; data: unknown };
type TableName = 'bg_ingredients' | 'bg_recipes' | 'bg_price_history';

const cache = {
  ingredients: [] as Ingredient[],
  recipes: [] as Recipe[],
  priceHistory: [] as PriceHistory[],
  settings: withFinance(DEFAULT_SETTINGS),
};

function withFinance(s: SystemSettings): SystemSettings {
  return {
    ...DEFAULT_SETTINGS,
    ...s,
    finance: {
      ...DEFAULT_FINANCE,
      ...(s.finance || {}),
      cardFees: { ...DEFAULT_FINANCE.cardFees, ...(s.finance?.cardFees || {}) },
    },
  };
}

let pending = 0;
function emit(name: string, detail?: unknown) {
  window.dispatchEvent(new CustomEvent(name, { detail }));
}
function track<T>(p: PromiseLike<T>): Promise<T> {
  pending++;
  emit('bg:sync-state', { pending });
  return Promise.resolve(p).finally(() => {
    pending--;
    emit('bg:sync-state', { pending });
  });
}
export function reportSyncError(message: string) {
  console.error('[Bergamota OS] falha ao salvar:', message);
  emit('bg:sync-error', message);
}

/** Carrega todo o catálogo do banco para o cache. Chamar uma vez após o login. */
export async function loadCatalog(): Promise<void> {
  const byTable = (t: TableName) =>
    fetchAll<Row>((from, to) => supabase.from(t).select('id, data').order('id').range(from, to));
  const [ings, recs, hist, settings] = await Promise.all([
    byTable('bg_ingredients'),
    byTable('bg_recipes'),
    byTable('bg_price_history'),
    supabase.from('bg_settings').select('data').eq('id', 'default').maybeSingle(),
  ]);
  if (settings.error) throw new Error(settings.error.message);
  cache.ingredients = ings.map((r) => r.data as Ingredient);
  cache.recipes = recs.map((r) => r.data as Recipe);
  cache.priceHistory = (hist.map((r) => r.data as PriceHistory)).sort((a, b) => b.date.localeCompare(a.date));
  cache.settings = withFinance((settings.data?.data as SystemSettings) || DEFAULT_SETTINGS);
}

/** Apenas desenvolvimento: preenche o cache com dados locais (modo ?preview). */
export function primeCatalog(d: { ingredients: Ingredient[]; recipes: Recipe[]; priceHistory: PriceHistory[]; settings: SystemSettings }) {
  cache.ingredients = d.ingredients;
  cache.recipes = d.recipes;
  cache.priceHistory = d.priceHistory;
  cache.settings = withFinance(d.settings);
}

function syncTable<T extends { id: string }>(table: TableName, prev: T[], next: T[]) {
  const before = new Map(prev.map((r) => [r.id, JSON.stringify(r)]));
  const nextIds = new Set(next.map((r) => r.id));
  const upserts = next.filter((r) => before.get(r.id) !== JSON.stringify(r)).map((r) => ({ id: r.id, data: r }));
  const deletes = prev.filter((r) => !nextIds.has(r.id)).map((r) => r.id);

  if (upserts.length) {
    track(supabase.from(table).upsert(upserts)).then(({ error }) => error && reportSyncError(error.message));
  }
  if (deletes.length) {
    track(supabase.from(table).delete().in('id', deletes)).then(({ error }) => error && reportSyncError(error.message));
  }
}

export function loadStoredIngredients(): Ingredient[] {
  return cache.ingredients;
}
export function saveStoredIngredients(next: Ingredient[]): void {
  const prev = cache.ingredients;
  cache.ingredients = next;
  syncTable('bg_ingredients', prev, next);
}

export function loadStoredRecipes(): Recipe[] {
  return cache.recipes;
}
export function saveStoredRecipes(next: Recipe[]): void {
  const prev = cache.recipes;
  cache.recipes = next;
  syncTable('bg_recipes', prev, next);
}

export function loadStoredPriceHistory(): PriceHistory[] {
  return cache.priceHistory;
}
export function saveStoredPriceHistory(next: PriceHistory[]): void {
  const prev = cache.priceHistory;
  cache.priceHistory = next;
  syncTable('bg_price_history', prev, next);
}

export function loadStoredSettings(): SystemSettings {
  return cache.settings;
}
export function saveStoredSettings(settings: SystemSettings): void {
  cache.settings = withFinance(settings);
  track(supabase.from('bg_settings').upsert({ id: 'default', data: cache.settings })).then(
    ({ error }) => error && reportSyncError(error.message)
  );
}

// Aliases usados pelas telas herdadas
export const getStoredIngredients = loadStoredIngredients;
export const getStoredRecipes = loadStoredRecipes;
export const getStoredPriceHistory = loadStoredPriceHistory;
export const getStoredSettings = loadStoredSettings;

/** Backup completo (catálogo + financeiro) em JSON, baixado pelo navegador. */
export async function exportDataToJSON(): Promise<void> {
  const [sales, transactions, recurring] = await Promise.all([
    fetchAll((f, t) => supabase.from('bg_sales').select('*').order('date').range(f, t)),
    fetchAll((f, t) => supabase.from('bg_transactions').select('*').order('date').range(f, t)),
    fetchAll((f, t) => supabase.from('bg_recurring').select('*').range(f, t)),
  ]);
  const data = {
    version: 'bergamota-os-1',
    exportDate: new Date().toISOString(),
    ingredients: cache.ingredients,
    recipes: cache.recipes,
    priceHistory: cache.priceHistory,
    settings: cache.settings,
    sales,
    finTransactions: transactions,
    recurring,
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `backup_bergamota_os_${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * Restaura o catálogo a partir de um backup (formato do sistema antigo ou do
 * Bergamota OS). Lançamentos financeiros não são sobrescritos por aqui.
 */
export function importDataFromJSON(jsonString: string): boolean {
  try {
    const parsed = JSON.parse(jsonString);
    if (!parsed || !Array.isArray(parsed.ingredients) || !Array.isArray(parsed.recipes)) return false;
    saveStoredIngredients(parsed.ingredients);
    saveStoredRecipes(parsed.recipes);
    if (Array.isArray(parsed.priceHistory)) saveStoredPriceHistory(parsed.priceHistory);
    if (parsed.settings) saveStoredSettings(parsed.settings);
    return true;
  } catch {
    return false;
  }
}
