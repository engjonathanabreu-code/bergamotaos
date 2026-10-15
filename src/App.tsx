import React, { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { Menu, LogOut, CloudCheck, CloudUpload, RefreshCw, Plus } from 'lucide-react';
import { supabase, supabaseConfigured } from './lib/supabase';
import { FinanceProvider, useFinance } from './data/finance';
import { Login, Logo } from './features/auth/Login';
import { NAV_SECTIONS, tabLabel, type ActiveTab, ALL_TABS } from './nav';
import type { Ingredient, PriceHistory, Recipe, SystemSettings } from './types';
import {
  loadCatalog,
  primeCatalog,
  getStoredIngredients,
  getStoredRecipes,
  getStoredPriceHistory,
  getStoredSettings,
  saveStoredIngredients,
  saveStoredRecipes,
  saveStoredPriceHistory,
  saveStoredSettings,
  DEFAULT_FINANCE,
} from './utils/storage';
import { calculateRecipeCost } from './utils/pricing';

import { IngredientFormModal } from './components/Ingredients/IngredientFormModal';
import { IngredientHistoryModal } from './components/Ingredients/IngredientHistoryModal';
import { BatchPriceUpdateModal } from './components/Ingredients/BatchPriceUpdateModal';
import { ImportIngredientsModal } from './components/Ingredients/ImportIngredientsModal';
import { RecipeFormModal } from './components/Recipes/RecipeFormModal';
import { RecipeDetailModal } from './components/Recipes/RecipeDetailModal';
import { RecipeScaleModal } from './components/Recipes/RecipeScaleModal';

const lazyNamed = <T extends Record<string, React.ComponentType<any>>>(loader: () => Promise<T>, name: keyof T) =>
  lazy(() => loader().then((m) => ({ default: m[name] })));

const PainelView = lazyNamed(() => import('./features/finance/PainelView'), 'PainelView');
const CaixaView = lazyNamed(() => import('./features/finance/CaixaView'), 'CaixaView');
const VendasView = lazyNamed(() => import('./features/finance/VendasView'), 'VendasView');
const DespesasView = lazyNamed(() => import('./features/finance/DespesasView'), 'DespesasView');
const DreView = lazyNamed(() => import('./features/finance/DreView'), 'DreView');
const PlanejamentoView = lazyNamed(() => import('./features/finance/PlanejamentoView'), 'PlanejamentoView');
const Dashboard = lazyNamed(() => import('./components/Dashboard'), 'Dashboard');
const IngredientsList = lazyNamed(() => import('./components/Ingredients/IngredientsList'), 'IngredientsList');
const RecipesList = lazyNamed(() => import('./components/Recipes/RecipesList'), 'RecipesList');
const PricingView = lazyNamed(() => import('./components/Pricing/PricingView'), 'PricingView');
const ImportRecipeAIView = lazyNamed(() => import('./components/ImportAI/ImportRecipeAIView'), 'ImportRecipeAIView');
const PriceHistoryView = lazyNamed(() => import('./components/History/PriceHistoryView'), 'PriceHistoryView');
const ReportsView = lazyNamed(() => import('./components/Reports/ReportsView'), 'ReportsView');
const SettingsView = lazyNamed(() => import('./components/Settings/SettingsView'), 'SettingsView');

// ---------------------------------------------------------------------------
// Raiz: configuração → login → verificação de acesso → carga de dados
// ---------------------------------------------------------------------------

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  if (import.meta.env.DEV && new URLSearchParams(window.location.search).has('preview')) {
    return (
      <FinanceProvider>
        <DevPreview />
      </FinanceProvider>
    );
  }
  if (!supabaseConfigured) {
    return <Centered title="Configuração pendente" text="Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY (veja .env.example)." />;
  }
  if (session === undefined) return <Splash />;
  if (!session) return <Login />;
  return (
    <FinanceProvider key={session.user.id}>
      <Gate email={session.user.email || ''} />
    </FinanceProvider>
  );
}

