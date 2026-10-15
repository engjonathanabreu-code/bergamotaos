import React, { useState } from 'react';
import {
  FileText,
  Printer,
  Download,
  PieChart,
  TrendingUp,
  Award,
  Layers,
  FileSpreadsheet,
  Cake,
  Boxes,
} from 'lucide-react';
import { Recipe, Ingredient, SystemSettings } from '../../types';
import {
  formatCurrency,
  formatPercentage,
  formatNumber,
} from '../../utils/conversions';
import { calculateRecipeCost } from '../../utils/pricing';
import { exportDataToExcel } from '../../utils/fileParser';

interface ReportsViewProps {
  recipes: Recipe[];
  ingredients: Ingredient[];
  settings: SystemSettings;
}

export const ReportsView: React.FC<ReportsViewProps> = ({
  recipes,
  ingredients,
  settings,
}) => {
  const [reportType, setReportType] = useState<'costs' | 'margins' | 'ingredientsABC'>('costs');

  const ingredientMap = new Map<string, Ingredient>(ingredients.map((i) => [i.id, i]));

  const calculatedRecipes = recipes.map((r) => ({
    recipe: r,
    cost: calculateRecipeCost(r, ingredientMap, settings),
  }));

  // Ingredient usage frequency / dependence
  const ingredientUsageMap = new Map<string, { name: string; count: number; category: string }>();
  recipes.forEach((r) => {
    r.ingredients.forEach((ing) => {
      const existing = ingredientUsageMap.get(ing.ingredientId);
      const ingredientObj = ingredientMap.get(ing.ingredientId);
      const name = ingredientObj?.name || 'Insumo não identificado';
      const category = ingredientObj?.category || 'Geral';

      if (existing) {
        existing.count += 1;
      } else {
        ingredientUsageMap.set(ing.ingredientId, { name, count: 1, category });
      }
    });
  });

  const ingredientUsageList = Array.from(ingredientUsageMap.values()).sort(
    (a, b) => b.count - a.count
  );

  const handlePrint = () => {
    window.print();
  };

  const handleExportExcel = () => {
    if (reportType === 'costs') {
      const data = calculatedRecipes.map(({ recipe, cost }) => ({
        'Código': recipe.code || '',
        'Produto': recipe.name,
        'Categoria': recipe.category,
        'Rendimento': `${recipe.yieldAmount} ${recipe.yieldUnit}`,
        'Custo Insumos (R$)': cost.ingredientsCost,
        'Custo Total Lote (R$)': cost.totalRecipeCost,
        'Custo Unitário (R$)': cost.costPerUnit,
      }));
      exportDataToExcel('relatorio_custos_produtos', 'Custos', data);
    } else if (reportType === 'margins') {
      const data = calculatedRecipes.map(({ recipe, cost }) => ({
        'Produto': recipe.name,
        'Custo Unitário (R$)': cost.costPerUnit,
        'Preço Praticado (R$)': recipe.practicedPrice || 'N/A',
        'Lucro Unitário (R$)': cost.profitPerUnit,
        'Margem Real (%)': `${cost.realMarginPercentage.toFixed(1)}%`,
        'Markup Real': `${cost.realMarkup.toFixed(2)}x`,
      }));
      exportDataToExcel('relatorio_margens_rentabilidade', 'Margens', data);
    } else {
      const data = ingredientUsageList.map((item) => ({
        'Insumo': item.name,
        'Categoria': item.category,
        'Presença em Fichas Técnicas': item.count,
        'Taxa de Uso': `${((item.count / (recipes.length || 1)) * 100).toFixed(1)}%`,
      }));
      exportDataToExcel('relatorio_curva_uso_insumos', 'Insumos', data);
    }
  };

  return (
    <div id="reports-view-container" className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-stone-900 flex items-center gap-2">
            <FileText className="w-5 h-5 text-amber-600" />
            Relatórios Financeiros & Operacionais
          </h2>
          <p className="text-xs text-stone-500 mt-0.5">
            Análises analíticas de custos, rentabilidade e dependência de insumos.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportExcel}
            className="px-3 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg text-xs font-semibold border border-stone-200 flex items-center gap-1.5 transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-stone-500" />
            <span>Exportar Excel</span>
          </button>

          <button
            onClick={handlePrint}
            className="px-3.5 py-2 bg-stone-900 hover:bg-stone-800 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Imprimir Relatório</span>
          </button>
        </div>
      </div>

      {/* Report Selector Tabs */}
      <div className="flex items-center p-1 bg-stone-200/80 rounded-xl max-w-lg text-xs font-semibold">
        <button
          onClick={() => setReportType('costs')}
          className={`flex-1 py-2 rounded-lg transition-all text-center ${
            reportType === 'costs'
              ? 'bg-white text-stone-900 shadow-xs'
              : 'text-stone-600 hover:text-stone-900'
          }`}
        >
          Custos dos Produtos
        </button>
        <button
          onClick={() => setReportType('margins')}
          className={`flex-1 py-2 rounded-lg transition-all text-center ${
            reportType === 'margins'
              ? 'bg-white text-stone-900 shadow-xs'
              : 'text-stone-600 hover:text-stone-900'
          }`}
        >
          Margens & Lucratividade
        </button>
        <button
          onClick={() => setReportType('ingredientsABC')}
          className={`flex-1 py-2 rounded-lg transition-all text-center ${
            reportType === 'ingredientsABC'
              ? 'bg-white text-stone-900 shadow-xs'
              : 'text-stone-600 hover:text-stone-900'
          }`}
        >
          Uso dos Insumos (Curva ABC)
        </button>
      </div>

      {/* Report Content */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-xs overflow-hidden printable-content">
        {reportType === 'costs' && (
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-stone-200 pb-3">
              <div>
                <h3 className="font-bold text-sm text-stone-900">
                  Relatório Sintético de Custos de Produção
                </h3>
                <p className="text-xs text-stone-500">
                  Total de {recipes.length} produtos apurados
                </p>
              </div>
            </div>

            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-stone-50 text-stone-600 font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="p-3">Produto</th>
                  <th className="p-3">Categoria</th>
                  <th className="p-3 text-center">Rendimento</th>
                  <th className="p-3 text-right">Custo Insumos</th>
                  <th className="p-3 text-right">Custo Total Lote</th>
                  <th className="p-3 text-right font-bold text-stone-900">Custo Unitário</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200">
                {calculatedRecipes.map(({ recipe, cost }) => (
                  <tr key={recipe.id} className="hover:bg-stone-50">
                    <td className="p-3 font-semibold text-stone-900">{recipe.name}</td>
                    <td className="p-3 text-stone-600">{recipe.category}</td>
                    <td className="p-3 text-center font-mono">
                      {recipe.yieldAmount} {recipe.yieldUnit}
                    </td>
                    <td className="p-3 text-right font-mono text-stone-600">
                      {formatCurrency(cost.ingredientsCost)}
                    </td>
                    <td className="p-3 text-right font-mono text-stone-800">
                      {formatCurrency(cost.totalRecipeCost)}
                    </td>
                    <td className="p-3 text-right font-mono font-bold text-amber-900">
                      {formatCurrency(cost.costPerUnit)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {reportType === 'margins' && (
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-stone-200 pb-3">
              <div>
                <h3 className="font-bold text-sm text-stone-900">
                  Relatório de Rentabilidade & Margens Reais
                </h3>
                <p className="text-xs text-stone-500">
                  Comparação do custo unitário com o preço praticado no mercado
                </p>
              </div>
            </div>

            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-stone-50 text-stone-600 font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="p-3">Produto</th>
                  <th className="p-3 text-right">Custo Unitário</th>
                  <th className="p-3 text-right">Preço de Venda</th>
                  <th className="p-3 text-right">Lucro Unitário</th>
                  <th className="p-3 text-center font-bold text-stone-900">Margem Real (%)</th>
                  <th className="p-3 text-center">Markup Real</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200">
                {calculatedRecipes.map(({ recipe, cost }) => (
                  <tr key={recipe.id} className="hover:bg-stone-50">
                    <td className="p-3 font-semibold text-stone-900">{recipe.name}</td>
                    <td className="p-3 text-right font-mono text-stone-700">
                      {formatCurrency(cost.costPerUnit)}
                    </td>
                    <td className="p-3 text-right font-mono font-bold text-emerald-800">
                      {recipe.practicedPrice ? formatCurrency(recipe.practicedPrice) : '-'}
                    </td>
                    <td className="p-3 text-right font-mono font-semibold text-stone-900">
                      {recipe.practicedPrice ? formatCurrency(cost.profitPerUnit) : '-'}
                    </td>
                    <td className="p-3 text-center font-mono">
                      {recipe.practicedPrice ? (
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                            cost.realMarginPercentage >=
                            (recipe.targetMarginPercentage || settings.defaultTargetMargin)
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-900'
                          }`}
                        >
                          {formatPercentage(cost.realMarginPercentage)}
                        </span>
                      ) : (
                        <span className="text-stone-400 text-xs">-</span>
                      )}
                    </td>
                    <td className="p-3 text-center font-mono text-stone-700 text-xs">
                      {recipe.practicedPrice ? `${formatNumber(cost.realMarkup, 2)}x` : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {reportType === 'ingredientsABC' && (
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-stone-200 pb-3">
              <div>
                <h3 className="font-bold text-sm text-stone-900">
                  Curva de Uso & Dependência de Insumos Centrais
                </h3>
                <p className="text-xs text-stone-500">
                  Identifique os insumos mais críticos presentes em múltiplas fichas técnicas
                </p>
              </div>
            </div>

            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-stone-50 text-stone-600 font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="p-3">Insumo</th>
                  <th className="p-3">Categoria</th>
                  <th className="p-3 text-center">Presença em Fichas</th>
                  <th className="p-3 text-right">Taxa de Cobertura</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200">
                {ingredientUsageList.map((item, idx) => {
                  const coveragePercent = (item.count / (recipes.length || 1)) * 100;
                  return (
                    <tr key={idx} className="hover:bg-stone-50">
                      <td className="p-3 font-semibold text-stone-900 flex items-center gap-2">
                        <span className="text-xs text-stone-400 font-mono">#{idx + 1}</span>
                        <span>{item.name}</span>
                      </td>
                      <td className="p-3 text-stone-600">{item.category}</td>
                      <td className="p-3 text-center font-bold font-mono text-stone-900">
                        {item.count} ficha(s)
                      </td>
                      <td className="p-3 text-right font-mono font-medium text-amber-900">
                        {formatPercentage(coveragePercent)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
