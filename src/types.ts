export type UnitType = 'g' | 'kg' | 'ml' | 'L' | 'unidade' | 'duzia';

export interface Ingredient {
  id: string;
  name: string;
  category: string;
  brand?: string;
  packageQuantity: number; // e.g. 1000 for 1kg or 1 for 1kg
  packageUnit: UnitType; // e.g. 'g', 'kg', 'ml', 'L', 'unidade', 'duzia'
  purchasePrice: number; // in BRL, e.g. 10.00
  // Densidade em g/ml, usada apenas quando a embalagem é comprada em uma
  // dimensão (massa ou volume) mas a receita usa a outra (ex: comprado em kg,
  // usado em ml). Sem isso, o sistema assume 1g≈1ml (densidade da água), o que
  // distorce o custo de óleos, mel, leite condensado etc.
  densityGramsPerMl?: number;
  supplier?: string;
  notes?: string;
  active: boolean;
  updatedAt: string; // ISO date string
  createdAt: string;
}

export interface PriceHistory {
  id: string;
  ingredientId: string;
  ingredientName?: string;
  previousPrice: number;
  newPrice: number;
  date: string; // ISO string
  changePercentage: number;
  reason?: string;
}

export interface RecipeIngredient {
  id: string;
  ingredientId: string; // references Ingredient.id
  quantity: number; // e.g. 250
  unit: UnitType; // e.g. 'g'
  notes?: string;
}

export interface AdditionalCostItem {
  id: string;
  name: string;
  type: 'fixed_per_recipe' | 'per_unit' | 'percentage';
  value: number; // R$ or %
  enabled: boolean;
}

export interface Recipe {
  id: string;
  name: string;
  code: string; // e.g. BOLO-001
  category: string;
  yieldAmount: number; // e.g. 10
  yieldUnit: string; // e.g. "unidades", "fatias", "porções", "kg"
  finalWeightGrams?: number;
  prepTimeMinutes?: number;
  ovenTimeMinutes?: number;
  ovenTemperatureCelsius?: number;
  equipment?: string[];
  shelfLifeDays?: number;
  storageConditions?: string;
  instructions?: string;
  notes?: string;
  active: boolean;
  ingredients: RecipeIngredient[];
  
  // Custom or inherited additional costs
  lossPercentage?: number; // e.g. 5%
  additionalCosts?: AdditionalCostItem[];

  // Pricing details
  markup?: number; // e.g. 3.0
  targetMarginPercentage?: number; // e.g. 40%
  practicedPrice?: number; // Real selling price R$
  wholesalePrice?: number; // Atacado R$
  resellerPrice?: number; // Revenda R$
  promotionalPrice?: number; // Promo R$

  createdAt: string;
  updatedAt: string;
  sourceDocument?: string; // name of imported file if any
}

export interface CalculatedIngredientCost {
  ingredientId: string;
  ingredientName: string;
  brand?: string;
  quantity: number;
  unit: UnitType;
  packagePrice: number;
  packageQuantity: number;
  packageUnit: UnitType;
  costPerBaseUnit: number; // e.g. cost per gram or per ml
  baseUnitLabel: string; // 'g', 'ml', 'unidade'
  calculatedCost: number; // total cost for this line
  costPercentageOfTotal: number; // %
  hasPrice: boolean;
  conversionFormula: string; // readable step-by-step
  error?: string;
}

export interface CalculatedRecipeCost {
  ingredientsCost: number;
  additionalCostsTotal: number;
  lossCost: number;
  totalRecipeCost: number;
  costPerUnit: number;
  suggestedPriceMarkup: number;
  suggestedPriceMargin: number;
  practicedPrice: number;
  profitPerUnit: number;
  realMarginPercentage: number;
  realMarkup: number;
  isIncomplete: boolean;
  missingPriceIngredientsCount: number;
  ingredientsBreakdown: CalculatedIngredientCost[];
}

export interface SystemSettings {
  defaultMarkup: number;
  defaultTargetMargin: number;
  defaultLossPercentage: number;
  defaultPackagingCostPerUnit: number;
  defaultLaborCostPerHour: number;
  defaultEnergyCostPerRecipe: number;
  ingredientCategories: string[];
  productCategories: string[];
  expenseCategories: string[];
  incomeCategories: string[];
  currencySymbol: string;
  companyName: string;
  finance?: FinanceSettings;
}

/** Parâmetros do modelo financeiro (ficam dentro de bg_settings.data.finance). */
export interface FinanceSettings {
  /** Taxa cobrada por forma de pagamento, em % sobre o valor vendido. */
  cardFees: Record<SaleMethod, number>;
  /** Piso da meta diária (a planilha usava R$ 1.500). */
  minDailyTarget: number;
  /** Dias da semana em que a loja abre (0 = domingo ... 6 = sábado). */
  openWeekdays: number[];
  /** Lucro líquido desejado, em % da receita — usado na precificação sugerida. */
  targetProfitPct: number;
}

