import { Ingredient, RecipeIngredient, UnitType, CalculatedIngredientCost } from '../types';

export const UNIT_LABELS: Record<UnitType, string> = {
  g: 'Gramas (g)',
  kg: 'Quilogramas (kg)',
  ml: 'Mililitros (ml)',
  L: 'Litros (L)',
  unidade: 'Unidade (un)',
  duzia: 'Dúzia (dz)',
};

export const UNIT_SHORT_LABELS: Record<UnitType, string> = {
  g: 'g',
  kg: 'kg',
  ml: 'ml',
  L: 'L',
  unidade: 'un',
  duzia: 'dz',
};

export type UnitDimension = 'mass' | 'volume' | 'count' | 'unknown';

export function getUnitDimension(unit: UnitType): UnitDimension {
  if (unit === 'g' || unit === 'kg') return 'mass';
  if (unit === 'ml' || unit === 'L') return 'volume';
  if (unit === 'unidade' || unit === 'duzia') return 'count';
  return 'unknown';
}

export function getBaseUnit(unit: UnitType): { baseUnit: UnitType; factor: number; baseLabel: string } {
  switch (unit) {
    case 'kg':
      return { baseUnit: 'g', factor: 1000, baseLabel: 'g' };
    case 'g':
      return { baseUnit: 'g', factor: 1, baseLabel: 'g' };
    case 'L':
      return { baseUnit: 'ml', factor: 1000, baseLabel: 'ml' };
    case 'ml':
      return { baseUnit: 'ml', factor: 1, baseLabel: 'ml' };
    case 'duzia':
      return { baseUnit: 'unidade', factor: 12, baseLabel: 'un' };
    case 'unidade':
      return { baseUnit: 'unidade', factor: 1, baseLabel: 'un' };
    default:
      return { baseUnit: unit, factor: 1, baseLabel: unit };
  }
}

/**
 * Formats monetary value strictly to Brazilian Real (R$ 0,00)
 */
