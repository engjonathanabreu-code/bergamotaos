import React, { useState, useMemo } from 'react';
import {
  Boxes,
  Plus,
  Search,
  Filter,
  ArrowUpDown,
  Download,
  Upload,
  RefreshCw,
  Edit2,
  Trash2,
  History,
  FileSpreadsheet,
  AlertTriangle,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { Ingredient, PriceHistory, Recipe, SystemSettings } from '../../types';
import {
  formatCurrency,
  formatPrecisionCurrency,
  getBaseUnit,
  UNIT_SHORT_LABELS,
} from '../../utils/conversions';
import { exportDataToExcel } from '../../utils/fileParser';

interface IngredientsListProps {
  ingredients: Ingredient[];
  priceHistory: PriceHistory[];
  recipes: Recipe[];
  settings: SystemSettings;
  onAddIngredient: () => void;
  onEditIngredient: (ingredient: Ingredient) => void;
  onDeleteIngredient: (id: string) => void;
  onOpenHistory: (ingredient: Ingredient) => void;
  onOpenBatchUpdate: () => void;
  onOpenImportModal: () => void;
}

type SortField = 'name' | 'category' | 'purchasePrice' | 'baseCost' | 'updatedAt';
type SortOrder = 'asc' | 'desc';

export const IngredientsList: React.FC<IngredientsListProps> = ({
  ingredients,
  priceHistory,
  recipes,
  settings,
  onAddIngredient,
  onEditIngredient,
  onDeleteIngredient,
  onOpenHistory,
  onOpenBatchUpdate,
  onOpenImportModal,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  // Filter and sort ingredients
  const filteredIngredients = useMemo(() => {
    return ingredients
      .filter((ing) => {
        const matchesSearch =
          ing.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (ing.brand && ing.brand.toLowerCase().includes(searchTerm.toLowerCase())) ||
          (ing.supplier && ing.supplier.toLowerCase().includes(searchTerm.toLowerCase()));

        const matchesCategory =
          selectedCategory === 'all' || ing.category === selectedCategory;

        const matchesStatus =
          selectedStatus === 'all' ||
          (selectedStatus === 'active' && ing.active) ||
          (selectedStatus === 'inactive' && !ing.active);

        return matchesSearch && matchesCategory && matchesStatus;
      })
      .sort((a, b) => {
        let valA: any = a[sortField as keyof Ingredient] || '';
        let valB: any = b[sortField as keyof Ingredient] || '';

        if (sortField === 'baseCost') {
          const baseA = getBaseUnit(a.packageUnit);
          const baseB = getBaseUnit(b.packageUnit);
          const totalA = a.packageQuantity * baseA.factor;
          const totalB = b.packageQuantity * baseB.factor;
          valA = totalA > 0 ? a.purchasePrice / totalA : 0;
          valB = totalB > 0 ? b.purchasePrice / totalB : 0;
        }

        if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
        if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
        return 0;
      });
  }, [ingredients, searchTerm, selectedCategory, selectedStatus, sortField, sortOrder]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const handleExportExcel = () => {
    const dataToExport = ingredients.map((ing) => {
      const baseInfo = getBaseUnit(ing.packageUnit);
      const totalBase = ing.packageQuantity * baseInfo.factor;
      const baseCost = totalBase > 0 ? ing.purchasePrice / totalBase : 0;

      return {
        'ID': ing.id,
        'Nome': ing.name,
        'Categoria': ing.category,
        'Marca': ing.brand || '',
        'Qtd Embalagem': ing.packageQuantity,
        'Unidade Embalagem': ing.packageUnit,
        'Preço de Compra (R$)': ing.purchasePrice,
        'Custo Base (R$)': baseCost,
        'Unidade Base': baseInfo.baseLabel,
        'Fornecedor': ing.supplier || '',
        'Ativo': ing.active ? 'Sim' : 'Não',
        'Última Atualização': new Date(ing.updatedAt || ing.createdAt).toLocaleDateString('pt-BR'),
        'Observações': ing.notes || '',
      };
    });

    exportDataToExcel('catalogo_insumos_confeitaria', 'Insumos', dataToExport);
  };

  return (
    <div id="ingredients-list-view" className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header with Title and Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Boxes className="w-5 h-5 text-emerald-600" />
            Cadastro Central de Insumos
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Cadastre uma única vez. Ao alterar o preço de um insumo, o custo de todas as fichas é recalculado.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            id="btn-open-batch-update"
            onClick={onOpenBatchUpdate}
            className="px-3 py-2 bg-white hover:bg-gray-50 text-gray-700 rounded-lg text-xs font-semibold border border-gray-200 shadow-2xs flex items-center gap-1.5 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5 text-gray-500" />
            <span>Atualizar em Massa</span>
          </button>

          <button
            id="btn-import-spreadsheet"
            onClick={onOpenImportModal}
            className="px-3 py-2 bg-white hover:bg-gray-50 text-gray-700 rounded-lg text-xs font-semibold border border-gray-200 shadow-2xs flex items-center gap-1.5 transition-colors"
          >
            <Upload className="w-3.5 h-3.5 text-gray-500" />
            <span>Importar Planilha</span>
          </button>

          <button
            id="btn-export-excel"
            onClick={handleExportExcel}
            className="px-3 py-2 bg-white hover:bg-gray-50 text-gray-700 rounded-lg text-xs font-semibold border border-gray-200 shadow-2xs flex items-center gap-1.5 transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-gray-500" />
            <span>Exportar</span>
          </button>

          <button
            id="btn-add-new-ingredient"
            onClick={onAddIngredient}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Novo Insumo</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex flex-col md:flex-row items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por nome, marca ou fornecedor..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        {/* Category Filter */}
        <div className="flex items-center gap-2 w-full md:w-auto">
          <Filter className="w-4 h-4 text-gray-400 shrink-0" />
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full md:w-48 px-3 py-2 text-xs sm:text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="all">Todas as Categorias</option>
            {settings.ingredientCategories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        {/* Status Filter */}
        <div className="w-full md:w-auto">
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value as any)}
            className="w-full md:w-36 px-3 py-2 text-xs sm:text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="all">Todos os Status</option>
            <option value="active">Apenas Ativos</option>
            <option value="inactive">Apenas Inativos</option>
          </select>
        </div>
      </div>

      {/* Table of Ingredients */}
      <div className="bg-white rounded-xl border border-stone-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-stone-50 border-b border-stone-200 text-stone-600 font-semibold uppercase tracking-wider text-[11px]">
              <tr>
                <th
                  onClick={() => handleSort('name')}
                  className="p-3.5 cursor-pointer hover:bg-stone-100 transition-colors"
                >
                  <div className="flex items-center gap-1">
                    <span>Nome / Marca</span>
                    <ArrowUpDown className="w-3 h-3 text-stone-400" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('category')}
                  className="p-3.5 cursor-pointer hover:bg-stone-100 transition-colors"
                >
                  <div className="flex items-center gap-1">
                    <span>Categoria</span>
                    <ArrowUpDown className="w-3 h-3 text-stone-400" />
                  </div>
                </th>
                <th className="p-3.5">Embalagem Compra</th>
                <th
                  onClick={() => handleSort('purchasePrice')}
                  className="p-3.5 text-right cursor-pointer hover:bg-stone-100 transition-colors"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Preço Pago</span>
                    <ArrowUpDown className="w-3 h-3 text-stone-400" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('baseCost')}
                  className="p-3.5 text-right cursor-pointer hover:bg-stone-100 transition-colors"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Custo Unitário Base</span>
                    <ArrowUpDown className="w-3 h-3 text-stone-400" />
                  </div>
                </th>
                <th className="p-3.5 hidden md:table-cell">Fornecedor</th>
                <th
                  onClick={() => handleSort('updatedAt')}
                  className="p-3.5 hidden lg:table-cell cursor-pointer hover:bg-stone-100 transition-colors"
                >
                  <div className="flex items-center gap-1">
                    <span>Atualizado Em</span>
                    <ArrowUpDown className="w-3 h-3 text-stone-400" />
                  </div>
                </th>
                <th className="p-3.5 text-center">Status</th>
                <th className="p-3.5 text-right">Ações</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-stone-200">
              {filteredIngredients.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-stone-400">
                    Nenhum insumo encontrado para os filtros selecionados.
                  </td>
                </tr>
              ) : (
                filteredIngredients.map((ing) => {
                  const baseInfo = getBaseUnit(ing.packageUnit);
                  const totalBase = ing.packageQuantity * baseInfo.factor;
                  const costPerBase = totalBase > 0 && ing.purchasePrice > 0 ? ing.purchasePrice / totalBase : 0;
                  const hasPrice = ing.purchasePrice > 0;

                  return (
                    <tr key={ing.id} className="hover:bg-stone-50 transition-colors">
                      {/* Name & Brand */}
                      <td className="p-3.5">
                        <div className="font-semibold text-stone-900">{ing.name}</div>
                        {ing.brand && (
                          <div className="text-[11px] text-stone-500 font-normal">
                            Marca: {ing.brand}
                          </div>
                        )}
                      </td>

                      {/* Category */}
                      <td className="p-3.5">
                        <span className="inline-block px-2 py-0.5 rounded-md bg-stone-100 text-stone-700 text-[11px] font-medium border border-stone-200">
                          {ing.category}
                        </span>
                      </td>

                      {/* Package info */}
                      <td className="p-3.5 font-mono text-stone-700">
                        {ing.packageQuantity} {UNIT_SHORT_LABELS[ing.packageUnit] || ing.packageUnit}
                      </td>

                      {/* Purchase price */}
                      <td className="p-3.5 text-right font-mono font-bold text-stone-900">
                        {hasPrice ? (
                          formatCurrency(ing.purchasePrice)
                        ) : (
                          <span className="text-rose-600 text-xs font-semibold flex items-center justify-end gap-1">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            Sem preço
                          </span>
                        )}
                      </td>

                      {/* Cost per base unit (high precision) */}
                      <td className="p-3.5 text-right font-mono text-stone-800">
                        {hasPrice ? (
                          <>
                            <span className="font-bold text-amber-900">
                              {formatPrecisionCurrency(costPerBase, 4)}
                            </span>
                            <span className="text-[10px] text-stone-500 block font-sans">
                              por {baseInfo.baseLabel}
                            </span>
                          </>
                        ) : (
                          <span className="text-stone-400 text-xs">-</span>
                        )}
                      </td>

                      {/* Supplier */}
                      <td className="p-3.5 hidden md:table-cell text-stone-600">
                        {ing.supplier || <span className="text-stone-300">-</span>}
                      </td>

                      {/* Updated Date */}
                      <td className="p-3.5 hidden lg:table-cell text-stone-500 text-xs">
                        {new Date(ing.updatedAt || ing.createdAt).toLocaleDateString('pt-BR')}
                      </td>

                      {/* Status */}
                      <td className="p-3.5 text-center">
                        {ing.active ? (
                          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 font-medium bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3" /> Ativo
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] text-stone-500 font-medium bg-stone-100 px-2 py-0.5 rounded-full border border-stone-200">
                            <XCircle className="w-3 h-3" /> Inativo
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="p-3.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            id={`btn-history-${ing.id}`}
                            onClick={() => onOpenHistory(ing)}
                            title="Ver histórico de preços"
                            className="p-1.5 rounded-lg text-stone-500 hover:text-stone-800 hover:bg-stone-100 transition-colors"
                          >
                            <History className="w-4 h-4" />
                          </button>

                          <button
                            id={`btn-edit-${ing.id}`}
                            onClick={() => onEditIngredient(ing)}
                            title="Editar insumo"
                            className="p-1.5 rounded-lg text-amber-700 hover:text-amber-900 hover:bg-amber-50 transition-colors"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>

                          <button
                            id={`btn-delete-${ing.id}`}
                            onClick={() => {
                              const usedInRecipes = recipes.filter((r) =>
                                r.ingredients.some((ri) => ri.ingredientId === ing.id)
                              );

                              const confirmMessage =
                                usedInRecipes.length > 0
                                  ? `"${ing.name}" é usado em ${usedInRecipes.length} ficha(s) técnica(s):\n${usedInRecipes
                                      .slice(0, 5)
                                      .map((r) => `• ${r.name}`)
                                      .join('\n')}${usedInRecipes.length > 5 ? `\n...e mais ${usedInRecipes.length - 5}` : ''}\n\nSe excluir, essas fichas ficarão com "Insumo Não Encontrado" e custo incompleto. Deseja continuar mesmo assim?`
                                  : `Tem certeza que deseja excluir o insumo "${ing.name}"?`;

                              if (window.confirm(confirmMessage)) {
                                onDeleteIngredient(ing.id);
                              }
                            }}
                            title="Excluir insumo"
                            className="p-1.5 rounded-lg text-stone-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer summary */}
        <div className="p-4 bg-stone-50 border-t border-stone-200 flex flex-col sm:flex-row items-center justify-between text-xs text-stone-500 gap-2">
          <span>
            Exibindo {filteredIngredients.length} de {ingredients.length} insumos
          </span>
          <span className="text-stone-400">
            Dica: O preço por grama/ml é calculado automaticamente com base na embalagem.
          </span>
        </div>
      </div>
    </div>
  );
};
