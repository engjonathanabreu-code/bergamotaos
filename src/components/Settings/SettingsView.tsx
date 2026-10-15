import React, { useState } from 'react';
import {
  Settings,
  Save,
    Download,
  Upload,
  Plus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Building,
  DollarSign,
  Percent,
  Layers,
  FileSpreadsheet,
} from 'lucide-react';
import { SystemSettings, SaleMethod, SALE_METHOD_LABELS } from '../../types';
import { DEFAULT_FINANCE } from '../../utils/storage';
import {
  exportDataToJSON,
  importDataFromJSON,
  loadStoredIngredients,
  loadStoredRecipes,
} from '../../utils/storage';
import { exportAllDataToExcel } from '../../utils/fileParser';
import { calculateRecipeCost } from '../../utils/pricing';

interface SettingsViewProps {
  settings: SystemSettings;
  onSaveSettings: (newSettings: SystemSettings) => void;
  onReloadAllData: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  onSaveSettings,
  onReloadAllData,
}) => {
  const [formData, setFormData] = useState<SystemSettings>({ ...settings });
  const [newIngCat, setNewIngCat] = useState('');
  const [newProdCat, setNewProdCat] = useState('');
  const [newExpCat, setNewExpCat] = useState('');
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [fin, setFin] = useState(settings.finance || DEFAULT_FINANCE);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveSettings({ ...formData, finance: fin });
    setSuccessMsg('Configurações salvas com sucesso!');
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const handleAddIngCategory = () => {
    if (newIngCat.trim() && !formData.ingredientCategories.includes(newIngCat.trim())) {
      setFormData((prev) => ({
        ...prev,
        ingredientCategories: [...prev.ingredientCategories, newIngCat.trim()],
      }));
      setNewIngCat('');
    }
  };

  const handleRemoveIngCategory = (cat: string) => {
    setFormData((prev) => ({
      ...prev,
      ingredientCategories: prev.ingredientCategories.filter((c) => c !== cat),
    }));
  };

  const handleAddProdCategory = () => {
    if (newProdCat.trim() && !formData.productCategories.includes(newProdCat.trim())) {
      setFormData((prev) => ({
        ...prev,
        productCategories: [...prev.productCategories, newProdCat.trim()],
      }));
      setNewProdCat('');
    }
  };

  const handleRemoveProdCategory = (cat: string) => {
    setFormData((prev) => ({
      ...prev,
      productCategories: prev.productCategories.filter((c) => c !== cat),
    }));
  };

  const handleAddExpCategory = () => {
    if (newExpCat.trim() && !formData.expenseCategories.includes(newExpCat.trim())) {
      setFormData((prev) => ({
        ...prev,
        expenseCategories: [...prev.expenseCategories, newExpCat.trim()],
      }));
      setNewExpCat('');
    }
  };

  const handleRemoveExpCategory = (cat: string) => {
    setFormData((prev) => ({
      ...prev,
      expenseCategories: prev.expenseCategories.filter((c) => c !== cat),
    }));
  };

  const handleBackup = () => {
    exportDataToJSON();
  };

  const handleExportExcelAll = () => {
    const ingredients = loadStoredIngredients();
    const recipes = loadStoredRecipes();
    const ingredientMap = new Map(ingredients.map((i) => [i.id, i]));
    const calculatedRecipes = recipes.map((recipe) => ({
      recipe,
      cost: calculateRecipeCost(recipe, ingredientMap, settings),
    }));
    exportAllDataToExcel(ingredients, calculatedRecipes);
  };

  const handleRestore = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const jsonStr = ev.target?.result as string;
      const success = importDataFromJSON(jsonStr);
      if (success) {
        onReloadAllData();
        alert('Backup restaurado com sucesso!');
      } else {
        alert('Falha ao restaurar arquivo JSON de backup.');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div id="settings-view-container" className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-stone-900 flex items-center gap-2">
            <Settings className="w-5 h-5 text-amber-600" />
            Configurações do Sistema
          </h2>
          <p className="text-xs text-stone-500 mt-0.5">
            Ajuste parâmetros financeiros padrão, categorias e gestão de backup.
          </p>
        </div>
      </div>

      {successMsg && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>{successMsg}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Company and Defaults */}
        <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-xs space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-stone-700 pb-2 border-b border-stone-200 flex items-center gap-2">
            <Building className="w-4 h-4 text-amber-600" />
            <span>Dados da Confeitaria & Parâmetros Financeiros Padrão</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Nome da Confeitaria / Empresa
              </label>
              <input
                type="text"
                value={formData.companyName}
                onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-stone-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Moeda do Sistema
              </label>
              <input
                type="text"
                value={formData.currencySymbol}
                disabled
                className="w-full px-3 py-2 text-sm border border-stone-300 rounded-lg bg-stone-100 font-bold"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Markup Padrão (Multiplicador de Custo)
              </label>
              <input
                type="number"
                step="0.1"
                min="1"
                value={formData.defaultMarkup}
                onChange={(e) =>
                  setFormData({ ...formData, defaultMarkup: parseFloat(e.target.value) || 1 })
                }
                className="w-full px-3 py-2 text-sm border border-stone-300 rounded-lg font-mono font-bold"
              />
              <span className="text-[11px] text-stone-500 mt-1 block">
                Aplicado automaticamente em novas fichas técnicas (ex: 3.0 = Custo × 3)
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Meta Padrão de Margem de Lucro (%)
              </label>
              <input
                type="number"
                step="1"
                min="1"
                max="99"
                value={formData.defaultTargetMargin}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    defaultTargetMargin: parseFloat(e.target.value) || 0,
                  })
                }
                className="w-full px-3 py-2 text-sm border border-stone-300 rounded-lg font-mono font-bold"
              />
              <span className="text-[11px] text-stone-500 mt-1 block">
                Percentual mínimo desejado sobre a venda (ex: 40%)
              </span>
            </div>
          </div>
        </div>

        {/* Modelo financeiro */}
        <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-xs space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-stone-700 pb-2 border-b border-stone-200 flex items-center gap-2">
            <Percent className="w-4 h-4 text-amber-600" />
            <span>Modelo Financeiro</span>
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {(['debito', 'credito', 'pix', 'outro'] as SaleMethod[]).map((m) => (
              <div key={m}>
                <label className="block text-xs font-semibold text-stone-700 mb-1">Taxa {SALE_METHOD_LABELS[m]} (%)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={fin.cardFees[m]}
                  onChange={(e) => setFin({ ...fin, cardFees: { ...fin.cardFees, [m]: parseFloat(e.target.value) || 0 } })}
                  className="w-full px-3 py-2 text-sm border border-stone-300 rounded-lg font-mono"
                />
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">Meta diária mínima (R$)</label>
              <input
                type="number"
                step="50"
                min="0"
                value={fin.minDailyTarget}
                onChange={(e) => setFin({ ...fin, minDailyTarget: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 text-sm border border-stone-300 rounded-lg font-mono"
              />
              <span className="text-[11px] text-stone-500 mt-1 block">
                A meta do dia é o maior valor entre este piso e (saídas do mês ÷ dias abertos).
              </span>
            </div>
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">Lucro líquido desejado (%)</label>
              <input
                type="number"
                step="1"
                min="0"
                max="60"
                value={fin.targetProfitPct}
                onChange={(e) => setFin({ ...fin, targetProfitPct: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 text-sm border border-stone-300 rounded-lg font-mono"
              />
              <span className="text-[11px] text-stone-500 mt-1 block">Usado no markup sugerido pelo financeiro.</span>
            </div>
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">Dias de funcionamento</label>
              <div className="flex flex-wrap gap-1.5">
                {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, i) => {
                  const on = fin.openWeekdays.includes(i);
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() =>
                        setFin({
                          ...fin,
                          openWeekdays: on ? fin.openWeekdays.filter((x) => x !== i) : [...fin.openWeekdays, i].sort(),
                        })
                      }
                      className={`w-8 h-8 rounded-full text-xs font-medium ${on ? 'bg-amber-500 text-white' : 'bg-stone-100 text-stone-500'}`}
                    >
                      {d}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Categories Manager */}
        <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-xs space-y-6">
          <h3 className="text-xs font-bold uppercase tracking-wider text-stone-700 pb-2 border-b border-stone-200 flex items-center gap-2">
            <Layers className="w-4 h-4 text-amber-600" />
            <span>Gerenciamento de Categorias</span>
          </h3>

          {/* Insumo Categories */}
          <div className="space-y-3">
            <label className="block text-xs font-semibold text-stone-700">
              Categorias de Insumos ({formData.ingredientCategories.length})
            </label>
            <div className="flex flex-wrap gap-2">
              {formData.ingredientCategories.map((cat) => (
                <span
                  key={cat}
                  className="inline-flex items-center gap-1 px-3 py-1 bg-stone-100 border border-stone-200 rounded-lg text-xs font-medium text-stone-800"
                >
                  <span>{cat}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveIngCategory(cat)}
                    className="text-stone-400 hover:text-rose-600 ml-1"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>

            <div className="flex gap-2 max-w-md pt-1">
              <input
                type="text"
                placeholder="Nova categoria de insumo..."
                value={newIngCat}
                onChange={(e) => setNewIngCat(e.target.value)}
                className="flex-1 px-3 py-1.5 text-xs border border-stone-300 rounded-lg"
              />
              <button
                type="button"
                onClick={handleAddIngCategory}
                className="px-3 py-1.5 bg-stone-800 hover:bg-stone-900 text-white rounded-lg text-xs font-semibold"
              >
                Adicionar
              </button>
            </div>
          </div>

          {/* Product Categories */}
          <div className="space-y-3 pt-4 border-t border-stone-100">
            <label className="block text-xs font-semibold text-stone-700">
              Categorias de Produtos / Receitas ({formData.productCategories.length})
            </label>
            <div className="flex flex-wrap gap-2">
              {formData.productCategories.map((cat) => (
                <span
                  key={cat}
                  className="inline-flex items-center gap-1 px-3 py-1 bg-amber-50 border border-amber-200 rounded-lg text-xs font-medium text-amber-900"
                >
                  <span>{cat}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveProdCategory(cat)}
                    className="text-amber-500 hover:text-rose-600 ml-1"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>

            <div className="flex gap-2 max-w-md pt-1">
              <input
                type="text"
                placeholder="Nova categoria de produto..."
                value={newProdCat}
                onChange={(e) => setNewProdCat(e.target.value)}
                className="flex-1 px-3 py-1.5 text-xs border border-stone-300 rounded-lg"
              />
              <button
                type="button"
                onClick={handleAddProdCategory}
                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold"
              >
                Adicionar
              </button>
            </div>
          </div>

          {/* Expense Categories */}
          <div className="space-y-3 pt-4 border-t border-stone-100">
            <label className="block text-xs font-semibold text-stone-700">
              Categorias de Despesa — Financeiro ({formData.expenseCategories.length})
            </label>
            <div className="flex flex-wrap gap-2">
              {formData.expenseCategories.map((cat) => (
                <span
                  key={cat}
                  className="inline-flex items-center gap-1 px-3 py-1 bg-rose-50 border border-rose-200 rounded-lg text-xs font-medium text-rose-900"
                >
                  <span>{cat}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveExpCategory(cat)}
                    className="text-rose-500 hover:text-rose-700 ml-1"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>

            <div className="flex gap-2 max-w-md pt-1">
              <input
                type="text"
                placeholder="Nova categoria de despesa..."
                value={newExpCat}
                onChange={(e) => setNewExpCat(e.target.value)}
                className="flex-1 px-3 py-1.5 text-xs border border-stone-300 rounded-lg"
              />
              <button
                type="button"
                onClick={handleAddExpCategory}
                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold"
              >
                Adicionar
              </button>
            </div>
          </div>
        </div>

        {/* Save button for settings */}
        <div className="flex justify-end">
          <button
            id="btn-save-settings"
            type="submit"
            className="flex items-center gap-1.5 px-6 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors"
          >
            <Save className="w-4 h-4" />
            <span>Salvar Configurações</span>
          </button>
        </div>
      </form>

      {/* Backup and Restore Section */}
      <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-xs space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-stone-700 pb-2 border-b border-stone-200">
          Segurança, Backup & Restauração de Dados
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <button
            id="btn-export-backup"
            type="button"
            onClick={handleBackup}
            className="p-4 rounded-xl border border-stone-200 hover:border-amber-300 bg-stone-50 hover:bg-stone-100/80 text-left transition-all space-y-1"
          >
            <Download className="w-5 h-5 text-amber-600" />
            <h4 className="font-bold text-xs text-stone-900">Baixar Backup Completo</h4>
            <p className="text-[11px] text-stone-500">
              Arquivo JSON com insumos, fichas, histórico de preços, vendas e despesas.
            </p>
          </button>

          <button
            id="btn-export-excel-all"
            type="button"
            onClick={handleExportExcelAll}
            className="p-4 rounded-xl border border-stone-200 hover:border-emerald-300 bg-stone-50 hover:bg-emerald-50/50 text-left transition-all space-y-1"
          >
            <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
            <h4 className="font-bold text-xs text-stone-900">Exportar Tudo (Excel)</h4>
            <p className="text-[11px] text-stone-500">
              Um único .xlsx com abas de Insumos, resumo de Fichas Técnicas e detalhamento por insumo.
            </p>
          </button>

          <label
            id="btn-restore-backup"
            className="p-4 rounded-xl border border-stone-200 hover:border-amber-300 bg-stone-50 hover:bg-stone-100/80 text-left transition-all space-y-1 cursor-pointer block"
          >
            <input type="file" accept=".json" onChange={handleRestore} className="hidden" />
            <Upload className="w-5 h-5 text-blue-600" />
            <h4 className="font-bold text-xs text-stone-900">Restaurar Backup JSON</h4>
            <p className="text-[11px] text-stone-500">
              Restaura o catálogo (insumos, fichas e histórico). Não altera os lançamentos financeiros.
            </p>
          </label>

        </div>
      </div>
    </div>
  );
};