export function formatCurrency(value: number | undefined | null): string {
  if (value === undefined || value === null || isNaN(value)) {
    return 'R$ 0,00';
  }
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Formats high-precision cost per base unit (e.g. R$ 0,0080 / g)
 */
export function formatPrecisionCurrency(value: number | undefined | null, decimals = 4): string {
  if (value === undefined || value === null || isNaN(value)) {
    return 'R$ 0,0000';
  }
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

export function formatPercentage(value: number | undefined | null, decimals = 1): string {
  if (value === undefined || value === null || isNaN(value)) {
    return '0%';
  }
  return `${value.toFixed(decimals).replace('.', ',')}%`;
}

export function formatNumber(value: number | undefined | null, decimals = 2): string {
  if (value === undefined || value === null || isNaN(value)) {
    return '0';
  }
  // Trim trailing zeros if unnecessary
  const formatted = value.toFixed(decimals).replace('.', ',');
  return formatted.endsWith(',00') ? formatted.replace(',00', '') : formatted;
}

/**
 * Normalizes user text unit to standard UnitType
 */
/**
 * Mapeamento estrito de texto de unidade para UnitType, com sinalização explícita
 * de quando o texto não foi reconhecido (em vez de cair silenciosamente em 'g').
 * Medidas caseiras (colher, xícara, pitada) NÃO entram aqui — elas mudam a
 * QUANTIDADE, não só a unidade, e são tratadas em normalizeQuantityAndUnit.
 */
export function normalizeUnitStrict(rawUnit: string): { unit: UnitType; recognized: boolean } {
  const clean = (rawUnit || '').trim().toLowerCase().replace(/\.$/, ''); // tolera "Un." com ponto final
  if (['g', 'gr', 'grama', 'gramas'].includes(clean)) return { unit: 'g', recognized: true };
  if (['kg', 'kilo', 'quilo', 'quilograma', 'quilogramas', 'kgs'].includes(clean)) return { unit: 'kg', recognized: true };
  if (['ml', 'mls', 'mililitro', 'mililitros'].includes(clean)) return { unit: 'ml', recognized: true };
  if (['l', 'litro', 'litros', 'lt', 'lts'].includes(clean)) return { unit: 'L', recognized: true };
  if (['un', 'unid', 'unidade', 'unidades', 'und', 'ovo', 'ovos', 'pct', 'pacote', 'lata'].includes(clean)) {
    return { unit: 'unidade', recognized: true };
  }
  if (['dz', 'duzia', 'dúzia', 'duzias', 'dúzias'].includes(clean)) return { unit: 'duzia', recognized: true };
  return { unit: 'g', recognized: false };
}

/**
 * Separa quantidade + unidade de uma única célula combinada, como costuma
 * aparecer em planilhas reais: "5 kg", "1kg" (sem espaço), "907 gramas",
 * "0,5 kg", ou só a unidade sem número ("kg", "un", "Un.") — nesse caso a
 * quantidade é implicitamente 1. Isso é diferente de normalizeQuantityAndUnit,
 * que trata medidas caseiras (colher/xícara) de RECEITAS; esta função é para o
 * tamanho da EMBALAGEM do insumo, como comprado do fornecedor.
 */
export function parsePackageSizeString(raw: string): { quantity: number; unit: UnitType; recognized: boolean } {
  const clean = (raw || '').trim();
  if (!clean) return { quantity: 1, unit: 'g', recognized: false };

  const match = clean.match(/^([\d.,]+)\s*(.*)$/);
  if (match) {
    // "1.000,00" (milhar + decimal) ou "0,5" (só decimal com vírgula)
    let numStr = match[1];
    if (/\d{1,3}(\.\d{3})+,\d+/.test(numStr)) {
      numStr = numStr.replace(/\./g, '').replace(',', '.');
    } else {
      numStr = numStr.replace(',', '.');
    }
    const qty = parseFloat(numStr);
    const unitText = match[2].trim();

    if (!isNaN(qty) && qty > 0) {
      const { unit, recognized } = normalizeUnitStrict(unitText || 'unidade');
      return { quantity: qty, unit, recognized: unitText.length === 0 ? true : recognized };
    }
  }

  // Sem número no início (ex: "kg", "un", "Un.") — quantidade implícita = 1
  const { unit, recognized } = normalizeUnitStrict(clean);
  return { quantity: 1, unit, recognized };
}

/**
 * Mantida por compatibilidade com chamadas que só precisam do UnitType e não
 * tratam medidas caseiras (ex: unidade de embalagem de insumo, que raramente é
 * "colher"). Prefira normalizeQuantityAndUnit ao interpretar texto livre de
 * receitas, onde colher/xícara são comuns.
 */
export function normalizeUnit(rawUnit: string): UnitType {
  return normalizeUnitStrict(rawUnit).unit;
}

// Aproximações usuais de culinária brasileira para medidas caseiras, convertidas
// para gramas. São aproximações reais (variam por insumo), por isso o resultado
// vem marcado como "aproximado" para quem for revisar os dados importados.
const HOUSEHOLD_MEASURES_TO_GRAMS: { pattern: RegExp; grams: number }[] = [
  { pattern: /^colher(es)?(\s+de)?\s+sopa$/, grams: 15 },
  { pattern: /^colher(es)?(\s+de)?\s+ch[áa]$/, grams: 5 },
  { pattern: /^colher(es)?(\s+de)?\s+sobremesa$/, grams: 10 },
  { pattern: /^colher(es)?$/, grams: 15 }, // sem qualificação: assume sopa
  { pattern: /^x[íi]caras?(\s+de\s+ch[áa])?$/, grams: 120 }, // aprox. farinha/açúcar
  { pattern: /^pitadas?$/, grams: 1 },
];

export interface QuantityUnitParseResult {
  quantity: number;
  unit: UnitType;
  recognized: boolean;
  wasHouseholdMeasure: boolean;
}

/**
 * Normaliza quantidade + texto de unidade vindos de receitas em texto livre.
 * Medidas caseiras (colher, xícara, pitada) são convertidas para uma
 * aproximação em GRAMAS (ajustando a quantidade), nunca tratadas como
 * "unidade" (contagem) — isso evita tanto o erro de incompatibilidade de
 * dimensão quanto o de subestimar a quantidade real usada na receita.
 */
export function normalizeQuantityAndUnit(rawQuantity: number, rawUnit: string): QuantityUnitParseResult {
  const clean = (rawUnit || '').trim().toLowerCase();
  const qty = rawQuantity || 1;

  const household = HOUSEHOLD_MEASURES_TO_GRAMS.find((m) => m.pattern.test(clean));
  if (household) {
    return { quantity: qty * household.grams, unit: 'g', recognized: true, wasHouseholdMeasure: true };
  }

  const direct = normalizeUnitStrict(clean);
  return { quantity: qty, unit: direct.unit, recognized: direct.recognized, wasHouseholdMeasure: false };
}

/**
 * Computes individual ingredient cost with full audit trail
 */
export function calculateIngredientCost(
  recipeIng: RecipeIngredient,
  ingredientMap: Map<string, Ingredient>
): CalculatedIngredientCost {
  const ingredient = ingredientMap.get(recipeIng.ingredientId);

  if (!ingredient) {
    return {
      ingredientId: recipeIng.ingredientId,
      ingredientName: 'Insumo Não Encontrado',
      quantity: recipeIng.quantity,
      unit: recipeIng.unit,
      packagePrice: 0,
      packageQuantity: 0,
      packageUnit: recipeIng.unit,
      costPerBaseUnit: 0,
      baseUnitLabel: UNIT_SHORT_LABELS[recipeIng.unit] || recipeIng.unit,
      calculatedCost: 0,
      costPercentageOfTotal: 0,
      hasPrice: false,
      conversionFormula: 'Insumo não cadastrado no banco de dados',
      error: 'Insumo não encontrado no cadastro central',
    };
  }

  const pkgPrice = ingredient.purchasePrice || 0;
  const pkgQty = ingredient.packageQuantity || 1;
  const pkgUnit = ingredient.packageUnit || 'g';
  const recipeQty = recipeIng.quantity || 0;
  const recipeUnit = recipeIng.unit || 'g';

  const hasValidPrice = pkgPrice > 0 && pkgQty > 0;

  if (!hasValidPrice) {
    return {
      ingredientId: ingredient.id,
      ingredientName: ingredient.name,
      brand: ingredient.brand,
      quantity: recipeQty,
      unit: recipeUnit,
      packagePrice: pkgPrice,
      packageQuantity: pkgQty,
      packageUnit: pkgUnit,
      costPerBaseUnit: 0,
      baseUnitLabel: UNIT_SHORT_LABELS[recipeUnit] || recipeUnit,
      calculatedCost: 0,
      costPercentageOfTotal: 0,
      hasPrice: false,
      conversionFormula: 'CUSTO NÃO CALCULADO: INSUMO SEM PREÇO',
      error: 'Insumo sem preço ou quantidade de embalagem zerada',
    };
  }

  // Dimension check
  const pkgDim = getUnitDimension(pkgUnit);
  const recipeDim = getUnitDimension(recipeUnit);

  let costPerBaseUnit = 0;
  let totalRecipeBaseUnits = 0;
  let calculatedCost = 0;
  let formula = '';
  let baseUnitLabel = '';

  if (pkgDim === recipeDim && pkgDim !== 'unknown') {
    // Normal unit conversion within same dimension
    const pkgBase = getBaseUnit(pkgUnit);
    const recipeBase = getBaseUnit(recipeUnit);

    const totalPackageInBaseUnits = pkgQty * pkgBase.factor;
    costPerBaseUnit = pkgPrice / totalPackageInBaseUnits;
    totalRecipeBaseUnits = recipeQty * recipeBase.factor;
    calculatedCost = totalRecipeBaseUnits * costPerBaseUnit;
    baseUnitLabel = pkgBase.baseLabel;

    formula = `${formatCurrency(pkgPrice)} ÷ ${formatNumber(totalPackageInBaseUnits)} ${pkgBase.baseLabel} = ${formatPrecisionCurrency(costPerBaseUnit, 4)}/${pkgBase.baseLabel} × ${formatNumber(totalRecipeBaseUnits)} ${pkgBase.baseLabel} = ${formatCurrency(calculatedCost)}`;
  } else if (pkgUnit === recipeUnit) {
    costPerBaseUnit = pkgPrice / pkgQty;
    totalRecipeBaseUnits = recipeQty;
    calculatedCost = recipeQty * costPerBaseUnit;
    baseUnitLabel = UNIT_SHORT_LABELS[pkgUnit];

    formula = `${formatCurrency(pkgPrice)} ÷ ${formatNumber(pkgQty)} ${baseUnitLabel} = ${formatPrecisionCurrency(costPerBaseUnit, 4)}/${baseUnitLabel} × ${formatNumber(recipeQty)} ${baseUnitLabel} = ${formatCurrency(calculatedCost)}`;
  } else {
    // Dimensão cruzada (ex: embalagem em kg, receita em ml, ou vice-versa).
    // Usa a densidade do insumo (g/ml) quando cadastrada. Sem densidade, assume
    // 1g≈1ml (água) como último recurso — e isso fica marcado no resultado, pois
    // para óleo, mel, leite condensado etc. essa aproximação distorce o custo.
    if ((pkgDim === 'mass' && recipeDim === 'volume') || (pkgDim === 'volume' && recipeDim === 'mass')) {
      const hasDensity = !!ingredient.densityGramsPerMl && ingredient.densityGramsPerMl > 0;
      const density = hasDensity ? (ingredient.densityGramsPerMl as number) : 1;

      const pkgBase = getBaseUnit(pkgUnit);
      const recipeBase = getBaseUnit(recipeUnit);
      const totalPackageInBaseUnits = pkgQty * pkgBase.factor; // na unidade-base da embalagem (g ou ml)
      costPerBaseUnit = pkgPrice / totalPackageInBaseUnits;
      const recipeQtyInOwnBase = recipeQty * recipeBase.factor; // na unidade-base da receita (g ou ml)

      // Converte a quantidade da receita para a MESMA unidade-base da embalagem,
      // atravessando massa <-> volume via densidade (g/ml).
      const recipeQtyInPackageBase =
        pkgDim === 'mass' ? recipeQtyInOwnBase * density : recipeQtyInOwnBase / density;

      totalRecipeBaseUnits = recipeQtyInPackageBase;
      calculatedCost = totalRecipeBaseUnits * costPerBaseUnit;
      baseUnitLabel = `${pkgBase.baseLabel} (conv.)`;

      const densityNote = hasDensity
        ? `densidade ${formatNumber(density, 2)}g/ml`
        : `densidade não cadastrada, assumindo água (1g≈1ml)`;

      formula = `${formatCurrency(pkgPrice)} ÷ ${formatNumber(totalPackageInBaseUnits)} ${pkgBase.baseLabel} = ${formatPrecisionCurrency(costPerBaseUnit, 4)}/${pkgBase.baseLabel} × ${formatNumber(recipeQtyInOwnBase)} ${recipeBase.baseLabel} (≈${formatNumber(totalRecipeBaseUnits)} ${pkgBase.baseLabel}, ${densityNote}) = ${formatCurrency(calculatedCost)}`;
    } else {
      // Incompatible dimensions (e.g. mass vs count)
      return {
        ingredientId: ingredient.id,
        ingredientName: ingredient.name,
        brand: ingredient.brand,
        quantity: recipeQty,
        unit: recipeUnit,
        packagePrice: pkgPrice,
        packageQuantity: pkgQty,
        packageUnit: pkgUnit,
        costPerBaseUnit: 0,
        baseUnitLabel: recipeUnit,
        calculatedCost: 0,
        costPercentageOfTotal: 0,
        hasPrice: false,
        conversionFormula: `Incompatibilidade de unidades: Embalagem em ${pkgUnit} vs Receita em ${recipeUnit}`,
        error: `Não é possível converter ${pkgUnit} para ${recipeUnit} diretamente`,
      };
    }
  }

  return {
    ingredientId: ingredient.id,
    ingredientName: ingredient.name,
    brand: ingredient.brand,
    quantity: recipeQty,
    unit: recipeUnit,
    packagePrice: pkgPrice,
    packageQuantity: pkgQty,
    packageUnit: pkgUnit,
    costPerBaseUnit,
    baseUnitLabel,
    calculatedCost,
    costPercentageOfTotal: 0, // calculated in batch
    hasPrice: true,
    conversionFormula: formula,
  };
}
