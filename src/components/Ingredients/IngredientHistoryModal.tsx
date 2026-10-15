import React from 'react';
import { X, History, TrendingUp, TrendingDown, Clock, Calendar } from 'lucide-react';
import { Ingredient, PriceHistory } from '../../types';
import { formatCurrency, formatPercentage } from '../../utils/conversions';

interface IngredientHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  ingredient: Ingredient | null;
  history: PriceHistory[];
}

export const IngredientHistoryModal: React.FC<IngredientHistoryModalProps> = ({
  isOpen,
  onClose,
  ingredient,
  history,
}) => {
  if (!isOpen || !ingredient) return null;

  const ingredientHistory = history
    .filter((h) => h.ingredientId === ingredient.id)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div
      id="ingredient-history-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs"
    >
      <div
        id="ingredient-history-modal-container"
        className="bg-white rounded-2xl border border-stone-200 shadow-2xl max-w-lg w-full overflow-hidden"
      >
        {/* Header */}
        <div className="px-6 py-4 bg-stone-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <History className="w-5 h-5 text-amber-400" />
            <div>
              <h3 className="font-bold text-sm">Histórico de Preços</h3>
              <p className="text-xs text-stone-300">{ingredient.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-stone-400 hover:text-white p-1 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current Price Banner */}
        <div className="p-4 bg-stone-50 border-b border-stone-200 flex items-center justify-between">
          <div>
            <span className="text-xs text-stone-500 font-medium">Preço Atual Cadastrado:</span>
            <div className="text-lg font-bold text-stone-900">
              {formatCurrency(ingredient.purchasePrice)}
              <span className="text-xs font-normal text-stone-500 ml-1">
                / {ingredient.packageQuantity} {ingredient.packageUnit}
              </span>
            </div>
          </div>
          <span className="text-xs px-2.5 py-1 bg-stone-200 text-stone-800 rounded-md font-medium">
            {ingredient.category}
          </span>
        </div>

        {/* Timeline Content */}
        <div className="p-6 max-h-[60vh] overflow-y-auto space-y-4">
          {ingredientHistory.length === 0 ? (
            <div className="text-center py-8 text-stone-400 text-xs">
              <Clock className="w-8 h-8 mx-auto text-stone-300 mb-2" />
              <p>Nenhuma alteração histórica de preço registrada ainda para este insumo.</p>
              <p className="text-[11px] text-stone-400 mt-1">
                As alterações futuras serão registradas automaticamente.
              </p>
            </div>
          ) : (
            <div className="relative border-l-2 border-stone-200 ml-3 space-y-6 pl-4">
              {ingredientHistory.map((item) => {
                const isIncrease = item.newPrice > item.previousPrice;
                const formattedDate = new Date(item.date).toLocaleDateString('pt-BR', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                });

                return (
                  <div key={item.id} className="relative group">
                    {/* Circle marker */}
                    <div
                      className={`absolute -left-[23px] top-1 w-3.5 h-3.5 rounded-full border-2 bg-white ${
                        isIncrease ? 'border-rose-500' : 'border-emerald-500'
                      }`}
                    />

                    <div className="bg-stone-50 hover:bg-stone-100/80 p-3.5 rounded-xl border border-stone-200 transition-colors">
                      <div className="flex items-center justify-between text-xs">
                        <span className="flex items-center gap-1 text-stone-500 font-medium">
                          <Calendar className="w-3.5 h-3.5" />
                          {formattedDate}
                        </span>

                        <span
                          className={`flex items-center gap-1 font-bold text-xs px-2 py-0.5 rounded-full ${
                            isIncrease
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {isIncrease ? (
                            <TrendingUp className="w-3 h-3" />
                          ) : (
                            <TrendingDown className="w-3 h-3" />
                          )}
                          {isIncrease ? '+' : ''}
                          {item.changePercentage.toFixed(1)}%
                        </span>
                      </div>

                      <div className="mt-2 flex items-center gap-3 text-sm">
                        <span className="line-through text-stone-400">
                          {formatCurrency(item.previousPrice)}
                        </span>
                        <span className="text-stone-400">→</span>
                        <span className="font-bold text-stone-900">
                          {formatCurrency(item.newPrice)}
                        </span>
                      </div>

                      {item.reason && (
                        <p className="mt-2 text-xs text-stone-600 bg-white p-2 rounded-md border border-stone-200">
                          <strong>Motivo:</strong> {item.reason}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-stone-50 border-t border-stone-200 text-right">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold bg-stone-800 hover:bg-stone-900 text-white rounded-lg transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
