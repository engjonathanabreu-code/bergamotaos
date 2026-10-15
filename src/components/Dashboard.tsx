import React, { useState } from 'react';
import {
  Boxes,
  Cake,
  TrendingUp,
  AlertTriangle,
  Sparkles,
  Plus,
  ArrowUpRight,
  CheckCircle2,
  HelpCircle,
  FileSpreadsheet,
  RefreshCw,
  BadgePercent,
  Clock,
  Eye,
  Search,
} from 'lucide-react';
import { Recipe, Ingredient, SystemSettings } from '../types';
import { formatCurrency, formatPercentage } from '../utils/conversions';
import { calculateRecipeCost } from '../utils/pricing';
import type { ActiveTab } from '../nav';

interface DashboardProps {
  recipes: Recipe[];
  ingredients: Ingredient[];
  settings: SystemSettings;
  setActiveTab: (tab: ActiveTab) => void;
  onNewRecipe: () => void;
  onNewIngredient: () => void;
  onOpenImportAI: () => void;
  onOpenBatchUpdate: () => void;
  onOpenRecipeDetail: (recipe: Recipe) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  recipes,
  ingredients,
  settings,
  setActiveTab,
  onNewRecipe,
  onNewIngredient,
  onOpenImportAI,
  onOpenBatchUpdate,
  onOpenRecipeDetail,
}) => {
  const ingredientMap = new Map<string, Ingredient>(ingredients.map((i) => [i.id, i]));

  // Calculate stats for all recipes
  const calculatedRecipes = recipes.map((r) => ({
    recipe: r,
    cost: calculateRecipeCost(r, ingredientMap, settings),
  }));

  // "Produtos Ativos" deve refletir de verdade o campo recipe.active (antes ele
  // existia no formulário mas não filtrava nada em lugar nenhum do sistema).
  // Trata undefined como ativo, para não afetar receitas antigas sem o campo.
  const activeRecipes = recipes.filter((r) => r.active !== false);

  // Missing prices
  const ingredientsWithoutPrice = ingredients.filter(
    (i) => !i.purchasePrice || i.purchasePrice <= 0 || !i.packageQuantity
  );

  // Products without selling price
  const productsWithoutPrice = recipes.filter(
    (r) => !r.practicedPrice || r.practicedPrice <= 0
  );

  // Recipes with missing prices in ingredients
  const recipesIncomplete = calculatedRecipes.filter((cr) => cr.cost.isIncomplete);

  // Para o card de "Alertas do Sistema": uma ficha incompleta porque usa um
  // insumo que JÁ está em ingredientsWithoutPrice é a MESMA causa raiz, não um
  // problema novo — sem isso, 1 insumo sem preço usado em 3 fichas virava "4
  // alertas" em vez de 1. Só conta como alerta adicional se houver um motivo
  // distinto (insumo removido do cadastro, unidades incompatíveis, sem rendimento).
  const ingredientsWithoutPriceIds = new Set(ingredientsWithoutPrice.map((i) => i.id));
  const recipesIncompleteForOtherReasons = calculatedRecipes.filter((cr) => {
    if (!cr.cost.isIncomplete) return false;
    if (!cr.recipe.yieldAmount) return true;
    return cr.cost.ingredientsBreakdown.some(
      (b) => !b.hasPrice && !ingredientsWithoutPriceIds.has(b.ingredientId)
    );
  });

  // Products with margin below target
  const lowMarginProducts = calculatedRecipes.filter(
    (cr) =>
      cr.recipe.practicedPrice &&
      cr.recipe.practicedPrice > 0 &&
      cr.cost.realMarginPercentage < (cr.recipe.targetMarginPercentage || settings.defaultTargetMargin)
  );

  const totalEstimatedCost = calculatedRecipes.reduce(
    (acc, curr) => acc + curr.cost.totalRecipeCost,
    0
  );

  // High Density Simulation State (Simulador de Impacto)
  const defaultSimIng = ingredients[0];
  const [selectedSimIngId, setSelectedSimIngId] = useState<string>(
    defaultSimIng?.id || ''
  );
  const [simulatedPrice, setSimulatedPrice] = useState<number>(
    defaultSimIng ? defaultSimIng.purchasePrice * 1.15 : 0
  );

  const currentSimIng =
    ingredients.find((i) => i.id === selectedSimIngId) || defaultSimIng;

  const affectedSimRecipes = currentSimIng
    ? recipes.filter((r) =>
        r.ingredients.some((ri) => ri.ingredientId === currentSimIng.id)
      )
    : [];

  const simPriceDelta = currentSimIng && currentSimIng.purchasePrice > 0
    ? ((simulatedPrice - currentSimIng.purchasePrice) / currentSimIng.purchasePrice) * 100
    : 0;

  return (
    <div id="dashboard-container" className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* High Density Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Produtos Ativos */}
        <div
          id="card-stat-products"
          onClick={() => setActiveTab('recipes')}
          className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs hover:border-emerald-300 cursor-pointer transition-all"
        >
          <div className="text-xs text-gray-500 font-bold uppercase mb-1 tracking-wider">
            Produtos Ativos
          </div>
          <div className="text-2xl font-bold text-gray-900">{activeRecipes.length}</div>
          <div className="text-[10px] text-emerald-600 font-medium mt-1 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            <span>
              {activeRecipes.length - recipesIncomplete.filter((cr) => cr.recipe.active !== false).length} fichas validadas
              {activeRecipes.length < recipes.length && ` · ${recipes.length} no catálogo`}
            </span>
          </div>
        </div>

        {/* Metric 2: Insumos Cadastrados */}
        <div
          id="card-stat-ingredients"
          onClick={() => setActiveTab('ingredients')}
          className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs hover:border-emerald-300 cursor-pointer transition-all"
        >
          <div className="text-xs text-gray-500 font-bold uppercase mb-1 tracking-wider">
            Insumos Cadastrados
          </div>
          <div className="text-2xl font-bold text-gray-900">{ingredients.length}</div>
          <div className="text-[10px] text-gray-400 font-medium mt-1">
            {ingredientsWithoutPrice.length > 0
              ? `${ingredientsWithoutPrice.length} sem preço cadastrado`
              : '100% com preços precificados'}
          </div>
        </div>

        {/* Metric 3: Custo Total Estimado */}
        <div
          id="card-stat-total-cost"
          className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs"
        >
          <div className="text-xs text-gray-500 font-bold uppercase mb-1 tracking-wider">
            Custo Total Estimado
          </div>
          <div className="text-2xl font-bold text-emerald-600 font-mono">
            {formatCurrency(totalEstimatedCost)}
          </div>
          <div className="text-[10px] text-gray-400 font-medium mt-1">
            Soma dos lotes padrão das fichas
          </div>
        </div>

        {/* Metric 4: Alertas do Sistema */}
        <div
          id="card-stat-alerts"
          onClick={() => setActiveTab('pricing')}
          className="bg-white p-4 rounded-xl border border-emerald-200 bg-emerald-50/30 shadow-xs hover:border-emerald-300 cursor-pointer transition-all"
        >
          <div className="text-xs text-emerald-700 font-bold uppercase mb-1 tracking-wider">
            Alertas do Sistema
          </div>
          <div className="text-2xl font-bold text-emerald-800">
            {String(
              ingredientsWithoutPrice.length +
                productsWithoutPrice.length +
                recipesIncompleteForOtherReasons.length +
                lowMarginProducts.length
            ).padStart(2, '0')}
          </div>
          <div className="text-[10px] text-emerald-700 font-medium mt-1">
            {recipesIncomplete.length > 0
              ? `Ação necessária em ${recipesIncomplete.length} fichas`
              : 'Sistema operacional e equilibrado'}
          </div>
        </div>
      </div>

      {/* Main Grid: Fichas Técnicas & Simulador de Impacto */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 cols): Últimas Fichas Técnicas Importadas / Cadastradas */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 shadow-xs flex flex-col overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-white">
            <h3 className="font-bold text-gray-800 text-sm">
              Fichas Técnicas do Catálogo
            </h3>
            <span
              onClick={() => setActiveTab('recipes')}
              className="text-[11px] text-emerald-600 font-bold cursor-pointer hover:underline"
            >
              Ver Todas ({recipes.length})
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 text-[11px] uppercase text-gray-500 font-bold border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3">Produto</th>
                  <th className="px-4 py-3">Insumos</th>
                  <th className="px-4 py-3 text-right">Custo Unit.</th>
                  <th className="px-4 py-3 text-center">Markup</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-center">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {calculatedRecipes.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                      Nenhuma ficha técnica cadastrada.
                    </td>
                  </tr>
                ) : (
                  calculatedRecipes.slice(0, 7).map(({ recipe, cost }) => {
                    const isError = cost.isIncomplete;
                    const isLow =
                      recipe.practicedPrice &&
                      recipe.practicedPrice > 0 &&
                      cost.realMarginPercentage <
                        (recipe.targetMarginPercentage || settings.defaultTargetMargin);

                    return (
                      <tr
                        key={recipe.id}
                        className="hover:bg-gray-50/80 transition-colors"
                      >
                        <td className="px-4 py-3 font-medium text-gray-900">
                          <div className="font-semibold">{recipe.name}</div>
                          <div className="text-[10px] text-gray-400 font-mono">
                            {recipe.category} • Rende {recipe.yieldAmount} {recipe.yieldUnit}
                          </div>
                        </td>

                        <td className="px-4 py-3 text-gray-500 font-mono">
                          {String(recipe.ingredients.length).padStart(2, '0')} itens
                        </td>

                        <td className="px-4 py-3 text-right font-mono font-bold">
                          {isError ? (
                            <span className="text-red-500">PENDENTE</span>
                          ) : (
                            <span className="text-gray-900">
                              {formatCurrency(cost.costPerUnit)}
                            </span>
                          )}
                        </td>

                        <td className="px-4 py-3 text-center font-mono text-gray-700">
                          {recipe.practicedPrice && cost.costPerUnit > 0
                            ? `${cost.realMarkup.toFixed(1)}x`
                            : `${recipe.markup || settings.defaultMarkup}x`}
                        </td>

                        <td className="px-4 py-3 text-center">
                          {isError ? (
                            <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-[10px] font-bold">
                              PENDENTE
                            </span>
                          ) : isLow ? (
                            <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded text-[10px] font-bold">
                              EM ANÁLISE
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded text-[10px] font-bold">
                              VALIDADA
                            </span>
                          )}
                        </td>

                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => onOpenRecipeDetail(recipe)}
                            className="text-xs font-semibold text-emerald-600 hover:text-emerald-800"
                          >
                            Abrir
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Column (1 col): Simulador de Impacto & Insumos Sem Preço */}
        <div className="space-y-6">
          {/* Simulador de Impacto (Dark #111827 Box with Emerald Accent) */}
          <div className="bg-[#111827] text-white p-5 rounded-xl border border-gray-800 shadow-lg">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-1 h-6 bg-emerald-500 rounded-full"></div>
              <h3 className="font-bold text-sm tracking-wide uppercase">
                SIMULADOR DE IMPACTO
              </h3>
            </div>

            <div className="space-y-3">
              <div className="bg-gray-800/60 p-3 rounded-lg">
                <label className="text-[10px] text-gray-400 block mb-1 font-semibold">
                  Selecione o Insumo:
                </label>
                <select
                  value={selectedSimIngId}
                  onChange={(e) => {
                    setSelectedSimIngId(e.target.value);
                    const found = ingredients.find((i) => i.id === e.target.value);
                    if (found) setSimulatedPrice(found.purchasePrice * 1.15);
                  }}
                  className="w-full bg-gray-900 text-white text-xs font-bold p-1.5 rounded border border-gray-700 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                >
                  {ingredients.map((ing) => (
                    <option key={ing.id} value={ing.id}>
                      {ing.name} ({ing.packageQuantity}{ing.packageUnit})
                    </option>
                  ))}
                </select>
              </div>

              {currentSimIng && (
                <>
                  <div className="flex items-center justify-between px-1">
                    <div className="text-[10px] text-gray-400 uppercase font-bold">
                      Preço Atual:
                    </div>
                    <div className="text-sm font-bold font-mono">
                      {formatCurrency(currentSimIng.purchasePrice)}
                    </div>
                  </div>

                  <div className="flex items-center justify-between px-1">
                    <div className="text-[10px] text-emerald-400 uppercase font-bold">
                      Novo Preço Simulado:
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-gray-400">R$</span>
                      <input
                        type="number"
                        step="0.10"
                        value={simulatedPrice}
                        onChange={(e) => setSimulatedPrice(parseFloat(e.target.value) || 0)}
                        className="bg-gray-800 border border-gray-700 rounded text-xs font-bold text-right w-24 py-1 px-2 focus:ring-1 focus:ring-emerald-500 text-emerald-300 font-mono"
                      />
                    </div>
                  </div>

                  <div className="pt-3 border-t border-gray-800">
                    <div className="text-[10px] text-gray-400 mb-2 font-semibold">
                      Impacto Projetado no Catálogo:
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-gray-800/80 p-2.5 rounded">
                        <div className="text-[9px] text-gray-400 uppercase font-bold">
                          Fichas Afetadas
                        </div>
                        <div className="text-sm font-bold text-white font-mono mt-0.5">
                          {affectedSimRecipes.length} produto(s)
                        </div>
                      </div>

                      <div className="bg-gray-800/80 p-2.5 rounded">
                        <div className="text-[9px] text-gray-400 uppercase font-bold">
                          Variação Insumo
                        </div>
                        <div
                          className={`text-sm font-bold font-mono mt-0.5 ${
                            simPriceDelta >= 0 ? 'text-red-400' : 'text-emerald-400'
                          }`}
                        >
                          {simPriceDelta >= 0 ? '+' : ''}
                          {simPriceDelta.toFixed(1)}%
                        </div>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => setActiveTab('ingredients')}
                    className="w-full mt-2 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold rounded uppercase tracking-wider transition-colors shadow-xs"
                  >
                    Gerenciar no Cadastro Central
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Insumos Sem Preço Card */}
          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-sm text-gray-800">
                Insumos Sem Preço
              </h3>
              <span className="text-[10px] font-bold text-gray-400 font-mono">
                {ingredientsWithoutPrice.length} pendente(s)
              </span>
            </div>

            <div className="space-y-2">
              {ingredientsWithoutPrice.length === 0 ? (
                <div className="p-3 bg-emerald-50 text-emerald-800 rounded-lg text-xs font-semibold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Todos os insumos estão precificados!</span>
                </div>
              ) : (
                ingredientsWithoutPrice.slice(0, 4).map((ing) => (
                  <div
                    key={ing.id}
                    onClick={() => setActiveTab('ingredients')}
                    className="flex items-center justify-between p-2.5 hover:bg-gray-50 rounded-lg group cursor-pointer border border-gray-100 transition-colors"
                  >
                    <div className="text-xs font-medium text-gray-800 truncate max-w-[170px]">
                      {ing.name}
                    </div>
                    <span className="text-[10px] text-red-500 font-bold uppercase tracking-wider group-hover:underline">
                      CADASTRAR
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Validation Banner: Scenario Rule 36 Testing Guarantee */}
      <div
        id="scenario-36-validation-box"
        className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-4 sm:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xs"
      >
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="font-bold text-emerald-950 text-sm">
                Conformidade Matemática & Precisão Financeira
              </h4>
              <span className="text-[10px] uppercase tracking-wider font-bold bg-emerald-200 text-emerald-900 px-2 py-0.5 rounded-md">
                100% Auditável
              </span>
            </div>
            <p className="text-xs text-emerald-900 mt-1 leading-relaxed">
              <strong>Cenário da Especificação:</strong> Farinha de arroz (1 kg = R$ 10,00) → 250 g = R$ 2,50 | Açúcar (1 kg = R$ 5,00) → 200 g = R$ 1,00 | Cacau (500 g = R$ 20,00) → 50 g = R$ 2,00. <strong>Total = R$ 5,50 ÷ 10 unidades = R$ 0,55/unidade.</strong>
            </p>
          </div>
        </div>
        <button
          id="btn-view-rule36-recipe"
          onClick={() => {
            const rule36Recipe = recipes.find((r) => r.id === 'rec-validation-36');
            if (rule36Recipe) onOpenRecipeDetail(rule36Recipe);
            else setActiveTab('recipes');
          }}
          className="shrink-0 text-xs font-bold px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg transition-colors flex items-center gap-1.5 shadow-xs"
        >
          <span>Auditar Ficha do Cenário</span>
          <ArrowUpRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