export interface PriceRecalculationImpact {
  recipeId: string;
  recipeName: string;
  recipeCode: string;
  affectedIngredientName: string;
  previousRecipeCost: number;
  newRecipeCost: number;
  costDifference: number;
  percentageChange: number;
  previousUnitCost: number;
  newUnitCost: number;
  currentSellingPrice: number;
  previousMargin: number;
  newMargin: number;
}

export interface ParsedRecipeImportItem {
  rawText: string;
  parsedName: string;
  quantity: number;
  unit: UnitType;
  matchedIngredientId: string | null;
  matchScore: number; // 0 to 1
  matchStatus: 'exact' | 'suggested' | 'not_found';
  userAction: 'use_matched' | 'create_new' | 'select_existing' | 'ignore';
  newIngredientDraft?: {
    name: string;
    category: string;
    packageQuantity: number;
    packageUnit: UnitType;
    purchasePrice: number;
  };
}

export interface ParsedRecipeImport {
  productName: string;
  category: string;
  code?: string;
  yieldAmount: number;
  yieldUnit: string;
  finalWeightGrams?: number;
  prepTimeMinutes?: number;
  ovenTimeMinutes?: number;
  ovenTemperatureCelsius?: number;
  equipment?: string[];
  shelfLifeDays?: number;
  storageConditions?: string;
  instructions?: string;
  notes?: string;
  ingredients: ParsedRecipeImportItem[];
  questionsOrDoubts?: string[];
}

export type PaymentMethod = 'dinheiro' | 'pix' | 'debito' | 'credito' | 'outro';

export type ExpenseGroup = 'compras' | 'funcionario' | 'fixa' | 'variavel' | 'esporadica';

export const EXPENSE_GROUP_LABELS: Record<ExpenseGroup, string> = {
  compras: 'Saídas Compras',
  funcionario: 'Despesa com Funcionário',
  fixa: 'Despesas Fixas',
  variavel: 'Despesa Variável',
  esporadica: 'Despesa Esporádica',
};

export interface Transaction {
  id: string;
  type: 'entrada' | 'saida';
  date: string; // ISO date (YYYY-MM-DD)
  description: string; // fornecedor / motivo / especificação
  category: string; // estratificação detalhada (ex: "Insumos e Fornecedores")
  group?: ExpenseGroup; // grupo macro, no formato mais estratificado (a partir de set/26)
  value: number;
  paymentMethod?: PaymentMethod;
  // Detalhamento opcional por forma de pagamento (usado para entradas
  // diárias somando várias formas de pagamento no mesmo dia)
  paymentBreakdown?: Partial<Record<PaymentMethod, number>>;
  // Dia fechado/feriado — só se aplica a 'entrada'. Marca que não houve
  // expediente naquele dia, para não contar como "venda zero" nas médias e
  // metas diárias.
  isHoliday?: boolean;
  holidayReason?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MonthlyFinanceSummary {
  month: string; // YYYY-MM
  totalEntradas: number;
  totalSaidas: number;
  saldo: number;
}

export interface CategoryBreakdown {
  category: string;
  total: number;
  percentageOfTotal: number;
  count: number;
}


// ---------------------------------------------------------------------------
// Financeiro (Bergamota OS)
// ---------------------------------------------------------------------------

export type SaleMethod = 'dinheiro' | 'pix' | 'debito' | 'credito' | 'outro';

export const SALE_METHOD_LABELS: Record<SaleMethod, string> = {
  dinheiro: 'Dinheiro',
  pix: 'Pix',
  debito: 'Débito',
  credito: 'Crédito',
  outro: 'Outro',
};

/** Item de uma venda: um produto da ficha técnica, ou um valor avulso (recipe_id e product_name vazios). */
export interface SaleItem {
  id: string;
  sale_id: string;
  recipe_id?: string | null;
  product_name?: string | null; // snapshot do nome no momento da venda
  quantity: number;
  unit_price?: number | null; // preço unitário usado na venda (editável)
  amount: number; // quantity * unit_price (ou o valor avulso)
}

/** Uma venda (ticket) do caixa: forma de pagamento, total e um ou mais itens. */
export interface Sale {
  id: string;
  date: string; // YYYY-MM-DD
  method: SaleMethod;
  amount: number; // total da venda = soma dos itens
  register: string; // 'principal' | 'cz'
  is_aggregate: boolean; // lançamento consolidado (fora do ticket médio)
  note?: string | null;
  created_at?: string;
  items: SaleItem[];
}

export type FinGroup = ExpenseGroup | 'receita';

export interface FinTransaction {
  id: string;
  type: 'saida' | 'entrada';
  date: string;
  competencia: string; // YYYY-MM
  description: string;
  category: string;
  grp: FinGroup;
  value: number;
  status: 'realizado' | 'previsto';
  payment_method?: string | null;
  recurring_id?: string | null;
  source?: string;
  notes?: string | null;
}

export interface RecurringExpense {
  id: string;
  description: string;
  category: string;
  grp: ExpenseGroup;
  value: number;
  day_of_month: number;
  start_month: string;
  end_month?: string | null;
  active: boolean;
}

export interface ClosedDay {
  date: string;
  reason?: string | null;
}

export interface Budget {
  competencia: string;
  grp: FinGroup;
  value: number;
}