function Gate({ email }: { email: string }) {
  const finance = useFinance();
  const [status, setStatus] = useState<'loading' | 'denied' | 'error' | 'ready'>('loading');
  const [error, setError] = useState('');

  const boot = useCallback(async () => {
    setStatus('loading');
    try {
      const { data: member, error: rpcError } = await supabase.rpc('bg_is_member');
      if (rpcError) throw new Error(rpcError.message);
      if (!member) return setStatus('denied');
      await Promise.all([loadCatalog(), finance.load()]);
      setStatus('ready');
    } catch (e: any) {
      setError(e.message || String(e));
      setStatus('error');
    }
  }, [finance.load]);

  useEffect(() => {
    boot();
  }, [boot]);

  if (status === 'loading') return <Splash text="Carregando dados da Bergamota…" />;
  if (status === 'denied')
    return (
      <Centered
        title="Sem acesso"
        text={`O e-mail ${email} ainda não está liberado no Bergamota OS. Peça para um administrador incluir em bg_members.`}
        action={<button className="btn btn-secondary" onClick={() => supabase.auth.signOut()}>Sair</button>}
      />
    );
  if (status === 'error')
    return <Centered title="Não foi possível carregar" text={error} action={<button className="btn btn-primary" onClick={boot}>Tentar de novo</button>} />;
  return <Workspace email={email} />;
}

/** Apenas `npm run dev` com ?preview: usa scripts/seed/*.json, sem login e sem gravar no banco. */
function DevPreview() {
  const { prime } = useFinance();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const get = (n: string) => fetch(`/scripts/seed/${n}.json`).then((r) => r.json());
    Promise.all(['ingredients', 'recipes', 'price_history', 'settings', 'sales', 'transactions', 'closed_days'].map(get)).then(
      ([ingredients, recipes, priceHistory, settings, sales, transactions, closedDays]) => {
        primeCatalog({ ingredients, recipes, priceHistory, settings });
        prime({
          sales: sales.map((s: any, i: number) => ({ ...s, id: `s${i}`, is_aggregate: Boolean(s.aggregate) })),
          transactions: transactions.map((t: any, i: number) => ({ ...t, id: `t${i}`, grp: t.group })),
          closedDays,
          recurring: transactions
            .filter((t: any) => t.competencia === '2026-09' && (t.group === 'fixa' || t.category === 'Pró-labore'))
            .map((t: any, i: number) => ({ ...t, id: `r${i}`, grp: t.group, day_of_month: 10, start_month: '2026-11', active: true })),
        });
        setReady(true);
      }
    );
  }, [prime]);
  return ready ? <Workspace email="preview@local" /> : <Splash text="Pré-visualização local…" />;
}

function Splash({ text }: { text?: string }) {
  return (
    <div className="h-full flex flex-col items-center justify-center gap-4 bg-amber-500 text-white">
      <Logo className="w-16 h-16" />
      <div className="w-6 h-6 border-2 border-white/40 border-t-white rounded-full animate-spin" />
      {text && <p className="text-sm opacity-90">{text}</p>}
    </div>
  );
}

