import React, { useState, useEffect } from 'react';
import {
  X,
  Plus,
  Trash2,
  Calculator,
  Save,
  AlertCircle,
  AlertTriangle,
  Layers,
  Clock,
  Flame,
  ChefHat,
  Info,
  HelpCircle,
  Check,
} from 'lucide-react';
import { Recipe, Ingredient, UnitType, RecipeIngredient, SystemSettings } from '../../types';
import {
  UNIT_LABELS,
  UNIT_SHORT_LABELS,
  calculateIngredientCost,
  formatCurrency,
  formatPrecisionCurrency,
  formatPercentage,
  formatNumber,
} from '../../utils/conversions';
import { calculateRecipeCost } from '../../utils/pricing';

interface RecipeFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (recipe: Omit<Recipe, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) => void;
  initialRecipe?: Recipe | null;
  ingredients: Ingredient[];
  settings: SystemSettings;
  onQuickCreateIngredient?: (name: string) => void;
}

export const RecipeFormModal: React.FC<RecipeFormModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialRecipe,
  ingredients,
  settings,
  onQuickCreateIngredient,
}) => {
  // Metadata state
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [category, setCategory] = useState(settings.productCategories[0] || 'Bolos');
  const [yieldAmount, setYieldAmount] = useState<number>(1);
  const [yieldUnit, setYieldUnit] = useState('unidade');
  const [finalWeightGrams, setFinalWeightGrams] = useState<number | undefined>(undefined);
  const [prepTimeMinutes, setPrepTimeMinutes] = useState<number | undefined>(undefined);
  const [ovenTimeMinutes, setOvenTimeMinutes] = useState<number | undefined>(undefined);
  const [ovenTemperatureCelsius, setOvenTemperatureCelsius] = useState<number | undefined>(180);
  const [shelfLifeDays, setShelfLifeDays] = useState<number | undefined>(5);
  const [storageConditions, setStorageConditions] = useState('Conservar sob refrigeração');
  const [equipmentInput, setEquipmentInput] = useState('');
  const [instructions, setInstructions] = useState('');
  const [notes, setNotes] = useState('');
  const [active, setActive] = useState(true);

  // Pricing inputs
  const [practicedPrice, setPracticedPrice] = useState<number | undefined>(undefined);
  const [markup, setMarkup] = useState<number>(settings.defaultMarkup || 3.0);
  const [targetMarginPercentage, setTargetMarginPercentage] = useState<number>(
    settings.defaultTargetMargin || 40
  );
  const [lossPercentage, setLossPercentage] = useState<number>(settings.defaultLossPercentage ?? 5);
  const [additionalCosts, setAdditionalCosts] = useState<
    Array<{ id: string; name: string; type: 'fixed_per_recipe' | 'per_unit' | 'percentage'; value: number; enabled: boolean }>
  >([]);

  // Ingredients rows
  const [recipeIngredients, setRecipeIngredients] = useState<
    Array<{
      id: string;
      ingredientId: string;
      quantity: number;
      unit: UnitType;
      notes?: string;
    }>
  >([]);

  const [error, setError] = useState<string | null>(null);

  const ingredientMap = new Map<string, Ingredient>(ingredients.map((i) => [i.id, i]));

  useEffect(() => {
    if (initialRecipe) {
      setName(initialRecipe.name || '');
      setCode(initialRecipe.code || '');
      setCategory(initialRecipe.category || settings.productCategories[0] || 'Bolos');
      setYieldAmount(initialRecipe.yieldAmount || 1);
      setYieldUnit(initialRecipe.yieldUnit || 'unidade');
      setFinalWeightGrams(initialRecipe.finalWeightGrams);
      setPrepTimeMinutes(initialRecipe.prepTimeMinutes);
      setOvenTimeMinutes(initialRecipe.ovenTimeMinutes);
      setOvenTemperatureCelsius(initialRecipe.ovenTemperatureCelsius || 180);
      setShelfLifeDays(initialRecipe.shelfLifeDays || 5);
      setStorageConditions(initialRecipe.storageConditions || 'Conservar sob refrigeração');
      setEquipmentInput(initialRecipe.equipment?.join(', ') || '');
      setInstructions(initialRecipe.instructions || '');
      setNotes(initialRecipe.notes || '');
      setActive(initialRecipe.active ?? true);
      setPracticedPrice(initialRecipe.practicedPrice);
      setMarkup(initialRecipe.markup || settings.defaultMarkup || 3.0);
      setTargetMarginPercentage(initialRecipe.targetMarginPercentage || settings.defaultTargetMargin || 40);
      setLossPercentage(
        initialRecipe.lossPercentage !== undefined ? initialRecipe.lossPercentage : settings.defaultLossPercentage ?? 5
      );
      setAdditionalCosts(initialRecipe.additionalCosts ? initialRecipe.additionalCosts.map((c) => ({ ...c })) : []);
      setRecipeIngredients(
        initialRecipe.ingredients.map((ing, idx) => ({
          id: ing.id || `row-${idx}`,
          ingredientId: ing.ingredientId,
          quantity: ing.quantity,
          unit: ing.unit,
          notes: ing.notes,
        }))
      );
    } else {
      setName('');
      setCode(`PRD-${Math.floor(100 + Math.random() * 900)}`);
      setCategory(settings.productCategories[0] || 'Bolos');
      setYieldAmount(1);
      setYieldUnit('unidade');
      setFinalWeightGrams(undefined);
      setPrepTimeMinutes(30);
      setOvenTimeMinutes(40);
      setOvenTemperatureCelsius(180);
      setShelfLifeDays(5);
      setStorageConditions('Conservar em local seco ou sob refrigeração');
      setEquipmentInput('Batedeira planetária, Espátula de silicone, Forma');
      setInstructions('');
      setNotes('');
      setActive(true);
      setPracticedPrice(undefined);
      setMarkup(settings.defaultMarkup || 3.0);
      setTargetMarginPercentage(settings.defaultTargetMargin || 40);
      setLossPercentage(settings.defaultLossPercentage ?? 5);
      // Sugestões pré-preenchidas (desativadas) a partir dos padrões de Configurações,
      // para que esses valores deixem de ser apenas números "decorativos" e o usuário
      // só precise revisar/ativar em vez de criar cada linha do zero.
      setAdditionalCosts([
        {
          id: `cost-pkg-${Date.now()}`,
          name: 'Embalagem',
          type: 'per_unit',
          value: settings.defaultPackagingCostPerUnit ?? 0,
          enabled: false,
        },
        {
          id: `cost-labor-${Date.now() + 1}`,
          name: 'Mão de obra (30 min de preparo)',
          type: 'fixed_per_recipe',
          value: Number((((settings.defaultLaborCostPerHour ?? 0) * 30) / 60).toFixed(2)),
          enabled: false,
        },
        {
          id: `cost-energy-${Date.now() + 2}`,
          name: 'Energia / Gás',
          type: 'fixed_per_recipe',
          value: settings.defaultEnergyCostPerRecipe ?? 0,
          enabled: false,
        },
      ]);
      setRecipeIngredients([
        {
          id: 'row-0',
          ingredientId: ingredients[0]?.id || '',
          quantity: 100,
          unit: 'g',
        },
      ]);
    }
    setError(null);
  }, [initialRecipe, isOpen, settings]);

  if (!isOpen) return null;

  // Live calculation of current recipe state
  const currentRecipeObj: Recipe = {
    id: initialRecipe?.id || 'temp',
    name: name || 'Novo Produto',
    code,
    category,
    yieldAmount: yieldAmount > 0 ? yieldAmount : 1,
    yieldUnit,
    finalWeightGrams,
    ingredients: recipeIngredients.map((r) => ({
      id: r.id,
      ingredientId: r.ingredientId,
      quantity: Number(r.quantity) || 0,
      unit: r.unit,
      notes: r.notes,
    })),
    markup,
    targetMarginPercentage,
    practicedPrice,
    lossPercentage,
    additionalCosts,
    instructions,
    prepTimeMinutes,
    ovenTimeMinutes,
    ovenTemperatureCelsius,
    shelfLifeDays,
    storageConditions,
    equipment: equipmentInput.split(',').map((s) => s.trim()).filter(Boolean),
    notes,
    active,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const calculatedCost = calculateRecipeCost(currentRecipeObj, ingredientMap, settings);

  const handleAddIngredientRow = () => {
    setRecipeIngredients((prev) => [
      ...prev,
      {
        id: `row-${Date.now()}`,
        ingredientId: ingredients[0]?.id || '',
        quantity: 100,
        unit: 'g',
      },
    ]);
  };

  const handleRemoveIngredientRow = (index: number) => {
    setRecipeIngredients((prev) => prev.filter((_, i) => i !== index));
  };

  const handleRowChange = (index: number, field: string, value: any) => {
    setRecipeIngredients((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [field]: value } : row))
    );
  };

  const handleAddCostItem = () => {
    setAdditionalCosts((prev) => [
      ...prev,
      { id: `cost-${Date.now()}`, name: '', type: 'fixed_per_recipe', value: 0, enabled: true },
    ]);
  };

  const handleRemoveCostItem = (index: number) => {
    setAdditionalCosts((prev) => prev.filter((_, i) => i !== index));
  };

  const handleCostItemChange = (index: number, field: string, value: any) => {
    setAdditionalCosts((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [field]: value } : row))
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('O nome do produto/receita é obrigatório.');
      return;
    }
    if (yieldAmount <= 0) {
      setError('O rendimento deve ser maior que zero.');
      return;
    }
    if (recipeIngredients.length === 0) {
      setError('Adicione pelo menos um ingrediente à ficha técnica.');
      return;
    }

    // Check if all ingredients have selected an ingredient
    const invalidRow = recipeIngredients.find((r) => !r.ingredientId);
    if (invalidRow) {
      setError('Selecione um insumo válido para todas as linhas da receita.');
      return;
    }

    onSave({
      ...(initialRecipe ? { id: initialRecipe.id } : {}),
      name: name.trim(),
      code: code.trim(),
      category,
      yieldAmount: Number(yieldAmount),
      yieldUnit: yieldUnit.trim() || 'unidade',
      finalWeightGrams: finalWeightGrams ? Number(finalWeightGrams) : undefined,
      ingredients: recipeIngredients.map((r) => ({
        id: r.id,
        ingredientId: r.ingredientId,
        quantity: Number(r.quantity),
        unit: r.unit,
        notes: r.notes,
      })),
      markup: Number(markup),
      targetMarginPercentage: Number(targetMarginPercentage),
      practicedPrice: practicedPrice ? Number(practicedPrice) : undefined,
      lossPercentage: Number(lossPercentage),
      additionalCosts: additionalCosts.map((c) => ({ ...c, value: Number(c.value) || 0 })),
      instructions: instructions.trim(),
      prepTimeMinutes: prepTimeMinutes ? Number(prepTimeMinutes) : undefined,
      ovenTimeMinutes: ovenTimeMinutes ? Number(ovenTimeMinutes) : undefined,
      ovenTemperatureCelsius: ovenTemperatureCelsius ? Number(ovenTemperatureCelsius) : undefined,
      shelfLifeDays: shelfLifeDays ? Number(shelfLifeDays) : undefined,
      storageConditions: storageConditions.trim(),
      equipment: equipmentInput.split(',').map((s) => s.trim()).filter(Boolean),
      notes: notes.trim(),
      active,
    });
    onClose();
  };

  return (
    <div
      id="recipe-form-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs overflow-y-auto"
    >
      <div
        id="recipe-form-modal-container"
        className="bg-white rounded-2xl border border-stone-200 shadow-2xl max-w-5xl w-full overflow-hidden my-6 flex flex-col max-h-[94vh]"
      >
        {/* Header */}
        <div className="px-6 py-4 bg-stone-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-600 flex items-center justify-center text-white font-bold text-sm">
              <ChefHat className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base">
                {initialRecipe ? 'Editar Ficha Técnica' : 'Nova Ficha Técnica de Produto'}
              </h3>
              <p className="text-xs text-stone-300">
                Os custos dos ingredientes são vinculados em tempo real ao cadastro central de insumos.
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

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="overflow-y-auto p-6 space-y-6 flex-1">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Section 1: Basic Info */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-stone-700 pb-1 border-b border-stone-200 flex items-center gap-2">
              <span>1. Informações Básicas & Rendimento</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Nome do Produto / Receita *
                </label>
                <input
                  id="input-recipe-name"
                  type="text"
                  required
                  placeholder="Ex: Bolo de Cenoura com Brigadeiro, Brigadeiro Gourmet"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Código Interno
                </label>
                <input
                  id="input-recipe-code"
                  type="text"
                  placeholder="Ex: BOL-001"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-stone-300 rounded-lg font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Categoria
                </label>
                <select
                  id="select-recipe-category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-stone-300 rounded-lg bg-white"
                >
                  {settings.productCategories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Rendimento e Peso */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 p-4 bg-stone-50 rounded-xl border border-stone-200">
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Qtd. de Rendimento *
                </label>
                <input
                  id="input-recipe-yield-amount"
                  type="number"
                  step="any"
                  min="0.01"
                  required
                  placeholder="Ex: 10, 1, 30"
                  value={yieldAmount || ''}
                  onChange={(e) => setYieldAmount(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 text-sm border border-stone-300 rounded-lg bg-white font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Unidade de Rendimento *
                </label>
                <input
                  id="input-recipe-yield-unit"
                  type="text"
                  placeholder="Ex: unidades, fatias, porções, kg"
                  value={yieldUnit}
                  onChange={(e) => setYieldUnit(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-stone-300 rounded-lg bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Peso Final Total (g)
                </label>
                <input
                  id="input-recipe-final-weight"
                  type="number"
                  placeholder="Ex: 1200"
                  value={finalWeightGrams || ''}
                  onChange={(e) => setFinalWeightGrams(parseFloat(e.target.value) || undefined)}
                  className="w-full px-3 py-2 text-sm border border-stone-300 rounded-lg bg-white font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Validade (Dias)
                </label>
                <input
                  id="input-recipe-shelf-life"
                  type="number"
                  placeholder="Ex: 5"
                  value={shelfLifeDays || ''}
                  onChange={(e) => setShelfLifeDays(parseInt(e.target.value) || undefined)}
                  className="w-full px-3 py-2 text-sm border border-stone-300 rounded-lg bg-white font-mono"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Composition / Ingredients Table */}
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-1 border-b border-stone-200">
              <h4 className="text-xs font-bold uppercase tracking-wider text-stone-700 flex items-center gap-2">
                <Layers className="w-4 h-4 text-amber-600" />
                <span>2. Ingredientes da Receita ({recipeIngredients.length} itens)</span>
              </h4>

              <button
                type="button"
                onClick={handleAddIngredientRow}
                className="flex items-center gap-1 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-lg text-xs font-semibold transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Adicionar Ingrediente</span>
              </button>
            </div>

            <div className="border border-stone-200 rounded-xl overflow-hidden shadow-2xs">
              <table className="w-full text-left text-xs">
                <thead className="bg-stone-100 text-stone-700 font-semibold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="p-2.5">Insumo Central</th>
                    <th className="p-2.5 w-24 text-right">Quantidade</th>
                    <th className="p-2.5 w-32">Unidade</th>
                    <th className="p-2.5 w-28 text-right">Custo Insumo</th>
                    <th className="p-2.5 w-28 text-right font-bold text-stone-900">Custo Calculado</th>
                    <th className="p-2.5 w-12 text-center">Ação</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-stone-200">
                  {recipeIngredients.map((row, idx) => {
                    const ing = ingredientMap.get(row.ingredientId);
                    const calcResult = ing
                      ? calculateIngredientCost(row, ingredientMap)
                      : null;
                    const lineCost = calcResult ? calcResult.calculatedCost : 0;

                    return (
                      <tr key={row.id} className="hover:bg-stone-50">
                        {/* Insumo Select */}
                        <td className="p-2.5">
                          <select
                            value={row.ingredientId}
                            onChange={(e) => handleRowChange(idx, 'ingredientId', e.target.value)}
                            className="w-full px-2.5 py-1.5 text-xs border border-stone-300 rounded-lg bg-white font-medium"
                          >
                            <option value="" disabled>
                              -- Selecione o Insumo --
                            </option>
                            {ingredients.map((ingItem) => (
                              <option key={ingItem.id} value={ingItem.id}>
                                {ingItem.name} {ingItem.brand ? `(${ingItem.brand})` : ''} - {formatCurrency(ingItem.purchasePrice)}/{ingItem.packageQuantity}{ingItem.packageUnit}
                              </option>
                            ))}
                          </select>
                        </td>

                        {/* Quantity */}
                        <td className="p-2.5">
                          <input
                            type="number"
                            step="any"
                            min="0.001"
                            value={row.quantity || ''}
                            onChange={(e) =>
                              handleRowChange(idx, 'quantity', parseFloat(e.target.value) || 0)
                            }
                            className="w-full px-2 py-1.5 text-xs text-right font-mono font-bold border border-stone-300 rounded-lg bg-white"
                          />
                        </td>

                        {/* Unit */}
                        <td className="p-2.5">
                          <select
                            value={row.unit}
                            onChange={(e) => handleRowChange(idx, 'unit', e.target.value as UnitType)}
                            className="w-full px-2 py-1.5 text-xs border border-stone-300 rounded-lg bg-white"
                          >
                            {Object.entries(UNIT_LABELS).map(([unitKey, label]) => (
                              <option key={unitKey} value={unitKey}>
                                {label}
                              </option>
                            ))}
                          </select>
                        </td>

                        {/* Central Ingredient Info */}
                        <td className="p-2.5 text-right font-mono text-stone-500 text-[11px]">
                          {ing ? (
                            `${formatCurrency(ing.purchasePrice)}/${ing.packageQuantity}${UNIT_SHORT_LABELS[ing.packageUnit]}`
                          ) : (
                            <span className="text-rose-500">Insumo não encontrado</span>
                          )}
                        </td>

                        {/* Live Calculated Row Cost */}
                        <td className="p-2.5 text-right font-mono font-bold text-stone-900">
                          {formatCurrency(lineCost)}
                        </td>

                        {/* Delete Row */}
                        <td className="p-2.5 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveIngredientRow(idx)}
                            disabled={recipeIngredients.length <= 1}
                            className="p-1 rounded-md text-stone-400 hover:text-rose-600 hover:bg-rose-50 disabled:opacity-30 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 3: Live Pricing & Financial Engine */}
          <div className="bg-stone-900 text-white rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-stone-700 pb-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                <Calculator className="w-4 h-4" />
                <span>3. Formação de Preço & Custos em Tempo Real</span>
              </h4>
              <span className="text-[11px] text-stone-400">
                Rendimento: {yieldAmount} {yieldUnit}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <span className="text-[11px] text-stone-400 block">Custo Total dos Insumos</span>
                <span className="text-base font-bold font-mono text-white">
                  {formatCurrency(calculatedCost.ingredientsCost)}
                </span>
              </div>

              <div>
                <span className="text-[11px] text-stone-400 block">Custo Total do Lote</span>
                <span className="text-base font-bold font-mono text-white">
                  {formatCurrency(calculatedCost.totalRecipeCost)}
                </span>
              </div>

              <div>
                <span className="text-[11px] text-stone-400 block">Custo Unitário Base</span>
                <span className="text-lg font-bold font-mono text-amber-400">
                  {formatCurrency(calculatedCost.costPerUnit)}
                  <span className="text-xs text-stone-400 font-normal"> /{yieldUnit}</span>
                </span>
              </div>

              <div>
                <span className="text-[11px] text-stone-400 block">
                  Sugerido (Markup {markup}x)
                </span>
                <span className="text-base font-bold font-mono text-emerald-400">
                  {formatCurrency(calculatedCost.suggestedPriceMarkup)}
                </span>
              </div>
            </div>

            {/* Inputs: Markup, Target Margin, Loss %, Practiced Price */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 pt-3 border-t border-stone-800">
              <div>
                <label className="block text-xs font-medium text-stone-300 mb-1">
                  Multiplicador Markup (ex: 3.0)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="1"
                  value={markup}
                  onChange={(e) => setMarkup(parseFloat(e.target.value) || 1)}
                  className="w-full px-3 py-1.5 text-xs bg-stone-800 border border-stone-700 text-white rounded-lg font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-300 mb-1">
                  Meta de Margem de Lucro (%)
                </label>
                <input
                  type="number"
                  step="1"
                  min="1"
                  max="99"
                  value={targetMarginPercentage}
                  onChange={(e) => setTargetMarginPercentage(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-1.5 text-xs bg-stone-800 border border-stone-700 text-white rounded-lg font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-300 mb-1">
                  Perda / Quebra (%)
                </label>
                <input
                  id="input-recipe-loss-percentage"
                  type="number"
                  step="0.5"
                  min="0"
                  max="90"
                  value={lossPercentage}
                  onChange={(e) => setLossPercentage(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-1.5 text-xs bg-stone-800 border border-stone-700 text-white rounded-lg font-mono font-bold"
                />
                <span className="text-[10px] text-stone-500 block mt-0.5">
                  {formatCurrency(calculatedCost.lossCost)} sobre o custo dos insumos
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-emerald-400 mb-1">
                  Preço Praticado (R$ / {yieldUnit || 'unidade'})
                </label>
                <input
                  id="input-recipe-practiced-price"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Ex: 15.00"
                  value={practicedPrice ?? ''}
                  onChange={(e) =>
                    setPracticedPrice(e.target.value ? parseFloat(e.target.value) : undefined)
                  }
                  className="w-full px-3 py-1.5 text-sm bg-stone-800 border-2 border-emerald-500 text-emerald-300 rounded-lg font-mono font-bold"
                />
                <span className="text-[10px] text-stone-500 block mt-0.5">
                  Preço de UMA {yieldUnit || 'unidade'}, não do lote inteiro
                </span>
              </div>
            </div>

            {/* Practiced Price Feedback */}
            {practicedPrice && practicedPrice > 0 && (
              <div className="p-3 bg-stone-800/80 rounded-xl border border-stone-700 flex items-center justify-between text-xs">
                <div>
                  <span className="text-stone-300">Lucro Bruto por Unidade: </span>
                  <strong className="text-emerald-400 font-mono">
                    {formatCurrency(calculatedCost.profitPerUnit)}
                  </strong>
                </div>
                <div>
                  <span className="text-stone-300">Margem de Lucro Real: </span>
                  <strong className="text-emerald-400 font-mono">
                    {formatPercentage(calculatedCost.realMarginPercentage)}
                  </strong>
                </div>
                <div>
                  <span className="text-stone-300">Markup Efetivo: </span>
                  <strong className="text-white font-mono">
                    {formatNumber(calculatedCost.realMarkup, 2)}x
                  </strong>
                </div>
              </div>
            )}

            {/* Additional Costs: packaging, labor, energy, etc. */}
            <div className="pt-3 border-t border-stone-800 space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-stone-300">
                  Custos Adicionais (embalagem, mão de obra, energia...)
                </label>
                <span className="text-[11px] font-mono text-amber-400">
                  Total: {formatCurrency(calculatedCost.additionalCostsTotal)}
                </span>
              </div>

              {additionalCosts.length === 0 && (
                <p className="text-[11px] text-stone-500">
                  Nenhum custo adicional cadastrado. Sem isso, o custo considera apenas insumos + perda.
                </p>
              )}

              {additionalCosts.map((item, index) => (
                <div
                  key={item.id}
                  className={`grid grid-cols-12 gap-2 items-center p-2 rounded-lg border ${
                    item.enabled ? 'bg-stone-800/80 border-stone-700' : 'bg-stone-900/60 border-stone-800 opacity-60'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={item.enabled}
                    onChange={(e) => handleCostItemChange(index, 'enabled', e.target.checked)}
                    title="Ativar este custo no cálculo"
                    className="col-span-1 w-4 h-4 accent-emerald-500"
                  />
                  <input
                    type="text"
                    placeholder="Nome (ex: Embalagem)"
                    value={item.name}
                    onChange={(e) => handleCostItemChange(index, 'name', e.target.value)}
                    className="col-span-4 px-2 py-1.5 text-xs bg-stone-950 border border-stone-700 text-white rounded-md"
                  />
                  <select
                    value={item.type}
                    onChange={(e) => handleCostItemChange(index, 'type', e.target.value)}
                    className="col-span-4 px-2 py-1.5 text-[11px] bg-stone-950 border border-stone-700 text-white rounded-md"
                  >
                    <option value="fixed_per_recipe">R$ fixo por lote</option>
                    <option value="per_unit">R$ por unidade de rendimento</option>
                    <option value="percentage">% sobre custo + perda</option>
                  </select>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={item.value}
                    onChange={(e) => handleCostItemChange(index, 'value', parseFloat(e.target.value) || 0)}
                    className="col-span-2 px-2 py-1.5 text-xs bg-stone-950 border border-stone-700 text-white rounded-md font-mono text-right"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveCostItem(index)}
                    title="Remover custo"
                    className="col-span-1 flex justify-center text-stone-500 hover:text-rose-400 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}

              <button
                type="button"
                onClick={handleAddCostItem}
                className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-400 hover:text-amber-300 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Adicionar custo</span>
              </button>
            </div>
          </div>

          {/* Section 4: Operational Preparation, Oven, Storage */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-stone-700 pb-1 border-b border-stone-200">
              4. Processo Produtivo, Forno & Instruções Técnicas
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Tempo de Preparo (min)
                </label>
                <input
                  type="number"
                  placeholder="Ex: 30"
                  value={prepTimeMinutes || ''}
                  onChange={(e) => setPrepTimeMinutes(parseInt(e.target.value) || undefined)}
                  className="w-full px-3 py-2 text-sm border border-stone-300 rounded-lg font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Tempo de Forno (min)
                </label>
                <input
                  type="number"
                  placeholder="Ex: 45"
                  value={ovenTimeMinutes || ''}
                  onChange={(e) => setOvenTimeMinutes(parseInt(e.target.value) || undefined)}
                  className="w-full px-3 py-2 text-sm border border-stone-300 rounded-lg font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Temperatura Forno (°C)
                </label>
                <input
                  type="number"
                  placeholder="Ex: 180"
                  value={ovenTemperatureCelsius || ''}
                  onChange={(e) => setOvenTemperatureCelsius(parseInt(e.target.value) || undefined)}
                  className="w-full px-3 py-2 text-sm border border-stone-300 rounded-lg font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Modo de Preparo Passo a Passo
              </label>
              <textarea
                id="textarea-recipe-instructions"
                rows={4}
                placeholder="1. Em uma tigela, misture os ovos com o açúcar até formar um creme claro.&#10;2. Adicione a farinha peneirada alternando com os líquidos.&#10;3. Despeje na forma untada e asse a 180°C por 40 minutos."
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                className="w-full px-3 py-2 text-xs sm:text-sm border border-stone-300 rounded-lg"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Equipamentos & Utensílios (separados por vírgula)
                </label>
                <input
                  type="text"
                  placeholder="Ex: Batedeira, Espátula de silicone, Forma 20cm"
                  value={equipmentInput}
                  onChange={(e) => setEquipmentInput(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-stone-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Condições de Armazenamento
                </label>
                <input
                  type="text"
                  placeholder="Ex: Armazenar sob refrigeração entre 2°C e 6°C"
                  value={storageConditions}
                  onChange={(e) => setStorageConditions(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-stone-300 rounded-lg"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Observações Gerais
              </label>
              <textarea
                rows={2}
                placeholder="Ex: Rende 1 bolo grande de 20cm ou 12 cupcakes individuais."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3 py-2 text-xs sm:text-sm border border-stone-300 rounded-lg"
              />
            </div>
          </div>
        </form>

        {/* Footer with Action Buttons */}
        <div className="p-4 bg-stone-50 border-t border-stone-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-stone-900">
              Custo por {yieldUnit || 'un'}: {formatCurrency(calculatedCost.costPerUnit)}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-stone-600 hover:bg-stone-100 rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              id="btn-save-recipe"
              type="button"
              onClick={handleSubmit}
              className="flex items-center gap-1.5 px-6 py-2 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded-lg shadow-xs transition-colors"
            >
              <Save className="w-4 h-4" />
              <span>Salvar Ficha Técnica</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
