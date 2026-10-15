import React, { useState } from 'react';
import { X, RefreshCw, AlertTriangle, Check, TrendingUp } from 'lucide-react';
import { Ingredient, Recipe, SystemSettings } from '../../types';
import { formatCurrency } from '../../utils/conversions';

interface BatchPriceUpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
  ingredients: Ingredient[];
  recipes: Recipe[];
  settings: SystemSettings;
  onApplyBatchUpdate: (
    updatedIngredients: { id: string; newPrice: number }[],
    reason: string
  ) => void;
}

export const BatchPriceUpdateModal: React.FC<BatchPriceUpdateModalProps> = ({
  isOpen,
  onClose,
  ingredients,
  recipes,
  settings,
  onApplyBatchUpdate,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [adjustmentPercentage, setAdjustmentPercentage] = useState<number>(5);
  const [reason, setReason] = useState<string>('Reajuste geral de tabela');

  if (!isOpen) return null;

  const targetIngredients = ingredients.filter(
    (i) => selectedCategory === 'all' || i.category === selectedCategory
  );

  const previewUpdates = targetIngredients.map((i) => {
    const factor = 1 + adjustmentPercentage / 100;
    const newPrice = Math.round(i.purchasePrice * factor * 100) / 100;
    return {
      id: i.id,
      name: i.name,
      category: i.category,
      currentPrice: i.purchasePrice,
      newPrice,
      difference: newPrice - i.purchasePrice,
    };
  });

  const handleApply = () => {
    onApplyBatchUpdate(
      previewUpdates.map((p) => ({ id: p.id, newPrice: p.newPrice })),
      reason
    );
    onClose();
  };

  return (
    <div
      id="batch-update-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs"
    >
      <div
        id="batch-update-modal-container"
        className="bg-white rounded-2xl border border-stone-200 shadow-2xl max-w-2xl w-full overflow-hidden"
      >
        {/* Header */}
        <div className="px-6 py-4 bg-stone-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <RefreshCw className="w-5 h-5 text-amber-400" />
            <div>
              <h3 className="font-bold text-sm">Atualização de Preços em Massa</h3>
              <p className="text-xs text-stone-300">
                Ajuste percentual com recálculo automático de todas as fichas técnicas.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-stone-400 hover:text-white p-1 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Controls */}
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Filtrar por Categoria
              </label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-stone-300 rounded-lg bg-white"
              >
                <option value="all">Todas as Categorias ({ingredients.length} insumos)</option>
                {settings.ingredientCategories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat} ({ingredients.filter((i) => i.category === cat).length})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Reajuste Percentual (%)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="0.5"
                  value={adjustmentPercentage}
                  onChange={(e) => setAdjustmentPercentage(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 text-sm border border-stone-300 rounded-lg font-mono font-bold"
                />
                <span className="text-sm font-semibold text-stone-600">%</span>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Motivo do Reajuste (para o histórico)
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex: Dissídio, alta inflacionária de insumos lácteos"
              className="w-full px-3 py-2 text-sm border border-stone-300 rounded-lg"
            />
          </div>

          {/* Preview Table */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-stone-700">
              <span>Prévia dos Novos Preços ({previewUpdates.length} insumos selecionados)</span>
              <span className="text-amber-800">
                {adjustmentPercentage > 0 ? `+${adjustmentPercentage}%` : `${adjustmentPercentage}%`}
              </span>
            </div>

            <div className="border border-stone-200 rounded-xl overflow-hidden max-h-56 overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-stone-100 text-stone-600 sticky top-0">
                  <tr>
                    <th className="p-2.5">Insumo</th>
                    <th className="p-2.5">Categoria</th>
                    <th className="p-2.5 text-right">Preço Atual</th>
                    <th className="p-2.5 text-right">Novo Preço</th>
                    <th className="p-2.5 text-right">Diferença</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {previewUpdates.map((item) => (
                    <tr key={item.id} className="hover:bg-stone-50">
                      <td className="p-2.5 font-medium text-stone-900">{item.name}</td>
                      <td className="p-2.5 text-stone-500">{item.category}</td>
                      <td className="p-2.5 text-right text-stone-500 font-mono">
                        {formatCurrency(item.currentPrice)}
                      </td>
                      <td className="p-2.5 text-right font-bold text-stone-900 font-mono">
                        {formatCurrency(item.newPrice)}
                      </td>
                      <td
                        className={`p-2.5 text-right font-semibold font-mono ${
                          item.difference >= 0 ? 'text-rose-600' : 'text-emerald-600'
                        }`}
                      >
                        {item.difference >= 0 ? '+' : ''}
                        {formatCurrency(item.difference)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2 text-xs text-amber-900">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <p>
              Ao confirmar, todas as fichas técnicas de receitas que utilizam esses insumos serão automaticamente recalculadas.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-stone-50 border-t border-stone-200 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-stone-600 hover:bg-stone-100 rounded-lg transition-colors"
          >
            Cancelar
          </button>
          <button
            id="btn-confirm-batch-update"
            onClick={handleApply}
            disabled={previewUpdates.length === 0}
            className="flex items-center gap-1.5 px-5 py-2 text-xs font-semibold bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-lg transition-colors"
          >
            <Check className="w-4 h-4" />
            <span>Aplicar Reajuste em {previewUpdates.length} Insumos</span>
          </button>
        </div>
      </div>
    </div>
  );
};
