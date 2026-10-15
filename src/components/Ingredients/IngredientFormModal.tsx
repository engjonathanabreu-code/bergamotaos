import React, { useState, useEffect } from 'react';
import { X, Check, Calculator, AlertCircle, TrendingUp } from 'lucide-react';
import { Ingredient, UnitType, SystemSettings } from '../../types';
import {
  UNIT_LABELS,
  UNIT_SHORT_LABELS,
  getBaseUnit,
  formatCurrency,
  formatPrecisionCurrency,
} from '../../utils/conversions';

interface IngredientFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (ingredient: Omit<Ingredient, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }, priceChangeReason?: string) => void;
  initialIngredient?: Ingredient | null;
  settings: SystemSettings;
}

export const IngredientFormModal: React.FC<IngredientFormModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialIngredient,
  settings,
}) => {
  const [name, setName] = useState('');
  const [category, setCategory] = useState(settings.ingredientCategories[0] || 'Geral');
  const [brand, setBrand] = useState('');
  const [packageQuantity, setPackageQuantity] = useState<number>(1);
  const [packageUnit, setPackageUnit] = useState<UnitType>('kg');
  const [densityGramsPerMl, setDensityGramsPerMl] = useState<number | undefined>(undefined);
  const [purchasePrice, setPurchasePrice] = useState<number>(0);
  const [supplier, setSupplier] = useState('');
  const [notes, setNotes] = useState('');
  const [active, setActive] = useState(true);
  const [priceChangeReason, setPriceChangeReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialIngredient) {
      setName(initialIngredient.name || '');
      setCategory(initialIngredient.category || settings.ingredientCategories[0] || 'Geral');
      setBrand(initialIngredient.brand || '');
      setPackageQuantity(initialIngredient.packageQuantity || 1);
      setPackageUnit(initialIngredient.packageUnit || 'kg');
      setDensityGramsPerMl(initialIngredient.densityGramsPerMl);
      setPurchasePrice(initialIngredient.purchasePrice || 0);
      setSupplier(initialIngredient.supplier || '');
      setNotes(initialIngredient.notes || '');
      setActive(initialIngredient.active ?? true);
      setPriceChangeReason('');
    } else {
      setName('');
      setCategory(settings.ingredientCategories[0] || 'Farinhas e Amidos');
      setBrand('');
      setPackageQuantity(1);
      setPackageUnit('kg');
      setDensityGramsPerMl(undefined);
      setPurchasePrice(0);
      setSupplier('');
      setNotes('');
      setActive(true);
      setPriceChangeReason('');
    }
    setError(null);
  }, [initialIngredient, isOpen, settings]);

  if (!isOpen) return null;

  // Real-time calculation preview
  const baseInfo = getBaseUnit(packageUnit);
  const totalBaseUnits = (packageQuantity || 1) * baseInfo.factor;
  const costPerBaseUnit = purchasePrice > 0 && totalBaseUnits > 0 ? purchasePrice / totalBaseUnits : 0;

  const isPriceChanged =
    initialIngredient &&
    initialIngredient.purchasePrice !== purchasePrice &&
    purchasePrice > 0 &&
    initialIngredient.purchasePrice > 0;

  const priceDeltaPercentage =
    isPriceChanged && initialIngredient
      ? ((purchasePrice - initialIngredient.purchasePrice) / initialIngredient.purchasePrice) * 100
      : 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('O nome do insumo é obrigatório.');
      return;
    }
    if (packageQuantity <= 0) {
      setError('A quantidade da embalagem deve ser maior que zero.');
      return;
    }
    if (purchasePrice < 0) {
      setError('O preço de compra não pode ser negativo.');
      return;
    }

    onSave(
      {
        ...(initialIngredient ? { id: initialIngredient.id } : {}),
        name: name.trim(),
        category,
        brand: brand.trim(),
        packageQuantity: Number(packageQuantity),
        packageUnit,
        densityGramsPerMl: densityGramsPerMl && densityGramsPerMl > 0 ? Number(densityGramsPerMl) : undefined,
        purchasePrice: Number(purchasePrice),
        supplier: supplier.trim(),
        notes: notes.trim(),
        active,
      },
      isPriceChanged ? priceChangeReason : undefined
    );
    onClose();
  };

  return (
    <div
      id="ingredient-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs overflow-y-auto"
    >
      <div
        id="ingredient-modal-container"
        className="bg-white rounded-2xl border border-stone-200 shadow-2xl max-w-xl w-full overflow-hidden my-8"
      >
        {/* Header */}
        <div className="px-6 py-4 bg-stone-900 text-white flex items-center justify-between">
          <div>
            <h3 className="font-bold text-base">
              {initialIngredient ? 'Editar Insumo' : 'Novo Insumo Central'}
            </h3>
            <p className="text-xs text-stone-300">
              O preço cadastrado aqui refletirá em todas as fichas técnicas.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-stone-400 hover:text-white p-1 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {error && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Nome e Marca */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Nome do Insumo *
              </label>
              <input
                id="input-ingredient-name"
                type="text"
                required
                placeholder="Ex: Farinha de arroz, Cacau em pó 50%"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-stone-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Marca / Fabricante
              </label>
              <input
                id="input-ingredient-brand"
                type="text"
                placeholder="Ex: Harald, Nestlé"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-stone-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
              />
            </div>
          </div>

          {/* Categoria e Fornecedor */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Categoria
              </label>
              <select
                id="select-ingredient-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-stone-300 rounded-lg bg-white focus:outline-hidden focus:ring-2 focus:ring-amber-500"
              >
                {settings.ingredientCategories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Fornecedor Principal
              </label>
              <input
                id="input-ingredient-supplier"
                type="text"
                placeholder="Ex: Atacadão, Distribuidora Silva"
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-stone-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>

          {/* Embalagem e Preço */}
          <div className="p-4 rounded-xl bg-stone-50 border border-stone-200 space-y-3">
            <div className="text-xs font-bold uppercase tracking-wider text-stone-600 flex items-center gap-1.5">
              <Calculator className="w-3.5 h-3.5 text-amber-600" />
              <span>Embalagem de Compra & Preço</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1">
                  Qtd. Embalagem *
                </label>
                <input
                  id="input-ingredient-pkg-qty"
                  type="number"
                  step="any"
                  min="0.001"
                  required
                  placeholder="Ex: 1, 500, 1000"
                  value={packageQuantity || ''}
                  onChange={(e) => setPackageQuantity(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 text-sm border border-stone-300 rounded-lg bg-white font-mono focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1">
                  Unidade da Embalagem *
                </label>
                <select
                  id="select-ingredient-pkg-unit"
                  value={packageUnit}
                  onChange={(e) => setPackageUnit(e.target.value as UnitType)}
                  className="w-full px-3 py-2 text-sm border border-stone-300 rounded-lg bg-white focus:ring-2 focus:ring-amber-500"
                >
                  {Object.entries(UNIT_LABELS).map(([unitKey, label]) => (
                    <option key={unitKey} value={unitKey}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1">
                  Preço Pago (R$) *
                </label>
                <input
                  id="input-ingredient-price"
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  placeholder="Ex: 10.50"
                  value={purchasePrice || ''}
                  onChange={(e) => setPurchasePrice(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 text-sm border border-stone-300 rounded-lg bg-white font-mono font-bold text-stone-900 focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>

            {(packageUnit === 'kg' || packageUnit === 'g' || packageUnit === 'ml' || packageUnit === 'L') && (
              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1">
                  Densidade (g/ml) — opcional
                </label>
                <input
                  id="input-ingredient-density"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Ex: 0.92 (óleo), 1.42 (mel). Deixe em branco = água (1g≈1ml)"
                  value={densityGramsPerMl ?? ''}
                  onChange={(e) =>
                    setDensityGramsPerMl(e.target.value ? parseFloat(e.target.value) : undefined)
                  }
                  className="w-full px-3 py-2 text-sm border border-stone-300 rounded-lg bg-white font-mono focus:ring-2 focus:ring-amber-500"
                />
                <p className="text-[11px] text-stone-500 mt-1">
                  Só importa se este insumo aparecer em receitas medido na outra dimensão (comprado
                  em {packageUnit}, usado em {packageUnit === 'kg' || packageUnit === 'g' ? 'ml/L' : 'g/kg'} na
                  ficha técnica). Sem preencher, o sistema assume a densidade da água.
                </p>
              </div>
            )}
            <div className="mt-2 p-3 bg-amber-50/80 border border-amber-200 rounded-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs">
              <div>
                <span className="text-amber-900 font-medium">Custo Unitário Base Calculado:</span>
                <p className="text-stone-600 text-[11px]">
                  {formatCurrency(purchasePrice)} ÷ {packageQuantity} {UNIT_SHORT_LABELS[packageUnit]}
                  {baseInfo.factor > 1 ? ` (${totalBaseUnits} ${baseInfo.baseLabel})` : ''}
                </p>
              </div>
              <div className="text-right">
                <span className="text-sm font-bold font-mono text-amber-950">
                  {formatPrecisionCurrency(costPerBaseUnit, 4)}
                </span>
                <span className="text-[11px] text-amber-800 font-medium">
                  {' '}
                  / {baseInfo.baseLabel}
                </span>
              </div>
            </div>
          </div>

          {/* Price Change Reason (if editing price) */}
          {isPriceChanged && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl space-y-2 text-xs">
              <div className="flex items-center gap-2 text-blue-900 font-semibold">
                <TrendingUp className="w-4 h-4" />
                <span>Alteração de Preço Detectada ({priceDeltaPercentage > 0 ? `+${priceDeltaPercentage.toFixed(1)}%` : `${priceDeltaPercentage.toFixed(1)}%`})</span>
              </div>
              <p className="text-blue-800 text-[11px]">
                De {formatCurrency(initialIngredient.purchasePrice)} para {formatCurrency(purchasePrice)}. Ao salvar, as fichas técnicas vinculadas serão recalculadas.
              </p>
              <input
                id="input-price-change-reason"
                type="text"
                placeholder="Motivo do reajuste (ex: Aumento do fornecedor, inflação sazonal)"
                value={priceChangeReason}
                onChange={(e) => setPriceChangeReason(e.target.value)}
                className="w-full px-3 py-1.5 text-xs bg-white border border-blue-300 rounded-lg"
              />
            </div>
          )}

          {/* Observações */}
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Observações / Instruções Especiais
            </label>
            <textarea
              id="textarea-ingredient-notes"
              rows={2}
              placeholder="Ex: Armazenar sob refrigeração após aberto, lote preferencial."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500"
            />
          </div>

          {/* Status Ativo */}
          <div className="flex items-center gap-2 pt-1">
            <input
              id="checkbox-ingredient-active"
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              className="w-4 h-4 text-amber-600 rounded-sm border-stone-300 focus:ring-amber-500"
            />
            <label htmlFor="checkbox-ingredient-active" className="text-xs font-semibold text-stone-700 cursor-pointer">
              Insumo Ativo no Catálogo
            </label>
          </div>

          {/* Buttons */}
          <div className="pt-3 border-t border-stone-200 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-stone-600 hover:bg-stone-100 rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              id="btn-save-ingredient"
              type="submit"
              className="flex items-center gap-1.5 px-5 py-2 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded-lg shadow-xs transition-colors"
            >
              <Check className="w-4 h-4" />
              <span>Salvar Insumo</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
