import React, { useState } from 'react';
import { X, Scale, Printer, Check, ArrowRight, Calculator } from 'lucide-react';
import { Recipe, Ingredient, SystemSettings } from '../../types';
import {
  formatCurrency,
  formatNumber,
  UNIT_SHORT_LABELS,
} from '../../utils/conversions';
import { calculateRecipeCost } from '../../utils/pricing';

interface RecipeScaleModalProps {
  isOpen: boolean;
  onClose: () => void;
  recipe: Recipe | null;
  ingredients: Ingredient[];
  settings: SystemSettings;
}

export const RecipeScaleModal: React.FC<RecipeScaleModalProps> = ({
  isOpen,
  onClose,
  recipe,
  ingredients,
  settings,
}) => {
  const [targetYield, setTargetYield] = useState<number>(
    recipe ? recipe.yieldAmount * 2 : 10
  );

  if (!isOpen || !recipe) return null;

  const ingredientMap = new Map<string, Ingredient>(ingredients.map((i) => [i.id, i]));
  const originalCost = calculateRecipeCost(recipe, ingredientMap, settings);

  const originalYield = recipe.yieldAmount > 0 ? recipe.yieldAmount : 1;
  const multiplierFactor = targetYield > 0 ? targetYield / originalYield : 1;

  // Scaled recipe copy
  const scaledRecipe: Recipe = {
    ...recipe,
    yieldAmount: targetYield,
    ingredients: recipe.ingredients.map((item) => ({
      ...item,
      quantity: item.quantity * multiplierFactor,
    })),
  };

  const scaledCost = calculateRecipeCost(scaledRecipe, ingredientMap, settings);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div
      id="recipe-scale-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs overflow-y-auto"
    >
      <div
        id="recipe-scale-modal-container"
        className="bg-white rounded-2xl border border-stone-200 shadow-2xl max-w-2xl w-full overflow-hidden my-8"
      >
        {/* Header */}
        <div className="px-6 py-4 bg-stone-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Scale className="w-5 h-5 text-amber-400" />
            <div>
              <h3 className="font-bold text-sm">Escala de Produção de Receita</h3>
              <p className="text-xs text-stone-300">{recipe.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-stone-400 hover:text-white p-1 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scaling Controls */}
        <div className="p-6 space-y-5">
          <div className="p-4 bg-stone-50 border border-stone-200 rounded-xl grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
            <div>
              <span className="text-xs text-stone-500 font-medium block">Rendimento Original:</span>
              <span className="text-base font-bold text-stone-900">
                {originalYield} {recipe.yieldUnit || 'unidades'}
              </span>
            </div>

            <div>
              <label className="text-xs font-semibold text-stone-700 block mb-1">
                Desejo Produzir:
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="input-target-yield"
                  type="number"
                  min="0.1"
                  step="any"
                  value={targetYield || ''}
                  onChange={(e) => setTargetYield(parseFloat(e.target.value) || 0)}
                  className="w-24 px-3 py-1.5 text-sm font-bold font-mono border border-amber-400 rounded-lg focus:ring-2 focus:ring-amber-500 bg-white"
                />
                <span className="text-xs font-medium text-stone-700">
                  {recipe.yieldUnit || 'unidades'}
                </span>
              </div>
            </div>

            <div className="text-right">
              <span className="text-xs text-stone-500 font-medium block">Fator Multiplicador:</span>
              <span className="text-base font-bold font-mono text-amber-600">
                {formatNumber(multiplierFactor, 2)}x
              </span>
            </div>
          </div>

          {/* Scaled Ingredients Table */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-stone-700">
              Ingredientes Ajustados para {targetYield} {recipe.yieldUnit || 'unidades'}
            </h4>

            <div className="border border-stone-200 rounded-xl overflow-hidden max-h-64 overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-stone-100 text-stone-700 sticky top-0">
                  <tr>
                    <th className="p-2.5">Ingrediente</th>
                    <th className="p-2.5 text-right">Qtd. Original</th>
                    <th className="p-2.5 text-center">Fator</th>
                    <th className="p-2.5 text-right font-bold text-stone-900 bg-amber-50/70">
                      Qtd. Ajustada
                    </th>
                    <th className="p-2.5 text-right">Custo Estimado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {recipe.ingredients.map((item, idx) => {
                    const ing = ingredientMap.get(item.ingredientId);
                    const originalQty = item.quantity;
                    const scaledQty = originalQty * multiplierFactor;
                    const scaledItemCost = (scaledCost.ingredientsBreakdown[idx]?.calculatedCost) || 0;

                    return (
                      <tr key={item.id || idx} className="hover:bg-stone-50">
                        <td className="p-2.5 font-medium text-stone-900">
                          {ing?.name || 'Insumo não identificado'}
                        </td>
                        <td className="p-2.5 text-right text-stone-500 font-mono">
                          {formatNumber(originalQty)} {UNIT_SHORT_LABELS[item.unit] || item.unit}
                        </td>
                        <td className="p-2.5 text-center text-stone-400 font-mono text-[11px]">
                          {formatNumber(multiplierFactor, 2)}x
                        </td>
                        <td className="p-2.5 text-right font-bold font-mono text-amber-950 bg-amber-50/50">
                          {formatNumber(scaledQty, 2)} {UNIT_SHORT_LABELS[item.unit] || item.unit}
                        </td>
                        <td className="p-2.5 text-right font-mono text-stone-700">
                          {formatCurrency(scaledItemCost)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Cost Comparison Summary */}
          <div className="grid grid-cols-2 gap-3 p-4 bg-stone-50 rounded-xl border border-stone-200 text-xs">
            <div>
              <span className="text-stone-500 block">Custo Total do Lote Escalado:</span>
              <span className="text-lg font-bold font-mono text-stone-900">
                {formatCurrency(scaledCost.totalRecipeCost)}
              </span>
            </div>
            <div className="text-right">
              <span className="text-stone-500 block">Custo por Unidade:</span>
              <span className="text-lg font-bold font-mono text-amber-600">
                {formatCurrency(scaledCost.costPerUnit)}
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-stone-50 border-t border-stone-200 flex items-center justify-between">
          <button
            onClick={handlePrint}
            className="px-3.5 py-2 text-xs font-semibold text-stone-700 bg-white border border-stone-300 hover:bg-stone-100 rounded-lg flex items-center gap-1.5 transition-colors"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Imprimir Ordem de Produção</span>
          </button>

          <button
            onClick={onClose}
            className="px-5 py-2 text-xs font-semibold bg-stone-800 hover:bg-stone-900 text-white rounded-lg transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