function Centered({ title, text, action }: { title: string; text: string; action?: React.ReactNode }) {
  return (
    <div className="h-full flex items-center justify-center p-6">
      <div className="bg-white shadow-md rounded-[4px] p-6 max-w-md text-center">
        <h1 className="text-lg text-stone-800">{title}</h1>
        <p className="text-sm text-stone-500 mt-2 break-words">{text}</p>
        {action && <div className="mt-5">{action}</div>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Área de trabalho
// ---------------------------------------------------------------------------

const readHash = (): ActiveTab => {
  const h = window.location.hash.replace(/^#\/?/, '') as ActiveTab;
  return ALL_TABS.some((t) => t.id === h) ? h : 'fin-painel';
};

function Workspace({ email }: { email: string }) {
  const [activeTab, setActiveTabState] = useState<ActiveTab>(readHash);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const [ingredients, setIngredients] = useState<Ingredient[]>(getStoredIngredients);
  const [recipes, setRecipes] = useState<Recipe[]>(getStoredRecipes);
  const [priceHistory, setPriceHistory] = useState<PriceHistory[]>(getStoredPriceHistory);
  const [settings, setSettings] = useState<SystemSettings>(getStoredSettings);

  const [isIngredientModalOpen, setIsIngredientModalOpen] = useState(false);
  const [editingIngredient, setEditingIngredient] = useState<Ingredient | null>(null);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [selectedHistoryIngredient, setSelectedHistoryIngredient] = useState<Ingredient | null>(null);
  const [isBatchUpdateOpen, setIsBatchUpdateOpen] = useState(false);
  const [isImportSpreadsheetOpen, setIsImportSpreadsheetOpen] = useState(false);
  const [isRecipeFormModalOpen, setIsRecipeFormModalOpen] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);
  const [isRecipeDetailModalOpen, setIsRecipeDetailModalOpen] = useState(false);
  const [selectedDetailRecipe, setSelectedDetailRecipe] = useState<Recipe | null>(null);
  const [isRecipeScaleModalOpen, setIsRecipeScaleModalOpen] = useState(false);
  const [selectedScaleRecipe, setSelectedScaleRecipe] = useState<Recipe | null>(null);

  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'warning' } | null>(null);
  const [pending, setPending] = useState(0);

  const setActiveTab = useCallback((tab: ActiveTab) => {
    setActiveTabState(tab);
    setDrawerOpen(false);
    window.location.hash = `/${tab}`;
    document.querySelector('main')?.scrollTo({ top: 0 });
  }, []);

  useEffect(() => {
    const onHash = () => setActiveTabState(readHash());
    const onErr = (e: Event) => showToast(`Erro ao salvar no servidor: ${(e as CustomEvent).detail}`, 'warning');
    const onSync = (e: Event) => setPending((e as CustomEvent).detail.pending);
    window.addEventListener('hashchange', onHash);
    window.addEventListener('bg:sync-error', onErr);
    window.addEventListener('bg:sync-state', onSync);
    return () => {
      window.removeEventListener('hashchange', onHash);
      window.removeEventListener('bg:sync-error', onErr);
      window.removeEventListener('bg:sync-state', onSync);
    };
  }, []);

  useEffect(() => {
    document.title = `${tabLabel(activeTab)} · Bergamota OS`;
  }, [activeTab]);

  const showToast = (msg: string, type: 'success' | 'warning' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3800);
  };

  const reloadCatalog = async () => {
    await loadCatalog();
    setIngredients(getStoredIngredients());
    setRecipes(getStoredRecipes());
    setPriceHistory(getStoredPriceHistory());
    setSettings(getStoredSettings());
  };

  // ---------------------------------------------------------------- Insumos
  const handleSaveIngredient = (
    ingData: Omit<Ingredient, 'id' | 'createdAt' | 'updatedAt'> & { id?: string },
    priceChangeReason?: string
  ) => {
    const now = new Date().toISOString();
    if (ingData.id) {
      const existing = ingredients.find((i) => i.id === ingData.id);
      if (existing && existing.purchasePrice !== ingData.purchasePrice) {
        const delta = existing.purchasePrice ? ((ingData.purchasePrice - existing.purchasePrice) / existing.purchasePrice) * 100 : 0;
        const updatedHistory = [
          {
            id: `hist-${Date.now()}`,
            ingredientId: existing.id,
            previousPrice: existing.purchasePrice,
            newPrice: ingData.purchasePrice,
            changePercentage: delta,
            date: now,
            reason: priceChangeReason || 'Atualização manual no cadastro',
          },
          ...priceHistory,
        ];
        setPriceHistory(updatedHistory);
        saveStoredPriceHistory(updatedHistory);
      }
      const updated = ingredients.map((i) => (i.id === ingData.id ? { ...i, ...ingData, updatedAt: now } : i));
      setIngredients(updated);
      saveStoredIngredients(updated);
      showToast(`Insumo "${ingData.name}" atualizado! Custos das fichas recalculados.`);
    } else {
      const newIng: Ingredient = { id: `ing-${Date.now()}`, ...ingData, createdAt: now, updatedAt: now };
      const updated = [...ingredients, newIng];
      setIngredients(updated);
      saveStoredIngredients(updated);
      showToast(`Insumo "${newIng.name}" cadastrado.`);
    }
  };

  const handleDeleteIngredient = (id: string) => {
    const updated = ingredients.filter((i) => i.id !== id);
    setIngredients(updated);
    saveStoredIngredients(updated);
    showToast('Insumo removido.');
  };

  const handleBatchUpdatePrices = (updates: { id: string; newPrice: number }[], reason: string) => {
    const now = new Date().toISOString();
    const newHistories: PriceHistory[] = [];
    const updatedIngredients = ingredients.map((ing) => {
      const target = updates.find((u) => u.id === ing.id);
      if (target && target.newPrice !== ing.purchasePrice) {
        newHistories.push({
          id: `hist-${Date.now()}-${ing.id}`,
          ingredientId: ing.id,
          previousPrice: ing.purchasePrice,
          newPrice: target.newPrice,
          changePercentage: ((target.newPrice - ing.purchasePrice) / (ing.purchasePrice || 1)) * 100,
          date: now,
          reason,
        });
        return { ...ing, purchasePrice: target.newPrice, updatedAt: now };
      }
      return ing;
    });
    const updatedHistory = [...newHistories, ...priceHistory];
    setIngredients(updatedIngredients);
    saveStoredIngredients(updatedIngredients);
    setPriceHistory(updatedHistory);
    saveStoredPriceHistory(updatedHistory);
    showToast(`${updates.length} insumos atualizados em massa. Fichas recalculadas.`);
  };

  const handleImportSpreadsheetIngredients = (newIngs: Omit<Ingredient, 'id' | 'createdAt' | 'updatedAt'>[]) => {
    const now = new Date().toISOString();
    const created = newIngs.map((n, idx) => ({ id: `ing-imp-${Date.now()}-${idx}`, ...n, createdAt: now, updatedAt: now }));
    const updated = [...ingredients, ...created];
    setIngredients(updated);
    saveStoredIngredients(updated);
    showToast(`${created.length} insumos importados da planilha.`);
  };

  // ---------------------------------------------------------------- Fichas
  const handleSaveRecipe = (recipeData: Omit<Recipe, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) => {
    const now = new Date().toISOString();
    if (recipeData.id) {
      const updated = recipes.map((r) => (r.id === recipeData.id ? { ...r, ...recipeData, updatedAt: now } : r));
      setRecipes(updated);
      saveStoredRecipes(updated);
      showToast(`Ficha "${recipeData.name}" atualizada.`);
    } else {
      const newRecipe: Recipe = { id: `rec-${Date.now()}`, ...recipeData, createdAt: now, updatedAt: now };
      const updated = [...recipes, newRecipe];
      setRecipes(updated);
      saveStoredRecipes(updated);
      showToast(`Ficha "${newRecipe.name}" criada.`);
    }
  };

  const handleDeleteRecipe = (id: string) => {
    const updated = recipes.filter((r) => r.id !== id);
    setRecipes(updated);
    saveStoredRecipes(updated);
    showToast('Ficha técnica excluída.');
  };

  const handleDuplicateRecipe = (recipe: Recipe) => {
    const now = new Date().toISOString();
    const dup: Recipe = {
      ...recipe,
      id: `rec-dup-${Date.now()}`,
      name: `${recipe.name} (Cópia)`,
      code: recipe.code ? `${recipe.code}-COP` : '',
      createdAt: now,
      updatedAt: now,
    };
    const updated = [...recipes, dup];
    setRecipes(updated);
    saveStoredRecipes(updated);
    showToast(`Ficha duplicada: "${dup.name}"`);
  };

  const handleUpdateRecipePrice = (recipeId: string, practicedPrice?: number, markup?: number, targetMargin?: number) => {
    const now = new Date().toISOString();
    const updated = recipes.map((r) =>
      r.id === recipeId
        ? {
            ...r,
            practicedPrice,
            ...(markup ? { markup } : {}),
            ...(targetMargin ? { targetMarginPercentage: targetMargin } : {}),
            updatedAt: now,
          }
        : r
    );
    setRecipes(updated);
    saveStoredRecipes(updated);
  };

  const handleImportRecipeAI = (
    newRecipeData: Omit<Recipe, 'id' | 'createdAt' | 'updatedAt'>,
    newIngredientsToCreate?: (Omit<Ingredient, 'id' | 'createdAt' | 'updatedAt'> & { tempId: string })[]
  ) => {
    const now = new Date().toISOString();
    const tempIdToRealId = new Map<string, string>();
    if (newIngredientsToCreate?.length) {
      const created: Ingredient[] = newIngredientsToCreate.map((n, idx) => {
        const { tempId, ...ingData } = n;
        const realId = `ing-ai-${Date.now()}-${idx}`;
        tempIdToRealId.set(tempId, realId);
        return { id: realId, ...ingData, createdAt: now, updatedAt: now };
      });
      const updatedIngs = [...ingredients, ...created];
      setIngredients(updatedIngs);
      saveStoredIngredients(updatedIngs);
    }
    const finalRecipe: Recipe = {
      id: `rec-ai-${Date.now()}`,
      ...newRecipeData,
      ingredients: newRecipeData.ingredients.map((ri) =>
        tempIdToRealId.has(ri.ingredientId) ? { ...ri, ingredientId: tempIdToRealId.get(ri.ingredientId)! } : ri
      ),
      createdAt: now,
      updatedAt: now,
    };
    const updated = [...recipes, finalRecipe];
    setRecipes(updated);
    saveStoredRecipes(updated);
    showToast(`Receita "${finalRecipe.name}" importada.`);
    setActiveTab('recipes');
  };

  const handleSaveSettings = (next: SystemSettings) => {
    setSettings(next);
    saveStoredSettings(next);
    showToast('Configurações salvas.');
  };

  const ingredientMap = new Map(ingredients.map((i) => [i.id, i]));
  const alerts =
    recipes.filter((r) => calculateRecipeCost(r, ingredientMap, settings).isIncomplete).length +
    ingredients.filter((i) => !i.purchasePrice || i.purchasePrice <= 0).length;

  const openNewRecipe = () => {
    setEditingRecipe(null);
    setIsRecipeFormModalOpen(true);
  };
  const openNewIngredient = () => {
    setEditingIngredient(null);
    setIsIngredientModalOpen(true);
  };
  const openRecipeDetail = (recipe: Recipe) => {
    setSelectedDetailRecipe(recipe);
    setIsRecipeDetailModalOpen(true);
  };

  const fin = settings.finance || DEFAULT_FINANCE;
  const isProduction = !activeTab.startsWith('fin-') && activeTab !== 'settings';

  return (
    <div className="h-full flex flex-col">
      {/* App bar */}
      <header className="no-print h-14 shrink-0 bg-amber-500 text-white flex items-center gap-2 px-2 sm:px-4 shadow-md z-30">
        <button type="button" className="lg:hidden p-2 rounded-full hover:bg-white/15" aria-label="Abrir menu" onClick={() => setDrawerOpen(true)}>
          <Menu className="w-5 h-5" />
        </button>
        <div className="hidden lg:flex items-center gap-2 w-60 shrink-0">
          <Logo className="w-8 h-8" />
          <span className="text-lg font-medium tracking-tight">bergamota</span>
          <span className="text-[10px] tracking-[0.25em] uppercase opacity-80 mt-1">OS</span>
        </div>
        <h1 className="text-lg font-normal truncate flex-1">{tabLabel(activeTab)}</h1>
        {isProduction && (
          <div className="hidden md:flex items-center gap-1">
            <button type="button" className="btn h-8 text-white hover:bg-white/15" onClick={openNewIngredient}>
              <Plus className="w-4 h-4" /> Insumo
            </button>
            <button type="button" className="btn h-8 bg-white text-amber-700 hover:bg-amber-50" onClick={openNewRecipe}>
              <Plus className="w-4 h-4" /> Ficha
            </button>
          </div>
        )}
        <span className="p-2" title={pending ? 'Salvando…' : 'Tudo salvo'}>
          {pending ? <CloudUpload className="w-5 h-5 animate-pulse" /> : <CloudCheck className="w-5 h-5 opacity-80" />}
        </span>
      </header>

      <div className="flex-1 flex min-h-0">
        {/* Drawer */}
        {drawerOpen && <div className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={() => setDrawerOpen(false)} />}
        <aside
          className={`no-print fixed lg:static inset-y-0 left-0 z-50 w-72 lg:w-64 bg-white shadow-xl lg:shadow-sm flex flex-col transition-transform duration-200 ${
            drawerOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
          }`}
        >
          <div className="lg:hidden h-32 bg-amber-500 text-white p-4 flex flex-col justify-end">
            <Logo className="w-10 h-10 mb-2" />
            <div className="text-sm truncate">{email}</div>
          </div>
          <div className="hidden lg:flex items-center justify-between px-4 py-3 border-b border-stone-100 text-xs text-stone-600">
            <span className="truncate">{email}</span>
          </div>
          <nav className="flex-1 overflow-y-auto py-2">
            {NAV_SECTIONS.map((section) => (
              <div key={section.title} className="py-1">
                <div className="px-4 pt-3 pb-1 section-label">{section.title}</div>
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const active = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setActiveTab(item.id)}
                      className={`w-full flex items-center gap-4 px-4 h-11 text-sm transition-colors ${
                        active ? 'text-amber-600 bg-amber-50 font-medium' : 'text-stone-700 hover:bg-stone-50'
                      }`}
                    >
                      <Icon className={`w-5 h-5 ${active ? 'text-amber-500' : 'text-stone-500'}`} />
                      <span className="flex-1 text-left">{item.label}</span>
                      {item.id === 'dashboard' && alerts > 0 && (
                        <span className="text-[10px] px-1.5 rounded-full bg-rose-100 text-rose-600">{alerts}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </nav>
          <div className="border-t border-stone-100 p-2 flex gap-1">
            <button type="button" className="btn btn-text flex-1 justify-start text-stone-600" onClick={reloadCatalog} title="Recarregar dados do servidor">
              <RefreshCw className="w-4 h-4" /> Atualizar
            </button>
            <button type="button" className="btn btn-text text-stone-600" onClick={() => supabase.auth.signOut()}>
              <LogOut className="w-4 h-4" /> Sair
            </button>
          </div>
        </aside>

        {/* Conteúdo */}
        <main className="flex-1 overflow-y-auto min-w-0">
          <Suspense
            fallback={
              <div className="flex items-center justify-center h-64 text-stone-400 text-xs gap-2">
                <div className="w-4 h-4 border-2 border-stone-300 border-t-amber-500 rounded-full animate-spin" />
                Carregando…
              </div>
            }
          >
            {activeTab === 'fin-painel' && (
              <PainelView fin={fin} settings={settings} recipes={recipes} ingredients={ingredients} onNavigate={setActiveTab} />
            )}
            {activeTab === 'fin-caixa' && <CaixaView fin={fin} />}
            {activeTab === 'fin-vendas' && <VendasView />}
            {activeTab === 'fin-despesas' && <DespesasView settings={settings} />}
            {activeTab === 'fin-dre' && <DreView fin={fin} />}
            {activeTab === 'fin-planejamento' && <PlanejamentoView fin={fin} settings={settings} onSaveSettings={handleSaveSettings} />}

            {activeTab === 'dashboard' && (
              <Dashboard
                recipes={recipes}
                ingredients={ingredients}
                settings={settings}
                setActiveTab={setActiveTab}
                onNewRecipe={openNewRecipe}
                onNewIngredient={openNewIngredient}
                onOpenImportAI={() => setActiveTab('import-ai')}
                onOpenBatchUpdate={() => setIsBatchUpdateOpen(true)}
                onOpenRecipeDetail={openRecipeDetail}
              />
            )}
            {activeTab === 'recipes' && (
              <RecipesList
                recipes={recipes}
                ingredients={ingredients}
                settings={settings}
                onAddRecipe={openNewRecipe}
                onViewRecipe={openRecipeDetail}
                onEditRecipe={(recipe: Recipe) => {
                  setEditingRecipe(recipe);
                  setIsRecipeFormModalOpen(true);
                }}
                onDuplicateRecipe={handleDuplicateRecipe}
                onScaleRecipe={(recipe: Recipe) => {
                  setSelectedScaleRecipe(recipe);
                  setIsRecipeScaleModalOpen(true);
                }}
                onDeleteRecipe={handleDeleteRecipe}
                onOpenImportAI={() => setActiveTab('import-ai')}
              />
            )}
            {activeTab === 'ingredients' && (
              <IngredientsList
                ingredients={ingredients}
                priceHistory={priceHistory}
                recipes={recipes}
                settings={settings}
                onAddIngredient={openNewIngredient}
                onEditIngredient={(ing: Ingredient) => {
                  setEditingIngredient(ing);
                  setIsIngredientModalOpen(true);
                }}
                onDeleteIngredient={handleDeleteIngredient}
                onOpenHistory={(ing: Ingredient) => {
                  setSelectedHistoryIngredient(ing);
                  setIsHistoryModalOpen(true);
                }}
                onOpenBatchUpdate={() => setIsBatchUpdateOpen(true)}
                onOpenImportModal={() => setIsImportSpreadsheetOpen(true)}
              />
            )}
            {activeTab === 'pricing' && (
              <PricingView recipes={recipes} ingredients={ingredients} settings={settings} onUpdateRecipePrice={handleUpdateRecipePrice} />
            )}
            {activeTab === 'import-ai' && (
              <ImportRecipeAIView
                ingredients={ingredients}
                settings={settings}
                onRecipeImported={handleImportRecipeAI}
                onCancel={() => setActiveTab('recipes')}
              />
            )}
            {activeTab === 'history' && <PriceHistoryView history={priceHistory} ingredients={ingredients} recipes={recipes} />}
            {activeTab === 'reports' && <ReportsView recipes={recipes} ingredients={ingredients} settings={settings} />}
            {activeTab === 'settings' && (
              <SettingsView settings={settings} onSaveSettings={handleSaveSettings} onReloadAllData={reloadCatalog} />
            )}
          </Suspense>
        </main>
      </div>

      <IngredientFormModal
        isOpen={isIngredientModalOpen}
        onClose={() => {
          setIsIngredientModalOpen(false);
          setEditingIngredient(null);
        }}
        onSave={handleSaveIngredient}
        initialIngredient={editingIngredient}
        settings={settings}
      />
      <IngredientHistoryModal
        isOpen={isHistoryModalOpen}
        onClose={() => {
          setIsHistoryModalOpen(false);
          setSelectedHistoryIngredient(null);
        }}
        ingredient={selectedHistoryIngredient}
        history={priceHistory}
      />
      <BatchPriceUpdateModal
        isOpen={isBatchUpdateOpen}
        onClose={() => setIsBatchUpdateOpen(false)}
        ingredients={ingredients}
        recipes={recipes}
        settings={settings}
        onApplyBatchUpdate={handleBatchUpdatePrices}
      />
      <ImportIngredientsModal
        isOpen={isImportSpreadsheetOpen}
        onClose={() => setIsImportSpreadsheetOpen(false)}
        existingIngredients={ingredients}
        settings={settings}
        onImportConfirmed={handleImportSpreadsheetIngredients}
      />
      <RecipeFormModal
        isOpen={isRecipeFormModalOpen}
        onClose={() => {
          setIsRecipeFormModalOpen(false);
          setEditingRecipe(null);
        }}
        onSave={handleSaveRecipe}
        initialRecipe={editingRecipe}
        ingredients={ingredients}
        settings={settings}
      />
      <RecipeDetailModal
        isOpen={isRecipeDetailModalOpen}
        onClose={() => {
          setIsRecipeDetailModalOpen(false);
          setSelectedDetailRecipe(null);
        }}
        recipe={selectedDetailRecipe}
        ingredients={ingredients}
        settings={settings}
        onEdit={(recipe) => {
          setIsRecipeDetailModalOpen(false);
          setEditingRecipe(recipe);
          setIsRecipeFormModalOpen(true);
        }}
        onDuplicate={(recipe) => {
          setIsRecipeDetailModalOpen(false);
          handleDuplicateRecipe(recipe);
        }}
        onScale={(recipe) => {
          setIsRecipeDetailModalOpen(false);
          setSelectedScaleRecipe(recipe);
          setIsRecipeScaleModalOpen(true);
        }}
      />
      <RecipeScaleModal
        isOpen={isRecipeScaleModalOpen}
        onClose={() => {
          setIsRecipeScaleModalOpen(false);
          setSelectedScaleRecipe(null);
        }}
        recipe={selectedScaleRecipe}
        ingredients={ingredients}
        settings={settings}
      />

      {toast && (
        <div role="status" className="no-print fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] bg-stone-800 text-white px-5 py-3 rounded-[4px] shadow-xl text-sm flex items-center gap-3 max-w-[90vw]">
          <span className={`w-2 h-2 rounded-full ${toast.type === 'warning' ? 'bg-rose-400' : 'bg-emerald-400'}`} />
          {toast.msg}
        </div>
      )}
    </div>
  );
}
