import React, { useState, useRef } from 'react';
import {
  X,
  FileSpreadsheet,
  Upload,
  AlertTriangle,
  Check,
  Download,
  AlertCircle,
} from 'lucide-react';
import { Ingredient, UnitType, SystemSettings } from '../../types';
import { parseSpreadsheetFile, exportDataToExcel, calculateStringSimilarity } from '../../utils/fileParser';
import { parsePackageSizeString, normalizeUnitStrict, formatCurrency } from '../../utils/conversions';

interface ImportIngredientsModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingIngredients: Ingredient[];
  settings: SystemSettings;
  onImportConfirmed: (newIngredients: Omit<Ingredient, 'id' | 'createdAt' | 'updatedAt'>[]) => void;
}

interface ParsedImportRow {
  name: string;
  category: string;
  brand: string;
  packageQuantity: number;
  packageUnit: UnitType;
  purchasePrice: number;
  supplier: string;
  notes: string;
  duplicateWarning?: string;
  unitWarning?: string;
  selected: boolean;
}

export const ImportIngredientsModal: React.FC<ImportIngredientsModalProps> = ({
  isOpen,
  onClose,
  existingIngredients,
  settings,
  onImportConfirmed,
}) => {
  const [parsedRows, setParsedRows] = useState<ParsedImportRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setError(null);
    setFileName(file.name);

    try {
      const { headers, rows } = await parseSpreadsheetFile(file);

      if (rows.length === 0) {
        setError('A planilha enviada está vazia ou não contém dados válidos.');
        setIsLoading(false);
        return;
      }

      // Map rows with smart column detection
      const mappedRows: ParsedImportRow[] = rows.map((r) => {
        // Find key by fuzzy header
        const findVal = (keywords: string[]) => {
          for (const key of Object.keys(r)) {
            const lower = key.toLowerCase();
            if (keywords.some((kw) => lower.includes(kw))) {
              return r[key];
            }
          }
          return '';
        };

        const rawName = String(findVal(['nome', 'insumo', 'ingrediente', 'item', 'descrição']) || Object.values(r)[0] || '').trim();
        const rawBrand = String(findVal(['marca', 'fabricante']) || '').trim();
        const rawCategory = String(findVal(['categoria', 'tipo', 'grupo']) || settings.ingredientCategories[0] || 'Geral').trim();
        const rawPrice = parseFloat(String(findVal(['preço', 'preco', 'valor', 'custo']) || '0').replace('R$', '').replace(/\s+/g, '').replace(',', '.')) || 0;
        const rawSupplier = String(findVal(['fornecedor']) || '').trim();
        const rawNotes = String(findVal(['observação', 'obs', 'detalhes']) || '').trim();

        // Muitas planilhas reais (como a sua) não têm uma coluna separada de
        // "quantidade" — a embalagem vem tudo junto em uma única coluna
        // "Unidade", ex: "5 kg", "907 gramas", "1kg". Se existir uma coluna de
        // quantidade separada, ela tem prioridade; senão, tentamos separar a
        // quantidade de dentro do próprio texto da unidade.
        const separateQtyRaw = findVal(['quantidade', 'qtd', 'peso', 'embalagem']);
        const unitCellRaw = String(findVal(['unidade', 'unid', 'medida']) || '');

        let packageQuantity: number;
        let packageUnit: UnitType;
        let unitRecognized: boolean;
        let unitForWarning: string;

        if (separateQtyRaw !== '' && separateQtyRaw !== undefined && separateQtyRaw !== null) {
          const parsedQty = parseFloat(String(separateQtyRaw).replace(',', '.'));
          const strictResult = normalizeUnitStrict(unitCellRaw);
          packageQuantity = !isNaN(parsedQty) && parsedQty > 0 ? parsedQty : 1;
          packageUnit = strictResult.unit;
          unitRecognized = strictResult.recognized;
          unitForWarning = unitCellRaw;
        } else {
          const combined = parsePackageSizeString(unitCellRaw);
          packageQuantity = combined.quantity;
          packageUnit = combined.unit;
          unitRecognized = combined.recognized;
          unitForWarning = unitCellRaw;
        }

        // Check for duplicates with existing ingredients
        let duplicateWarning: string | undefined = undefined;
        for (const existing of existingIngredients) {
          const sim = calculateStringSimilarity(rawName, existing.name);
          if (sim >= 0.8) {
            duplicateWarning = `Possível duplicata de "${existing.name}" (Preço atual: ${formatCurrency(existing.purchasePrice)})`;
            break;
          }
        }

        return {
          name: rawName,
          category: rawCategory,
          brand: rawBrand,
          packageQuantity,
          packageUnit,
          purchasePrice: rawPrice,
          supplier: rawSupplier,
          notes: rawNotes,
          duplicateWarning,
          unitWarning: unitRecognized
            ? undefined
            : `Unidade "${unitForWarning}" não reconhecida — assumido "g" por padrão, confira antes de importar`,
          selected: true,
        };
      }).filter((r) => r.name.length > 0);

      setParsedRows(mappedRows);
    } catch (err: any) {
      console.error('Error parsing spreadsheet:', err);
      setError(`Falha ao ler arquivo: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadTemplate = () => {
    const sampleData = [
      {
        'Nome do Insumo': 'Farinha de arroz',
        'Marca': 'Urbano',
        'Categoria': 'Farinhas e Amidos',
        'Qtd Embalagem': 1,
        'Unidade': 'kg',
        'Preço de Compra': 10.00,
        'Fornecedor': 'Distribuidora Alimentos',
        'Observações': 'Seco e fresco',
      },
      {
        'Nome do Insumo': 'Açúcar refinado',
        'Marca': 'União',
        'Categoria': 'Açúcares e Adoçantes',
        'Qtd Embalagem': 1,
        'Unidade': 'kg',
        'Preço de Compra': 5.00,
        'Fornecedor': 'Atacadão',
        'Observações': '',
      },
      {
        'Nome do Insumo': 'Cacau em pó 50%',
        'Marca': 'Harald',
        'Categoria': 'Chocolates e Cacau',
        'Qtd Embalagem': 500,
        'Unidade': 'g',
        'Preço de Compra': 20.00,
        'Fornecedor': 'ChocoMix',
        'Observações': 'Uso profissional',
      },
    ];
    exportDataToExcel('modelo_importacao_insumos_confeitaria', 'Modelo Insumos', sampleData);
  };

  const handleConfirm = () => {
    const selectedToImport = parsedRows
      .filter((r) => r.selected && r.name.trim().length > 0)
      .map((r) => ({
        name: r.name,
        category: r.category,
        brand: r.brand,
        packageQuantity: r.packageQuantity,
        packageUnit: r.packageUnit,
        purchasePrice: r.purchasePrice,
        supplier: r.supplier,
        notes: r.notes,
        active: true,
      }));

    onImportConfirmed(selectedToImport);
    onClose();
  };

  return (
    <div
      id="import-ingredients-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs"
    >
      <div
        id="import-ingredients-modal-container"
        className="bg-white rounded-2xl border border-stone-200 shadow-2xl max-w-3xl w-full overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="px-6 py-4 bg-stone-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <FileSpreadsheet className="w-5 h-5 text-amber-400" />
            <div>
              <h3 className="font-bold text-sm">Importar Planilha de Insumos</h3>
              <p className="text-xs text-stone-300">
                Suporte para Excel (.xlsx, .xls) e CSV com detecção de duplicidades.
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
        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Upload Area */}
          <div className="border-2 border-dashed border-stone-300 hover:border-amber-500 rounded-2xl p-6 text-center transition-colors bg-stone-50/50">
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileUpload}
              className="hidden"
            />

            <Upload className="w-10 h-10 mx-auto text-amber-600 mb-2" />
            <h4 className="font-bold text-sm text-stone-800">
              Selecione sua planilha de insumos
            </h4>
            <p className="text-xs text-stone-500 mt-1">
              Formatos aceitos: Excel (.xlsx, .xls) ou CSV (.csv)
            </p>

            <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 bg-stone-800 hover:bg-stone-900 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
              >
                {fileName ? `Trocar Arquivo (${fileName})` : 'Escolher Arquivo no Computador'}
              </button>

              <button
                type="button"
                onClick={handleDownloadTemplate}
                className="px-4 py-2 bg-white border border-stone-300 hover:bg-stone-100 text-stone-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                Baixar Planilha Modelo (.xlsx)
              </button>
            </div>
          </div>

          {/* Preview Table */}
          {parsedRows.length > 0 && (
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-stone-700">
                  Prévia para Conferência ({parsedRows.length} itens encontrados)
                </h4>
                <div className="text-xs text-stone-500">
                  {parsedRows.filter((r) => r.duplicateWarning).length} possíveis duplicidades detectadas
                </div>
              </div>

              <div className="border border-stone-200 rounded-xl overflow-hidden max-h-64 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-stone-100 text-stone-700 sticky top-0">
                    <tr>
                      <th className="p-2.5 w-10 text-center">
                        <input
                          type="checkbox"
                          checked={parsedRows.every((r) => r.selected)}
                          onChange={(e) =>
                            setParsedRows((prev) =>
                              prev.map((r) => ({ ...r, selected: e.target.checked }))
                            )
                          }
                          className="rounded-sm text-amber-600"
                        />
                      </th>
                      <th className="p-2.5">Nome do Insumo</th>
                      <th className="p-2.5">Categoria</th>
                      <th className="p-2.5">Embalagem</th>
                      <th className="p-2.5 text-right">Preço</th>
                      <th className="p-2.5">Avisos</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {parsedRows.map((row, idx) => (
                      <tr
                        key={idx}
                        className={`hover:bg-stone-50 ${
                          row.unitWarning ? 'bg-rose-50/50' : row.duplicateWarning ? 'bg-amber-50/50' : ''
                        }`}
                      >
                        <td className="p-2.5 text-center">
                          <input
                            type="checkbox"
                            checked={row.selected}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setParsedRows((prev) =>
                                prev.map((r, i) => (i === idx ? { ...r, selected: checked } : r))
                              );
                            }}
                            className="rounded-sm text-amber-600"
                          />
                        </td>
                        <td className="p-2.5 font-semibold text-stone-900">
                          {row.name}
                          {row.brand && (
                            <span className="text-[11px] text-stone-500 block font-normal">
                              Marca: {row.brand}
                            </span>
                          )}
                        </td>
                        <td className="p-2.5 text-stone-600">{row.category}</td>
                        <td className="p-2.5 text-stone-600 font-mono">
                          {row.packageQuantity} {row.packageUnit}
                        </td>
                        <td className="p-2.5 text-right font-bold font-mono text-stone-900">
                          {formatCurrency(row.purchasePrice)}
                        </td>
                        <td className="p-2.5 space-y-1">
                          {row.unitWarning && (
                            <span className="inline-flex items-center gap-1 text-[11px] text-rose-800 bg-rose-100 px-2 py-0.5 rounded-md font-medium">
                              <AlertCircle className="w-3 h-3 text-rose-600" />
                              {row.unitWarning}
                            </span>
                          )}
                          {row.duplicateWarning ? (
                            <span className="inline-flex items-center gap-1 text-[11px] text-amber-800 bg-amber-100 px-2 py-0.5 rounded-md font-medium">
                              <AlertTriangle className="w-3 h-3 text-amber-600" />
                              {row.duplicateWarning}
                            </span>
                          ) : (
                            !row.unitWarning && (
                              <span className="text-[11px] text-emerald-700 flex items-center gap-1">
                                <Check className="w-3 h-3" /> Novo
                              </span>
                            )
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-stone-50 border-t border-stone-200 flex items-center justify-between">
          <span className="text-xs text-stone-500">
            {parsedRows.filter((r) => r.selected).length} de {parsedRows.length} insumos selecionados
          </span>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-stone-600 hover:bg-stone-100 rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              id="btn-confirm-import-ingredients"
              type="button"
              onClick={handleConfirm}
              disabled={parsedRows.filter((r) => r.selected).length === 0}
              className="flex items-center gap-1.5 px-5 py-2 text-xs font-semibold bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-lg shadow-xs transition-colors"
            >
              <Check className="w-4 h-4" />
              <span>Confirmar Importação</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
