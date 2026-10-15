import {
  Recipe,
  Ingredient,
  CalculatedRecipeCost,
  CalculatedIngredientCost,
  SystemSettings,
  PriceRecalculationImpact,
} from '../types';
import { calculateIngredientCost } from './conversions';

export const DEFAULT_SETTINGS: SystemSettings = {
  defaultMarkup: 3.0,
  defaultTargetMargin: 45.0, // 45%
  defaultLossPercentage: 5.0, // 5%
  defaultPackagingCostPerUnit: 0.80, // R$ 0,80
  defaultLaborCostPerHour: 25.00, // R$ 25,00/h
  defaultEnergyCostPerRecipe: 1.50, // R$ 1,50
  ingredientCategories: [
    'Farinhas e Amidos',
    'Açúcares e Adoçantes',
    'Chocolates e Cacau',
    'Laticínios e Derivados',
    'Ovos',
    'Óleos e Gorduras',
    'Fermentos e Químicos',
    'Frutas e Polpas',
    'Castanhas e Nozes',
    'Aromas e Especiarias',
    'Embalagens',
    'Outros Insumos',
  ],
  productCategories: [
    'Bolos Tradicionais',
    'Bolos Recheados',
    'Docinhos e Brigadeiros',
    'Tortas e Sobremesas',
    'Biscoitos e Cookies',
    'Pães Artesanais',
    'Cupcakes e Muffins',
    'Sobremesas no Pote',
    'Salgados e Quiches',
    'Especiais / Sob Encomenda',
  ],
  expenseCategories: [
    'Insumos e Fornecedores',
    'Embalagens',
    'Equipamentos e Utensílios',
    'Decoração e Flores',
    'Manutenção e Limpeza',
    'Compras Diversas',
    'Entrega',
    'Alimentação',
    'Funcionários',
    'Despesas Fixas',
    'Impostos e Taxas',
    'Serviços Profissionais',
    'Empréstimos e Financiamentos',
    'Outros',
  ],
  incomeCategories: ['Vendas', 'Encomendas', 'Outras Receitas'],
  currencySymbol: 'R$',
  companyName: 'Minha Confeitaria Artesanal',
};

/**
 * Calculates complete cost breakdown for a recipe
 */
