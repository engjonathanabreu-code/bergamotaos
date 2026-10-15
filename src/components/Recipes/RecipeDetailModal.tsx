import React, { useState } from 'react';
import {
  X,
  Printer,
  Copy,
  Scale,
  Edit2,
  Clock,
  Flame,
  ChefHat,
  Thermometer,
  ShieldCheck,
  AlertTriangle,
  FileSpreadsheet,
  Info,
  Layers,
} from 'lucide-react';
import { Recipe, Ingredient, SystemSettings, CalculatedIngredientCost } from '../../types';
import {
  formatCurrency,
  formatPercentage,
  formatNumber,
  UNIT_SHORT_LABELS,
} from '../../utils/conversions';
import { calculateRecipeCost } from '../../utils/pricing';
import { exportDataToExcel } from '../../utils/fileParser';
import { AuditCostModal } from './AuditCostModal';

interface RecipeDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  recipe: Recipe | null;
  ingredients: Ingredient[];
  settings: SystemSettings;
  onEdit: (recipe: Recipe) => void;
  onDuplicate: (recipe: Recipe) => void;
  onScale: (recipe: Recipe) => void;
}

export const RecipeDetailModal: React.FC<RecipeDetailModalProps> = ({
  isOpen,
  onClose,
  recipe,
  ingredients,
  settings,
  onEdit,
  onDuplicate,
  onScale,
}) => {
  const [viewMode, setViewMode] = useState<'management' | 'kitchen'>('management');
  const [auditCostItem, setAuditCostItem] = useState<CalculatedIngredientCost | null>(null);

  if (!isOpen || !recipe) return null;

  const ingredientMap = new Map<string, Ingredient>(ingredients.map((i) => [i.id, i]));
  const calculatedCost = calculateRecipeCost(recipe, ingredientMap, settings);

  const handlePrint = () => {
    window.print();
  };

  const handleExportExcel = () => {
    const exportData = calculatedCost.ingredientsBreakdown.map((item) => ({
      'Produto': recipe.name,
      'Código': recipe.code,
      'Ingrediente': item.ingredientName,
      'Marca': item.brand || '',
      'Quantidade Usada': item.quantity,
      'Unidade': item.unit,
      'Preço Embalagem (R$)': item.packagePrice,
      'Embalagem Compra': `${item.packageQuantity} ${item.packageUnit}`,
      'Custo na Receita (R$)': item.calculatedCost,
      '% Custo Ingredientes': item.costPercentageOfTotal.toFixed(1) + '%',
    }));

    exportDataToExcel(`ficha_tecnica_${recipe.code || 'produto'}`, 'Ficha Técnica', exportData);
  };

  return (
    <div
      id="recipe-detail-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs overflow-y-auto"
    >
      <div
        id="recipe-detail-modal-container"
        className="bg-white rounded-2xl border border-stone-200 shadow-2xl max-w-4xl w-full overflow-hidden my-8 flex flex-col max-h-[92vh]"
      >
        {/* Header */}
        <div className="px-6 py-4 bg-stone-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-600 flex items-center justify-center text-white font-bold text-sm">
              <ChefHat className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base leading-tight">{recipe.name}</h3>
                {recipe.code && (
                  <span className="text-xs px-2 py-0.5 rounded bg-stone-800 text-amber-300 font-mono">
                    {recipe.code}
                  </span>
                )}
              </div>
              <p className="text-xs text-stone-400">
                Categoria: {recipe.category} • Rendimento: {recipe.yieldAmount} {recipe.yieldUnit}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="text-stone-400 hover:text-white p-1 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Toolbar & View Toggle */}
        <div className="px-6 py-3 bg-stone-50 border-b border-stone-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
          {/* View Mode Toggle */}
          <div className="flex items-center p-1 bg-stone-200/80 rounded-lg text-xs font-semibold">
            <button
              id="btn-mode-management"
              onClick={() => setViewMode('management')}
              className={`px-3 py-1.5 rounded-md transition-all ${
                viewMode === 'management'
                  ? 'bg-white text-stone-900 shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              Visão Gestão & Custos
            </button>
            <button
              id="btn-mode-kitchen"
              onClick={() => setViewMode('kitchen')}
              className={`px-3 py-1.5 rounded-md transition-all ${
                viewMode === 'kitchen'
                  ? 'bg-white text-stone-900 shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              Visão Cozinha / Produção
            </button>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => onScale(recipe)}
              className="px-3 py-1.5 bg-white border border-stone-300 hover:bg-stone-100 text-stone-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <Scale className="w-3.5 h-3.5 text-stone-500" />
              <span>Escalar</span>
            </button>

            <button
              onClick={() => onDuplicate(recipe)}
              className="px-3 py-1.5 bg-white border border-stone-300 hover:bg-stone-100 text-stone-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <Copy className="w-3.5 h-3.5 text-stone-500" />
              <span>Duplicar</span>
            </button>

            <button
              onClick={handleExportExcel}
              className="px-3 py-1.5 bg-white border border-stone-300 hover:bg-stone-100 text-stone-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-stone-500" />
              <span>Excel</span>
            </button>

            <button
              onClick={handlePrint}
              className="px-3 py-1.5 bg-white border border-stone-300 hover:bg-stone-100 text-stone-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <Printer className="w-3.5 h-3.5 text-stone-500" />
              <span>Imprimir</span>
            </button>

            <button
              onClick={() => onEdit(recipe)}
              className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors"
            >
              <Edit2 className="w-3.5 h-3.5" />
              <span>Editar</span>
            </button>
          </div>
        </div>

        {/* Modal Printable Sheet Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 printable-content">
          {/* Incomplete Warning if any ingredient lacks price */}
          {calculatedCost.isIncomplete && viewMode === 'management' && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs flex items-center gap-2 font-medium">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                Atenção: Esta ficha técnica possui {calculatedCost.missingPriceIngredientsCount} ingrediente(s) sem preço cadastrado no banco central. O custo calculado pode estar incompleto.
              </span>
            </div>
          )}

          {/* Key Facts Pills */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 bg-stone-50 border border-stone-200 rounded-xl">
              <span className="text-[11px] text-stone-500 font-medium block">Rendimento Lote</span>
              <span className="text-sm font-bold text-stone-900">
                {recipe.yieldAmount} {recipe.yieldUnit || 'unidades'}
              </span>
            </div>

            <div className="p-3 bg-stone-50 border border-stone-200 rounded-xl">
              <span className="text-[11px] text-stone-500 font-medium block">Tempo de Preparo</span>
              <span className="text-sm font-bold text-stone-900 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-stone-400" />
                {recipe.prepTimeMinutes ? `${recipe.prepTimeMinutes} min` : 'Não informado'}
              </span>
            </div>

            <div className="p-3 bg-stone-50 border border-stone-200 rounded-xl">
              <span className="text-[11px] text-stone-500 font-medium block">Forno / Temperatura</span>
              <span className="text-sm font-bold text-stone-900 flex items-center gap-1">
                <Flame className="w-3.5 h-3.5 text-stone-400" />
                {recipe.ovenTimeMinutes
                  ? `${recipe.ovenTimeMinutes} min (${recipe.ovenTemperatureCelsius || 180}°C)`
                  : 'N/A'}
              </span>
            </div>

            <div className="p-3 bg-stone-50 border border-stone-200 rounded-xl">
              <span className="text-[11px] text-stone-500 font-medium block">Validade Indicada</span>
              <span className="text-sm font-bold text-stone-900">
                {recipe.shelfLifeDays ? `${recipe.shelfLifeDays} dias` : 'Ver conservação'}
              </span>
            </div>
          </div>

          {/* Financial Summary (Only in Management Mode) */}
          {viewMode === 'management' && (
            <div className="bg-gradient-to-br from-stone-900 to-stone-800 text-white rounded-2xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-stone-700 pb-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-amber-400">
                  Resumo Financeiro & Formação de Preço
                </span>
                <span className="text-xs text-stone-300">
                  Baseado no catálogo central de insumos
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <span className="text-xs text-stone-400 block">Custo Ingredientes:</span>
                  <span className="text-lg font-bold font-mono text-white">
                    {formatCurrency(calculatedCost.ingredientsCost)}
                  </span>
                </div>

                <div>
                  <span className="text-xs text-stone-400 block">Custo Total Lote:</span>
                  <span className="text-lg font-bold font-mono text-white">
                    {formatCurrency(calculatedCost.totalRecipeCost)}
                  </span>
                </div>

                <div>
                  <span className="text-xs text-stone-400 block">Custo por Unidade:</span>
                  <span className="text-xl font-bold font-mono text-amber-400">
                    {formatCurrency(calculatedCost.costPerUnit)}
                  </span>
                </div>

                <div>
                  <span className="text-xs text-stone-400 block">
                    Preço Praticado (por {recipe.yieldUnit || 'unidade'}):
                  </span>
                  <span className="text-xl font-bold font-mono text-emerald-400">
                    {recipe.practicedPrice
                      ? formatCurrency(recipe.practicedPrice)
                      : 'Não definido'}
                  </span>
                </div>
              </div>

              <div className="pt-2 border-t border-stone-700/60 flex flex-wrap items-center justify-between text-xs gap-3">
                <div className="flex items-center gap-4 text-stone-300">
                  <span>
                    Margem Real: <strong className="text-emerald-400">{formatPercentage(calculatedCost.realMarginPercentage)}</strong>
                  </span>
                  <span>
                    Markup Real: <strong className="text-white">{formatNumber(calculatedCost.realMarkup, 2)}x</strong>
                  </span>
                  <span>
                    Lucro Unitário: <strong className="text-emerald-400">{formatCurrency(calculatedCost.profitPerUnit)}</strong>
                  </span>
                </div>

                <div className="text-stone-400 text-[11px]">
                  Sugerido (Markup {recipe.markup || settings.defaultMarkup}x): {formatCurrency(calculatedCost.suggestedPriceMarkup)}
                </div>
              </div>
            </div>
          )}

          {/* Ingredients Table */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-stone-800 flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-amber-600" />
                <span>Composição de Ingredientes ({recipe.ingredients.length} itens)</span>
              </h4>
              {viewMode === 'management' && (
                <span className="text-[11px] text-stone-500">
                  Clique no custo de qualquer ingrediente para abrir a auditoria passo a passo
                </span>
              )}
            </div>

            <div className="border border-stone-200 rounded-xl overflow-hidden shadow-2xs">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-stone-50 border-b border-stone-200 text-stone-600 font-semibold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="p-3">Ingrediente</th>
                    <th className="p-3 text-right">Qtd. Utilizada</th>
                    {viewMode === 'management' && (
                      <>
                        <th className="p-3 text-right">Embalagem Compra</th>
                        <th className="p-3 text-right">Custo na Receita</th>
                        <th className="p-3 text-right">% do Custo</th>
                        <th className="p-3 text-center">Auditar</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-200">
                  {calculatedCost.ingredientsBreakdown.map((item, idx) => (
                    <tr key={idx} className="hover:bg-stone-50/80 transition-colors">
                      <td className="p-3">
                        <span className="font-semibold text-stone-900">{item.ingredientName}</span>
                        {item.brand && (
                          <span className="text-xs text-stone-500 block font-normal">
                            Marca: {item.brand}
                          </span>
                        )}
                      </td>

                      <td className="p-3 text-right font-mono font-medium text-stone-800">
                        {formatNumber(item.quantity)} {UNIT_SHORT_LABELS[item.unit] || item.unit}
                      </td>

                      {viewMode === 'management' && (
                        <>
                          <td className="p-3 text-right font-mono text-stone-600 text-xs">
                            {formatCurrency(item.packagePrice)} / {item.packageQuantity}{' '}
                            {UNIT_SHORT_LABELS[item.packageUnit] || item.packageUnit}
                          </td>

                          <td className="p-3 text-right font-mono font-bold text-stone-900">
                            {item.hasPrice ? (
                              formatCurrency(item.calculatedCost)
                            ) : (
                              <span className="text-rose-600 text-xs font-semibold">
                                Sem preço
                              </span>
                            )}
                          </td>

                          <td className="p-3 text-right font-mono text-stone-600 text-xs">
                            {formatPercentage(item.costPercentageOfTotal)}
                          </td>

                          <td className="p-3 text-center">
                            <button
                              onClick={() => setAuditCostItem(item)}
                              className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 rounded-md text-[11px] font-medium transition-colors"
                            >
                              Auditar
                            </button>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Instructions and Steps */}
          {recipe.instructions && (
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-stone-800">
                Modo de Preparo & Instruções Operacionais
              </h4>
              <div className="p-4 bg-stone-50 rounded-xl border border-stone-200 text-xs sm:text-sm text-stone-800 whitespace-pre-line leading-relaxed font-sans">
                {recipe.instructions}
              </div>
            </div>
          )}

          {/* Equipments, Storage, and Notes */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {recipe.equipment && recipe.equipment.length > 0 && (
              <div className="p-4 bg-stone-50 rounded-xl border border-stone-200 space-y-1">
                <span className="text-xs font-bold uppercase tracking-wider text-stone-700 block">
                  Equipamentos e Utensílios Necessários
                </span>
                <ul className="list-disc list-inside text-xs text-stone-700 space-y-0.5">
                  {recipe.equipment.map((eq, i) => (
                    <li key={i}>{eq}</li>
                  ))}
                </ul>
              </div>
            )}

            {recipe.storageConditions && (
              <div className="p-4 bg-stone-50 rounded-xl border border-stone-200 space-y-1">
                <span className="text-xs font-bold uppercase tracking-wider text-stone-700 block">
                  Condições de Armazenamento
                </span>
                <p className="text-xs text-stone-700">{recipe.storageConditions}</p>
              </div>
            )}
          </div>

          {recipe.notes && (
            <div className="p-4 bg-amber-50/60 rounded-xl border border-amber-200 space-y-1">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-900 flex items-center gap-1">
                <Info className="w-3.5 h-3.5 text-amber-700" />
                Observações Adicionais
              </span>
              <p className="text-xs text-stone-700">{recipe.notes}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-stone-50 border-t border-stone-200 flex items-center justify-between shrink-0">
          <span className="text-xs text-stone-500">
            Atualizado em: {new Date(recipe.updatedAt || recipe.createdAt).toLocaleDateString('pt-BR')}
          </span>

          <button
            onClick={onClose}
            className="px-5 py-2 text-xs font-semibold bg-stone-800 hover:bg-stone-900 text-white rounded-lg transition-colors"
          >
            Fechar Ficha
          </button>
        </div>
      </div>

      {/* Audit Cost Popover Modal */}
      <AuditCostModal
        isOpen={!!auditCostItem}
        onClose={() => setAuditCostItem(null)}
        costItem={auditCostItem}
      />
    </div>
  );
};
