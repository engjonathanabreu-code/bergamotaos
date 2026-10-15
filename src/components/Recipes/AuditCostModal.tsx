import React from 'react';
import { X, Calculator, ArrowRight, ShieldCheck, ShieldAlert, AlertCircle } from 'lucide-react';
import { CalculatedIngredientCost } from '../../types';
import {
  formatCurrency,
  formatPrecisionCurrency,
  formatPercentage,
  UNIT_SHORT_LABELS,
} from '../../utils/conversions';

interface AuditCostModalProps {
  isOpen: boolean;
  onClose: () => void;
  costItem: CalculatedIngredientCost | null;
}

export const AuditCostModal: React.FC<AuditCostModalProps> = ({
  isOpen,
  onClose,
  costItem,
}) => {
  if (!isOpen || !costItem) return null;

  const failed = !costItem.hasPrice;

  return (
    <div
      id="audit-cost-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs"
    >
      <div
        id="audit-cost-modal-container"
        className="bg-white rounded-2xl border border-stone-200 shadow-2xl max-w-lg w-full overflow-hidden"
      >
        {/* Header */}
        <div className={`px-6 py-4 text-white flex items-center justify-between ${failed ? 'bg-rose-950' : 'bg-stone-900'}`}>
          <div className="flex items-center gap-2">
            <Calculator className={`w-5 h-5 ${failed ? 'text-rose-400' : 'text-amber-400'}`} />
            <div>
              <h3 className="font-bold text-sm">Auditoria Transparente de Custos</h3>
              <p className="text-xs text-stone-300">
                {failed ? 'Este custo NÃO pôde ser calculado' : 'Como este valor foi calculado'}
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

        {/* Content */}
        <div className="p-6 space-y-4">
          <div className="border-b border-stone-200 pb-3">
            <h4 className="font-bold text-base text-stone-900">{costItem.ingredientName}</h4>
            {costItem.brand && (
              <p className="text-xs text-stone-500">Marca: {costItem.brand}</p>
            )}
          </div>

          {failed ? (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl space-y-2">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span className="text-xs font-bold text-rose-900">
                  Motivo: {costItem.conversionFormula}
                </span>
              </div>
              {costItem.error && (
                <p className="text-[11px] text-rose-800 leading-relaxed pl-6">{costItem.error}</p>
              )}
              <p className="text-[11px] text-rose-800 leading-relaxed pl-6">
                Este ingrediente entra na receita com custo R$ 0,00 até o problema ser corrigido —
                o custo total da ficha está subestimado enquanto isso não for resolvido.
              </p>
            </div>
          ) : (
            <>
              {/* Breakdown Steps */}
              <div className="bg-stone-50 rounded-xl p-4 border border-stone-200 space-y-3 text-xs">
                <div className="flex justify-between items-center py-1 border-b border-stone-200/60">
                  <span className="text-stone-600">1. Preço de Compra da Embalagem:</span>
                  <span className="font-bold font-mono text-stone-900">
                    {formatCurrency(costItem.packagePrice)}
                  </span>
                </div>

                <div className="flex justify-between items-center py-1 border-b border-stone-200/60">
                  <span className="text-stone-600">2. Quantidade da Embalagem:</span>
                  <span className="font-bold font-mono text-stone-900">
                    {costItem.packageQuantity} {UNIT_SHORT_LABELS[costItem.packageUnit] || costItem.packageUnit}
                  </span>
                </div>

                <div className="flex justify-between items-center py-1 border-b border-stone-200/60">
                  <span className="text-stone-600">3. Preço por Unidade Base:</span>
                  <span className="font-bold font-mono text-amber-900">
                    {formatPrecisionCurrency(costItem.costPerBaseUnit, 4)} / {costItem.baseUnitLabel}
                  </span>
                </div>

                <div className="flex justify-between items-center py-1 border-b border-stone-200/60">
                  <span className="text-stone-600">4. Quantidade Utilizada na Receita:</span>
                  <span className="font-bold font-mono text-stone-900">
                    {costItem.quantity} {UNIT_SHORT_LABELS[costItem.unit] || costItem.unit}
                  </span>
                </div>

                <div className="flex justify-between items-center py-1 border-b border-stone-200/60">
                  <span className="text-stone-600">5. Participação no Custo Total:</span>
                  <span className="font-bold font-mono text-stone-900">
                    {formatPercentage(costItem.costPercentageOfTotal)} dos ingredientes
                  </span>
                </div>
              </div>

              {/* Mathematical Formula */}
              <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-xl space-y-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-amber-900 block">
                  Fórmula Aplicada
                </span>
                <p className="font-mono text-xs text-amber-950 break-words leading-relaxed font-semibold">
                  {costItem.conversionFormula}
                </p>
              </div>

              {/* Final Result Card */}
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-600" />
                  <div>
                    <span className="text-xs font-semibold text-emerald-950 block">
                      Custo Proporcional na Receita:
                    </span>
                    <span className="text-[11px] text-emerald-800">
                      Cálculo sem arredondamento intermediário
                    </span>
                  </div>
                </div>
                <div className="text-xl font-bold font-mono text-emerald-950">
                  {formatCurrency(costItem.calculatedCost)}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-stone-50 border-t border-stone-200 text-right">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold bg-stone-800 hover:bg-stone-900 text-white rounded-lg transition-colors"
          >
            Fechar Auditoria
          </button>
        </div>
      </div>
    </div>
  );
};
