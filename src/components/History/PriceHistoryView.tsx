import React, { useState } from 'react';
import {
  History,
  TrendingUp,
  TrendingDown,
  Calendar,
  Filter,
  Search,
  Download,
  Clock,
  Layers,
  ArrowRight,
} from 'lucide-react';
import { PriceHistory, Ingredient, Recipe } from '../../types';
import { formatCurrency, formatPercentage } from '../../utils/conversions';
import { exportDataToExcel } from '../../utils/fileParser';

interface PriceHistoryViewProps {
  history: PriceHistory[];
  ingredients: Ingredient[];
  recipes: Recipe[];
}

export const PriceHistoryView: React.FC<PriceHistoryViewProps> = ({
  history,
  ingredients,
  recipes,
}) => {
  const [selectedIngredientId, setSelectedIngredientId] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const ingredientMap = new Map<string, Ingredient>(ingredients.map((i) => [i.id, i]));

  const filteredHistory = history
    .filter((item) => {
      const ing = ingredientMap.get(item.ingredientId);
      const ingName = ing?.name || '';
      const matchesSearch =
        ingName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.reason && item.reason.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesIngredient =
        selectedIngredientId === 'all' || item.ingredientId === selectedIngredientId;

      return matchesSearch && matchesIngredient;
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const handleExportHistory = () => {
    const exportData = filteredHistory.map((h) => {
      const ing = ingredientMap.get(h.ingredientId);
      return {
        'Data': new Date(h.date).toLocaleDateString('pt-BR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }),
        'Insumo': ing?.name || 'Desconhecido',
        'Preço Anterior (R$)': h.previousPrice,
        'Novo Preço (R$)': h.newPrice,
        'Variação (%)': `${h.changePercentage >= 0 ? '+' : ''}${h.changePercentage.toFixed(1)}%`,
        'Motivo': h.reason || '',
      };
    });

    exportDataToExcel('historico_precos_insumos', 'Histórico', exportData);
  };

  return (
    <div id="price-history-view-container" className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-stone-900 flex items-center gap-2">
            <History className="w-5 h-5 text-amber-600" />
            Histórico & Evolução de Preços
          </h2>
          <p className="text-xs text-stone-500 mt-0.5">
            Acompanhe o histórico de reajustes de insumos e o impacto gerado no custo dos produtos.
          </p>
        </div>

        <button
          onClick={handleExportHistory}
          className="px-3.5 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg text-xs font-semibold border border-stone-200 flex items-center gap-1.5 transition-colors self-start sm:self-auto"
        >
          <Download className="w-3.5 h-3.5 text-stone-500" />
          <span>Exportar Histórico</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-xs flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por insumo ou motivo do reajuste..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-4 h-4 text-stone-400 shrink-0" />
          <select
            value={selectedIngredientId}
            onChange={(e) => setSelectedIngredientId(e.target.value)}
            className="w-full sm:w-64 px-3 py-2 text-xs sm:text-sm border border-stone-300 rounded-lg bg-white"
          >
            <option value="all">Todos os Insumos ({ingredients.length})</option>
            {ingredients.map((ing) => (
              <option key={ing.id} value={ing.id}>
                {ing.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Timeline List */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-xs p-6">
        {filteredHistory.length === 0 ? (
          <div className="text-center py-12 text-stone-400 text-xs">
            <Clock className="w-12 h-12 mx-auto text-stone-300 mb-3" />
            <p className="font-semibold text-stone-600 text-sm">
              Nenhuma alteração de preço registrada no período.
            </p>
            <p className="mt-1">
              Ao editar o preço de qualquer insumo no cadastro central, o histórico é registrado aqui automaticamente.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredHistory.map((item) => {
              const ing = ingredientMap.get(item.ingredientId);
              const isIncrease = item.newPrice > item.previousPrice;
              const formattedDate = new Date(item.date).toLocaleDateString('pt-BR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              });

              // Affected recipes
              const affectedRecipes = recipes.filter((r) =>
                r.ingredients.some((ri) => ri.ingredientId === item.ingredientId)
              );

              return (
                <div
                  key={item.id}
                  className="p-4 rounded-xl bg-stone-50 hover:bg-stone-100/80 border border-stone-200 transition-all space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 ${
                          isIncrease ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'
                        }`}
                      >
                        {isIncrease ? (
                          <TrendingUp className="w-4 h-4" />
                        ) : (
                          <TrendingDown className="w-4 h-4" />
                        )}
                      </div>

                      <div>
                        <h4 className="font-bold text-sm text-stone-900">
                          {ing?.name || 'Insumo Excluído'}
                        </h4>
                        <span className="text-xs text-stone-500 flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formattedDate}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-right">
                      <div>
                        <span className="text-[11px] text-stone-400 block">Evolução do Preço</span>
                        <div className="flex items-center gap-2 font-mono text-sm font-semibold">
                          <span className="line-through text-stone-400">
                            {formatCurrency(item.previousPrice)}
                          </span>
                          <span className="text-stone-400">→</span>
                          <span className="text-stone-900 font-bold">
                            {formatCurrency(item.newPrice)}
                          </span>
                        </div>
                      </div>

                      <span
                        className={`px-2.5 py-1 rounded-full text-xs font-bold font-mono ${
                          isIncrease
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {isIncrease ? '+' : ''}
                        {item.changePercentage.toFixed(1)}%
                      </span>
                    </div>
                  </div>

                  {item.reason && (
                    <div className="text-xs text-stone-600 bg-white p-2.5 rounded-lg border border-stone-200">
                      <strong>Motivo:</strong> {item.reason}
                    </div>
                  )}

                  {affectedRecipes.length > 0 && (
                    <div className="pt-2 border-t border-stone-200/60 flex items-center gap-2 text-xs text-stone-500">
                      <Layers className="w-3.5 h-3.5 text-stone-400" />
                      <span>
                        Fichas técnicas recalculadas ({affectedRecipes.length}):{' '}
                        <strong className="text-stone-700">
                          {affectedRecipes.map((r) => r.name).join(', ')}
                        </strong>
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