export function calculateRecipeCost(
  recipe: Recipe,
  ingredientMap: Map<string, Ingredient>,
  settings: SystemSettings = DEFAULT_SETTINGS
): CalculatedRecipeCost {
  const yieldAmount = recipe.yieldAmount > 0 ? recipe.yieldAmount : 1;
  const ingredientsBreakdown: CalculatedIngredientCost[] = [];
  let ingredientsCost = 0;
  let missingPriceCount = 0;

  for (const item of recipe.ingredients) {
    const costItem = calculateIngredientCost(item, ingredientMap);
    ingredientsBreakdown.push(costItem);
    if (costItem.hasPrice) {
      ingredientsCost += costItem.calculatedCost;
    } else {
      missingPriceCount++;
    }
  }

  // Calculate percentages
  for (const item of ingredientsBreakdown) {
    if (ingredientsCost > 0 && item.hasPrice) {
      item.costPercentageOfTotal = (item.calculatedCost / ingredientsCost) * 100;
    } else {
      item.costPercentageOfTotal = 0;
    }
  }

  // Loss percentage calculation
  const lossPercentage =
    recipe.lossPercentage !== undefined ? recipe.lossPercentage : settings.defaultLossPercentage;
  const lossCost = ingredientsCost * (lossPercentage / 100);

  // Additional costs (packaging, labor, energy, etc.)
  let additionalCostsTotal = 0;
  if (recipe.additionalCosts && recipe.additionalCosts.length > 0) {
    for (const cost of recipe.additionalCosts) {
      if (cost.enabled) {
        if (cost.type === 'fixed_per_recipe') {
          additionalCostsTotal += cost.value;
        } else if (cost.type === 'per_unit') {
          additionalCostsTotal += cost.value * yieldAmount;
        } else if (cost.type === 'percentage') {
          additionalCostsTotal += (ingredientsCost + lossCost) * (cost.value / 100);
        }
      }
    }
  }

  const totalRecipeCost = ingredientsCost + lossCost + additionalCostsTotal;
  const costPerUnit = totalRecipeCost / yieldAmount;

  // Markup & Margin Pricing Calculations
  // Markup method: Suggested Price = Unit Cost * Markup
  const markup = recipe.markup && recipe.markup > 0 ? recipe.markup : settings.defaultMarkup;
  const suggestedPriceMarkup = costPerUnit * markup;

  // Target Margin method: Suggested Price = Unit Cost / (1 - Margin/100)
  const targetMargin =
    recipe.targetMarginPercentage && recipe.targetMarginPercentage > 0 && recipe.targetMarginPercentage < 100
      ? recipe.targetMarginPercentage
      : settings.defaultTargetMargin;
  const suggestedPriceMargin = targetMargin < 100 ? costPerUnit / (1 - targetMargin / 100) : 0;

  // Realized metrics based on practiced price
  const practicedPrice = recipe.practicedPrice || 0;
  const profitPerUnit = practicedPrice > 0 ? practicedPrice - costPerUnit : 0;
  const realMarginPercentage =
    practicedPrice > 0 ? ((practicedPrice - costPerUnit) / practicedPrice) * 100 : 0;
  const realMarkup = costPerUnit > 0 && practicedPrice > 0 ? practicedPrice / costPerUnit : 0;

  const isIncomplete = missingPriceCount > 0 || !recipe.yieldAmount;

  return {
    ingredientsCost,
    additionalCostsTotal,
    lossCost,
    totalRecipeCost,
    costPerUnit,
    suggestedPriceMarkup,
    suggestedPriceMargin,
    practicedPrice,
    profitPerUnit,
    realMarginPercentage,
    realMarkup,
    isIncomplete,
    missingPriceIngredientsCount: missingPriceCount,
    ingredientsBreakdown,
  };
}

/**
 * Calculates impact across all recipes when an ingredient's price changes
 */
export function calculatePriceChangeImpact(
  changedIngredientId: string,
  newPrice: number,
  recipes: Recipe[],
  ingredients: Ingredient[],
  settings: SystemSettings = DEFAULT_SETTINGS
): PriceRecalculationImpact[] {
  const currentMap = new Map<string, Ingredient>(ingredients.map((i) => [i.id, i]));
  const updatedMap = new Map<string, Ingredient>(ingredients.map((i) => [i.id, { ...i }]));

  const targetIng = updatedMap.get(changedIngredientId);
  if (targetIng) {
    targetIng.purchasePrice = newPrice;
  }

  const impacts: PriceRecalculationImpact[] = [];

  for (const recipe of recipes) {
    const usesIngredient = recipe.ingredients.some(
      (item) => item.ingredientId === changedIngredientId
    );

    if (usesIngredient) {
      const oldCalc = calculateRecipeCost(recipe, currentMap, settings);
      const newCalc = calculateRecipeCost(recipe, updatedMap, settings);

      const costDifference = newCalc.totalRecipeCost - oldCalc.totalRecipeCost;
      const percentageChange =
        oldCalc.totalRecipeCost > 0 ? (costDifference / oldCalc.totalRecipeCost) * 100 : 0;

      impacts.push({
        recipeId: recipe.id,
        recipeName: recipe.name,
        recipeCode: recipe.code,
        affectedIngredientName: targetIng?.name || 'Insumo',
        previousRecipeCost: oldCalc.totalRecipeCost,
        newRecipeCost: newCalc.totalRecipeCost,
        costDifference,
        percentageChange,
        previousUnitCost: oldCalc.costPerUnit,
        newUnitCost: newCalc.costPerUnit,
        currentSellingPrice: recipe.practicedPrice || 0,
        previousMargin: oldCalc.realMarginPercentage,
        newMargin: newCalc.realMarginPercentage,
      });
    }
  }

  return impacts;
}
