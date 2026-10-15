import React, { useState } from 'react';
import {
  BadgePercent,
  TrendingUp,
  Save,
  Download,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  Calculator,
  RefreshCw,
  Search,
  ArrowUpDown,
  FileSpreadsheet,
} from 'lucide-react';
import { Recipe, Ingredient, SystemSettings } from '../../types';
import {
  formatCurrency,
  formatPercentage,
  formatNumber,
} from '../../utils/conversions';
import { calculateRecipeCost } from '../../utils/pricing';
import { exportDataToExcel } from '../../utils/fileParser';

interface PricingViewProps {
  recipes: Recipe[];
  ingredients: Ingredient[];
  settings: SystemSettings;
  onUpdateRecipePrice: (recipeId: string, practicedPrice?: number, markup?: number, targetMargin?: number) => void;
}

export const PricingView: React.FC<PricingViewProps> = ({
  recipes,
  ingredients,
  settings,
  onUpdateRecipePrice,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [editedPrices, setEditedPrices] = useState<Record<string, number | ''>>({});
  const [savedSuccessMsg, setSavedSuccessMsg] = useState<string | null>(null);

  const ingredientMap = new Map<string, Ingredient>(ingredients.map((i) => [i.id, i]));

  // Calculate pricing for all recipes
  const items = recipes
    .filter((r) => {
      const matchSearch =
        r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (r.code && r.code.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchCat = selectedCategory === 'all' || r.category === selectedCategory;
      return matchSearch && matchCat;
    })
    .map((recipe) => {
      const cost = calculateRecipeCost(recipe, ingredientMap, settings);
      const currentPrice =
        editedPrices[recipe.id] !== undefined
          ? (typeof editedPrices[recipe.id] === 'number' ? Number(editedPrices[recipe.id]) : undefined)
          : recipe.practicedPrice;

      const effectiveCost = cost.costPerUnit;
      const profit = currentPrice ? currentPrice - effectiveCost : 0;
      const margin = currentPrice && currentPrice > 0 ? (profit / currentPrice) * 100 : 0;
      const effectiveMarkup = effectiveCost > 0 && currentPrice ? currentPrice / effectiveCost : 0;

      const targetMargin = recipe.targetMarginPercentage || settings.defaultTargetMargin;
      const isLowMargin = currentPrice !== undefined && margin < targetMargin;

      return {
        recipe,
        cost,
        currentPrice,
        profit,
        margin,
        effectiveMarkup,
        targetMargin,
        isLowMargin,
      };
    });

  const handlePriceChange = (recipeId: string, value: string) => {
    setEditedPrices((prev) => ({
      ...prev,
      [recipeId]: value === '' ? '' : parseFloat(value) || 0,
    }));
  };

  const handleSavePrice = (recipeId: string) => {
    const newPriceVal = editedPrices[recipeId];
    if (newPriceVal !== undefined) {
      onUpdateRecipePrice(
        recipeId,
        newPriceVal === '' ? undefined : Number(newPriceVal)
      );
      setSavedSuccessMsg('Preço atualizado com sucesso!');
      setTimeout(() => setSavedSuccessMsg(null), 3000);
    }
  };

  const handleSaveAllEdited = () => {
    Object.entries(editedPrices).forEach(([recipeId, val]) => {
      onUpdateRecipePrice(recipeId, val === '' ? undefined : Number(val));
    });
    setEditedPrices({});
    setSavedSuccessMsg('Todos os preços foram salvos!');
    setTimeout(() => setSavedSuccessMsg(null), 3000);
  };

  const handleExportPricingExcel = () => {
    const data = items.map((it) => ({
      'Código': it.recipe.code || '',
      'Produto': it.recipe.name,
      'Categoria': it.recipe.category,
      'Custo Unitário (R$)': it.cost.costPerUnit,
      'Markup Configurado': `${it.recipe.markup || settings.defaultMarkup}x`,
      'Preço Sugerido Markup (R$)': it.cost.suggestedPriceMarkup,
      'Meta Margem (%)': `${it.targetMargin}%`,
      'Preço Sugerido Margem (R$)': it.cost.suggestedPriceMargin,
      'Preço Praticado (R$)': it.currentPrice || '',
      'Lucro Unitário (R$)': it.profit,
      'Margem Real (%)': `${it.margin.toFixed(1)}%`,
      'Markup Efetivo': `${it.effectiveMarkup.toFixed(2)}x`,
    }));

    exportDataToExcel('tabela_precificacao_margens', 'Precificação', data);
  };

  const pendingCount = Object.keys(editedPrices).length;

  return (
    <div id="pricing-view-container" className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <BadgePercent className="w-5 h-5 text-emerald-600" />
            Tabela de Precificação & Margens
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Diferencie com precisão <strong>Markup Multiplicador</strong> (Custo × Fator) de <strong>Margem de Lucro</strong> [Lucro ÷ Preço Venda].
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleExportPricingExcel}
            className="px-3 py-2 bg-white hover:bg-gray-50 text-gray-700 rounded-lg text-xs font-semibold border border-gray-200 shadow-2xs flex items-center gap-1.5 transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-gray-500" />
            <span>Exportar Planilha</span>
          </button>

          {pendingCount > 0 && (
            <button
              id="btn-save-all-prices"
              onClick={handleSaveAllEdited}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Salvar {pendingCount} Alterações</span>
            </button>
          )}
        </div>
      </div>

      {/* Success Notification */}
      {savedSuccessMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>{savedSuccessMsg}</span>
        </div>
      )}

      {/* Educational Banner: Markup vs Margin */}
      <div className="p-4 bg-emerald-50/50 border border-emerald-200/80 rounded-xl grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-emerald-950 shadow-xs">
        <div className="flex items-start gap-2.5">
          <div className="w-6 h-6 rounded-md bg-emerald-200 text-emerald-900 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
            1
          </div>
          <div>
            <h4 className="font-bold text-gray-900">Método Markup (Multiplicador de Custo)</h4>
            <p className="text-gray-600 text-[11px] mt-0.5 leading-relaxed">
              Fórmula: <code>Preço = Custo × Fator</code> (Ex: R$ 5,00 × 3,0x = R$ 15,00). Muito prático para padronizar precificação de linha de produção.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-2.5">
          <div className="w-6 h-6 rounded-md bg-amber-200 text-amber-900 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
            2
          </div>
          <div>
            <h4 className="font-bold text-stone-900">Método Margem de Lucro (% sobre a Venda)</h4>
            <p className="text-stone-600 text-[11px] mt-0.5 leading-relaxed">
              Fórmula: <code>Preço = Custo ÷ (1 - Margem/100)</code> (Ex: Custo R$ 5,00 com 40% de margem = R$ 5 ÷ 0,60 = R$ 8,33). Garante a rentabilidade líquida da empresa.
            </p>
          </div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-xs flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar produto por nome ou código..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500"
          />
        </div>

        <div className="w-full sm:w-56">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full px-3 py-2 text-xs sm:text-sm border border-stone-300 rounded-lg bg-white"
          >
            <option value="all">Todas as Categorias</option>
            {settings.productCategories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Pricing Matrix Table */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-stone-50 border-b border-stone-200 text-stone-600 font-semibold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="p-3.5">Produto / Ficha</th>
                <th className="p-3.5 text-right">Custo Unitário</th>
                <th className="p-3.5 text-right">Sugerido (Markup)</th>
                <th className="p-3.5 text-right">Sugerido (Margem)</th>
                <th className="p-3.5 text-right font-bold text-stone-900 bg-amber-50/50">
                  Preço Praticado (R$)
                </th>
                <th className="p-3.5 text-right">Lucro Unitário</th>
                <th className="p-3.5 text-center">Margem Real</th>
                <th className="p-3.5 text-center">Markup Real</th>
                <th className="p-3.5 text-center">Ações</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-stone-200">
              {items.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-stone-400">
                    Nenhum produto cadastrado para precificação.
                  </td>
                </tr>
              ) : (
                items.map(
                  ({
                    recipe,
                    cost,
                    currentPrice,
                    profit,
                    margin,
                    effectiveMarkup,
                    targetMargin,
                    isLowMargin,
                  }) => {
                    const isDirty = editedPrices[recipe.id] !== undefined;

                    return (
                      <tr key={recipe.id} className="hover:bg-stone-50 transition-colors">
                        {/* Product Name */}
                        <td className="p-3.5">
                          <div className="font-semibold text-stone-900">{recipe.name}</div>
                          <div className="text-[11px] text-stone-500 font-mono">
                            {recipe.code || 'S/ CÓD'} • {recipe.category}
                          </div>
                        </td>

                        {/* Unit Cost */}
                        <td className="p-3.5 text-right font-mono font-bold text-stone-900">
                          {formatCurrency(cost.costPerUnit)}
                        </td>

                        {/* Suggested Markup */}
                        <td className="p-3.5 text-right font-mono text-stone-600 text-xs">
                          {formatCurrency(cost.suggestedPriceMarkup)}
                          <span className="text-[10px] text-stone-400 block">
                            ({recipe.markup || settings.defaultMarkup}x)
                          </span>
                        </td>

                        {/* Suggested Margin */}
                        <td className="p-3.5 text-right font-mono text-stone-600 text-xs">
                          {formatCurrency(cost.suggestedPriceMargin)}
                          <span className="text-[10px] text-stone-400 block">
                            (meta {targetMargin}%)
                          </span>
                        </td>

                        {/* Practiced Price (Editable Input) */}
                        <td className="p-3.5 text-right bg-amber-50/30">
                          <div className="flex items-center justify-end gap-1.5">
                            <span className="text-xs text-stone-400 font-mono">R$</span>
                            <input
                              id={`input-price-${recipe.id}`}
                              type="number"
                              step="0.01"
                              min="0"
                              placeholder="0,00"
                              value={
                                editedPrices[recipe.id] !== undefined
                                  ? editedPrices[recipe.id]
                                  : recipe.practicedPrice ?? ''
                              }
                              onChange={(e) => handlePriceChange(recipe.id, e.target.value)}
                              className={`w-24 px-2 py-1 text-right text-xs sm:text-sm font-mono font-bold rounded-md border focus:ring-2 focus:ring-amber-500 ${
                                isDirty
                                  ? 'border-amber-500 bg-amber-50 text-amber-950'
                                  : 'border-stone-300 bg-white text-stone-900'
                              }`}
                            />
                          </div>
                        </td>

                        {/* Profit per Unit */}
                        <td className="p-3.5 text-right font-mono font-semibold text-emerald-800">
                          {currentPrice ? formatCurrency(profit) : '-'}
                        </td>

                        {/* Real Margin Badge */}
                        <td className="p-3.5 text-center font-mono">
                          {currentPrice ? (
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                                isLowMargin
                                  ? 'bg-amber-100 text-amber-900 border border-amber-200'
                                  : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              }`}
                            >
                              {isLowMargin && <AlertTriangle className="w-3 h-3 text-amber-600" />}
                              {formatPercentage(margin)}
                            </span>
                          ) : (
                            <span className="text-xs text-stone-400">Sem preço</span>
                          )}
                        </td>

                        {/* Effective Markup */}
                        <td className="p-3.5 text-center font-mono text-stone-700 font-semibold text-xs">
                          {currentPrice && cost.costPerUnit > 0
                            ? `${formatNumber(effectiveMarkup, 2)}x`
                            : '-'}
                        </td>

                        {/* Row Action */}
                        <td className="p-3.5 text-center">
                          {isDirty && (
                            <button
                              id={`btn-save-price-${recipe.id}`}
                              onClick={() => handleSavePrice(recipe.id)}
                              className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-md text-xs font-semibold shadow-2xs flex items-center gap-1 mx-auto transition-colors"
                            >
                              <Save className="w-3 h-3" />
                              <span>Salvar</span>
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  }
                )
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
