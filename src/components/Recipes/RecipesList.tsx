import React, { useState, useMemo } from 'react';
import {
  Cake,
  Plus,
  Search,
  Filter,
  ArrowUpDown,
  Eye,
  Edit2,
  Copy,
  Scale,
  Trash2,
  Sparkles,
  LayoutGrid,
  List as ListIcon,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  Download,
  FileSpreadsheet,
} from 'lucide-react';
import { Recipe, Ingredient, SystemSettings } from '../../types';
import { formatCurrency, formatPercentage } from '../../utils/conversions';
import { calculateRecipeCost } from '../../utils/pricing';
import { exportDataToExcel } from '../../utils/fileParser';

interface RecipesListProps {
  recipes: Recipe[];
  ingredients: Ingredient[];
  settings: SystemSettings;
  onAddRecipe: () => void;
  onViewRecipe: (recipe: Recipe) => void;
  onEditRecipe: (recipe: Recipe) => void;
  onDuplicateRecipe: (recipe: Recipe) => void;
  onScaleRecipe: (recipe: Recipe) => void;
  onDeleteRecipe: (id: string) => void;
  onOpenImportAI: () => void;
}

type ViewMode = 'grid' | 'table';

export const RecipesList: React.FC<RecipesListProps> = ({
  recipes,
  ingredients,
  settings,
  onAddRecipe,
  onViewRecipe,
  onEditRecipe,
  onDuplicateRecipe,
  onScaleRecipe,
  onDeleteRecipe,
  onOpenImportAI,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');

  const ingredientMap = new Map<string, Ingredient>(ingredients.map((i) => [i.id, i]));

  const filteredRecipes = useMemo(() => {
    return recipes
      .filter((r) => {
        const matchesSearch =
          r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (r.code && r.code.toLowerCase().includes(searchTerm.toLowerCase())) ||
          r.category.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesCategory =
          selectedCategory === 'all' || r.category === selectedCategory;

        const matchesStatus =
          selectedStatus === 'all' ||
          (selectedStatus === 'active' && r.active) ||
          (selectedStatus === 'inactive' && !r.active);

        return matchesSearch && matchesCategory && matchesStatus;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [recipes, searchTerm, selectedCategory, selectedStatus]);

  const handleExportAll = () => {
    const dataToExport = recipes.map((r) => {
      const cost = calculateRecipeCost(r, ingredientMap, settings);
      return {
        'Código': r.code || '',
        'Nome do Produto': r.name,
        'Categoria': r.category,
        'Rendimento': `${r.yieldAmount} ${r.yieldUnit}`,
        'Qtd Ingredientes': r.ingredients.length,
        'Custo dos Insumos (R$)': cost.ingredientsCost,
        'Custo Total Lote (R$)': cost.totalRecipeCost,
        'Custo Unitário (R$)': cost.costPerUnit,
        'Preço Sugerido (R$)': cost.suggestedPriceMarkup,
        'Preço Praticado (R$)': r.practicedPrice || 'N/A',
        'Margem Real (%)': cost.realMarginPercentage.toFixed(1) + '%',
        'Tempo Preparo (min)': r.prepTimeMinutes || '',
        'Tempo Forno (min)': r.ovenTimeMinutes || '',
        'Validade (dias)': r.shelfLifeDays || '',
      };
    });

    exportDataToExcel('todas_fichas_tecnicas_confeitaria', 'Fichas Técnicas', dataToExport);
  };

  return (
    <div id="recipes-list-view" className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Cake className="w-5 h-5 text-emerald-600" />
            Fichas Técnicas de Produtos
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Composições de receitas com recálculo automático de custos e precificação.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            id="btn-export-all-recipes"
            onClick={handleExportAll}
            className="px-3 py-2 bg-white hover:bg-gray-50 text-gray-700 rounded-lg text-xs font-semibold border border-gray-200 shadow-2xs flex items-center gap-1.5 transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-gray-500" />
            <span>Exportar Todas</span>
          </button>

          <button
            id="btn-recipes-import-ai"
            onClick={onOpenImportAI}
            className="px-3.5 py-2 bg-gray-900 hover:bg-gray-800 text-emerald-400 rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-all"
          >
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            <span>Importar Receita</span>
          </button>

          <button
            id="btn-add-new-recipe"
            onClick={onAddRecipe}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Nova Ficha</span>
          </button>
        </div>
      </div>

      {/* Search, Filter & View Controls */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto flex-1">
          {/* Search */}
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar ficha por nome, código ou categoria..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Category Filter */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Filter className="w-4 h-4 text-gray-400 shrink-0" />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full sm:w-48 px-3 py-2 text-xs sm:text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="all">Todas as Categorias</option>
              {settings.productCategories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="w-full sm:w-auto">
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value as any)}
              className="w-full sm:w-36 px-3 py-2 text-xs sm:text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="all">Todos os Status</option>
              <option value="active">Apenas Ativas</option>
              <option value="inactive">Apenas Inativas</option>
            </select>
          </div>
        </div>

        {/* View Mode Switcher */}
        <div className="flex items-center p-1 bg-gray-100 rounded-lg self-end md:self-auto">
          <button
            onClick={() => setViewMode('grid')}
            title="Visualização em Grade"
            className={`p-1.5 rounded-md transition-all ${
              viewMode === 'grid' ? 'bg-white text-stone-900 shadow-xs' : 'text-stone-500 hover:text-stone-900'
            }`}
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode('table')}
            title="Visualização em Tabela"
            className={`p-1.5 rounded-md transition-all ${
              viewMode === 'table' ? 'bg-white text-stone-900 shadow-xs' : 'text-stone-500 hover:text-stone-900'
            }`}
          >
            <ListIcon className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Grid View */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredRecipes.length === 0 ? (
            <div className="col-span-full bg-white p-12 rounded-2xl border border-stone-200 text-center text-stone-400">
              <Cake className="w-12 h-12 mx-auto text-stone-300 mb-3" />
              <p className="font-semibold text-stone-600">Nenhuma ficha técnica encontrada.</p>
              <p className="text-xs mt-1">Crie uma nova ficha manual ou importe um arquivo .docx.</p>
            </div>
          ) : (
            filteredRecipes.map((recipe) => {
              const cost = calculateRecipeCost(recipe, ingredientMap, settings);
              const targetMargin = recipe.targetMarginPercentage || settings.defaultTargetMargin;
              const hasPracticedPrice = recipe.practicedPrice && recipe.practicedPrice > 0;
              const isMarginHealthy = hasPracticedPrice && cost.realMarginPercentage >= targetMargin;

              return (
                <div
                  key={recipe.id}
                  id={`recipe-card-${recipe.id}`}
                  className="bg-white rounded-2xl border border-stone-200 shadow-xs hover:border-amber-400 hover:shadow-md transition-all flex flex-col justify-between overflow-hidden group"
                >
                  {/* Card Top */}
                  <div className="p-5 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-stone-100 text-stone-600 border border-stone-200">
                          {recipe.category}
                        </span>
                        {!recipe.active && (
                          <span className="ml-1.5 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-rose-100 text-rose-700 border border-rose-200">
                            Inativa
                          </span>
                        )}
                        {recipe.code && (
                          <span className="ml-1.5 text-[10px] font-mono font-medium text-stone-500">
                            {recipe.code}
                          </span>
                        )}
                        <h3 className="font-bold text-base text-stone-900 mt-1 leading-snug group-hover:text-amber-700 transition-colors">
                          {recipe.name}
                        </h3>
                      </div>

                      <div className="text-right">
                        <span className="text-[11px] text-stone-500 block">Rende:</span>
                        <span className="text-xs font-bold text-stone-800">
                          {recipe.yieldAmount} {recipe.yieldUnit || 'un'}
                        </span>
                      </div>
                    </div>

                    {cost.isIncomplete && (
                      <div className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 p-2 rounded-lg flex items-center gap-1.5 font-medium">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        <span>Insumos sem preço no banco</span>
                      </div>
                    )}

                    {/* Cost Breakdown Pills */}
                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-stone-100">
                      <div className="p-2.5 rounded-xl bg-stone-50 border border-stone-100">
                        <span className="text-[10px] text-stone-500 font-medium block">
                          Custo por {recipe.yieldUnit || 'un'}
                        </span>
                        <span className="text-sm font-bold font-mono text-stone-900">
                          {formatCurrency(cost.costPerUnit)}
                        </span>
                      </div>

                      <div className="p-2.5 rounded-xl bg-stone-50 border border-stone-100">
                        <span className="text-[10px] text-stone-500 font-medium block">
                          Preço por {recipe.yieldUnit || 'un'}
                        </span>
                        <span className="text-sm font-bold font-mono text-emerald-700">
                          {hasPracticedPrice ? formatCurrency(recipe.practicedPrice!) : 'Não definido'}
                        </span>
                      </div>
                    </div>

                    {/* Margins & Info Footer */}
                    <div className="flex items-center justify-between text-xs pt-1">
                      <span className="text-stone-500 text-[11px]">
                        {recipe.ingredients.length} ingredientes
                      </span>

                      {hasPracticedPrice && (
                        <span
                          className={`text-[11px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                            isMarginHealthy
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-900'
                          }`}
                        >
                          <TrendingUp className="w-3 h-3" />
                          Margem: {formatPercentage(cost.realMarginPercentage)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Card Action Buttons Bar */}
                  <div className="px-5 py-3 bg-stone-50/80 border-t border-stone-100 flex items-center justify-between">
                    <button
                      id={`btn-view-${recipe.id}`}
                      onClick={() => onViewRecipe(recipe)}
                      className="text-xs font-semibold text-amber-700 hover:text-amber-900 flex items-center gap-1 transition-colors"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Ver Ficha Completa</span>
                    </button>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => onScaleRecipe(recipe)}
                        title="Escalar Produção"
                        className="p-1.5 rounded-lg text-stone-500 hover:text-stone-900 hover:bg-stone-200 transition-colors"
                      >
                        <Scale className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => onDuplicateRecipe(recipe)}
                        title="Duplicar Ficha"
                        className="p-1.5 rounded-lg text-stone-500 hover:text-stone-900 hover:bg-stone-200 transition-colors"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => onEditRecipe(recipe)}
                        title="Editar Ficha"
                        className="p-1.5 rounded-lg text-amber-700 hover:text-amber-900 hover:bg-amber-100 transition-colors"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => {
                          if (
                            window.confirm(
                              `Deseja realmente excluir a ficha técnica "${recipe.name}"?`
                            )
                          ) {
                            onDeleteRecipe(recipe.id);
                          }
                        }}
                        title="Excluir Ficha"
                        className="p-1.5 rounded-lg text-stone-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      ) : (
        /* Table View */
        <div className="bg-white rounded-xl border border-stone-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-stone-50 border-b border-stone-200 text-stone-600 font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="p-3.5">Produto / Ficha</th>
                  <th className="p-3.5">Categoria</th>
                  <th className="p-3.5 text-center">Rendimento</th>
                  <th className="p-3.5 text-right">Custo Total Lote</th>
                  <th className="p-3.5 text-right font-bold text-stone-900">Custo Unitário</th>
                  <th className="p-3.5 text-right" title="Preço de uma unidade de rendimento, não do lote inteiro">Preço Venda (un.)</th>
                  <th className="p-3.5 text-center">Margem Real</th>
                  <th className="p-3.5 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200">
                {filteredRecipes.map((recipe) => {
                  const cost = calculateRecipeCost(recipe, ingredientMap, settings);
                  return (
                    <tr key={recipe.id} className="hover:bg-stone-50 transition-colors">
                      <td className="p-3.5">
                        <div className="font-semibold text-stone-900 flex items-center gap-1.5">
                          {recipe.name}
                          {!recipe.active && (
                            <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-rose-100 text-rose-700 border border-rose-200">
                              Inativa
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-stone-500 font-mono">
                          {recipe.code || 'S/ CÓDIGO'} • {recipe.ingredients.length} insumos
                        </div>
                      </td>

                      <td className="p-3.5">
                        <span className="text-[11px] px-2 py-0.5 rounded-md bg-stone-100 text-stone-700 font-medium">
                          {recipe.category}
                        </span>
                      </td>

                      <td className="p-3.5 text-center font-mono">
                        {recipe.yieldAmount} {recipe.yieldUnit || 'un'}
                      </td>

                      <td className="p-3.5 text-right font-mono text-stone-700">
                        {formatCurrency(cost.totalRecipeCost)}
                      </td>

                      <td className="p-3.5 text-right font-mono font-bold text-amber-900">
                        {formatCurrency(cost.costPerUnit)}
                      </td>

                      <td className="p-3.5 text-right font-mono font-bold text-emerald-700">
                        {recipe.practicedPrice ? formatCurrency(recipe.practicedPrice) : '-'}
                      </td>

                      <td className="p-3.5 text-center font-mono font-semibold">
                        {recipe.practicedPrice ? (
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs ${
                              cost.realMarginPercentage >=
                              (recipe.targetMarginPercentage || settings.defaultTargetMargin)
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-amber-100 text-amber-900'
                            }`}
                          >
                            {formatPercentage(cost.realMarginPercentage)}
                          </span>
                        ) : (
                          <span className="text-stone-400 text-xs">-</span>
                        )}
                      </td>

                      <td className="p-3.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => onViewRecipe(recipe)}
                            title="Ver Ficha"
                            className="p-1.5 rounded-lg text-stone-500 hover:text-stone-900 hover:bg-stone-100 transition-colors"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => onScaleRecipe(recipe)}
                            title="Escalar Receita"
                            className="p-1.5 rounded-lg text-stone-500 hover:text-stone-900 hover:bg-stone-100 transition-colors"
                          >
                            <Scale className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => onDuplicateRecipe(recipe)}
                            title="Duplicar Receita"
                            className="p-1.5 rounded-lg text-stone-500 hover:text-stone-900 hover:bg-stone-100 transition-colors"
                          >
                            <Copy className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => onEditRecipe(recipe)}
                            title="Editar Ficha"
                            className="p-1.5 rounded-lg text-amber-700 hover:text-amber-900 hover:bg-amber-50 transition-colors"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => {
                              if (
                                window.confirm(
                                  `Deseja realmente excluir a ficha técnica "${recipe.name}"?`
                                )
                              ) {
                                onDeleteRecipe(recipe.id);
                              }
                            }}
                            title="Excluir Ficha"
                            className="p-1.5 rounded-lg text-stone-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
