import React, { useState, useRef } from 'react';
import {
  Sparkles,
  FileText,
  Upload,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  RefreshCw,
  Plus,
  Layers,
  HelpCircle,
  Clock,
  ChefHat,
  Flame,
  FileCode,
  FileUp,
} from 'lucide-react';
import { Ingredient, Recipe, UnitType, SystemSettings } from '../../types';
import {
  extractTextFromDocFile,
  parseRecipeTextFallback,
  calculateStringSimilarity,
} from '../../utils/fileParser';
import {
  UNIT_LABELS,
  UNIT_SHORT_LABELS,
  formatCurrency,
  normalizeQuantityAndUnit,
  calculateIngredientCost,
} from '../../utils/conversions';

interface ImportRecipeAIViewProps {
  ingredients: Ingredient[];
  settings: SystemSettings;
  onRecipeImported: (
    newRecipe: Omit<Recipe, 'id' | 'createdAt' | 'updatedAt'>,
    newIngredientsToCreate?: (Omit<Ingredient, 'id' | 'createdAt' | 'updatedAt'> & { tempId: string })[]
  ) => void;
  onCancel: () => void;
}

interface MappedImportIngredient {
  originalText: string;
  mappedIngredientId: string | 'NEW_INGREDIENT';
  quantity: number;
  unit: UnitType;
  confidence: 'exact' | 'fuzzy' | 'new';
  // If creating new ingredient
  newIngredientName?: string;
  newPackageQuantity?: number;
  newPackageUnit?: UnitType;
  newPurchasePrice?: number;
  newCategory?: string;
}

export const ImportRecipeAIView: React.FC<ImportRecipeAIViewProps> = ({
  ingredients,
  settings,
  onRecipeImported,
  onCancel,
}) => {
  const [step, setStep] = useState<'upload' | 'review'>('upload');
  const [rawText, setRawText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [fileName, setFileName] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Review screen state
  const [recipeName, setRecipeName] = useState('');
  const [category, setCategory] = useState(settings.productCategories[0] || 'Bolos');
  const [code, setCode] = useState('');
  const [yieldAmount, setYieldAmount] = useState<number>(1);
  const [yieldUnit, setYieldUnit] = useState('unidade');
  const [prepTimeMinutes, setPrepTimeMinutes] = useState<number | undefined>(30);
  const [ovenTimeMinutes, setOvenTimeMinutes] = useState<number | undefined>(40);
  const [ovenTemperatureCelsius, setOvenTemperatureCelsius] = useState<number | undefined>(180);
  const [instructions, setInstructions] = useState('');
  const [mappedIngredients, setMappedIngredients] = useState<MappedImportIngredient[]>([]);

  const ingredientMap = new Map<string, Ingredient>(ingredients.map((i) => [i.id, i]));

  // Handle document upload (.docx, .doc, .txt)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setIsProcessing(true);
    setErrorMessage(null);

    // Este sistema não tem um leitor de PDF de verdade (não há biblioteca de
    // extração de texto de PDF no projeto). Ler um PDF como texto puro geraria
    // apenas bytes binários ilegíveis — melhor avisar do que fingir que funcionou.
    if (file.name.toLowerCase().endsWith('.pdf')) {
      setErrorMessage(
        'Arquivos PDF ainda não são suportados nesta versão. Copie e cole o texto da receita diretamente, ou envie um .docx/.doc/.txt.'
      );
      setIsProcessing(false);
      return;
    }

    try {
      let textContent = '';
      if (file.name.endsWith('.docx') || file.name.endsWith('.doc')) {
        textContent = await extractTextFromDocFile(file);
      } else {
        textContent = await file.text();
      }

      setRawText(textContent);
      await processRecipeText(textContent);
    } catch (err: any) {
      console.error('Error reading document:', err);
      setErrorMessage(`Erro ao processar o arquivo: ${err.message}`);
      setIsProcessing(false);
    }
  };

  // Process text through AI or smart fallback
  const processRecipeText = async (text: string) => {
    setIsProcessing(true);
    setErrorMessage(null);

    try {
      // Interpretador local, sem IA nem chamada de rede — analisa o texto por
      // regras (seções, quantidades, unidades) direto no navegador.
      const parsedData = parseRecipeTextFallback(text);

      // Setup Review state
      setRecipeName(parsedData.name || 'Nova Receita Importada');
      setCategory(parsedData.category || settings.productCategories[0] || 'Bolos');
      setCode(`IMP-${Math.floor(100 + Math.random() * 900)}`);
      setYieldAmount(parsedData.yieldAmount || 1);
      setYieldUnit(parsedData.yieldUnit || 'unidade');
      setPrepTimeMinutes(parsedData.prepTimeMinutes || 30);
      setOvenTimeMinutes(parsedData.ovenTimeMinutes || 40);
      setOvenTemperatureCelsius(parsedData.ovenTemperatureCelsius || 180);
      setInstructions(parsedData.instructions || '');

      // Map parsed ingredients to existing catalog
      const mapped: MappedImportIngredient[] = (parsedData.ingredients || []).map((item: any) => {
        const rawIngName = (item.ingredientName || item.name || '').trim();
        // Rede de segurança: mesmo que o texto interpretado traga algo como
        // "colher de sopa" em vez de já converter para gramas, tratamos aqui —
        // ajustando quantidade + unidade juntos, nunca como "unidade" (contagem).
        const { quantity: rawQty, unit: rawUnit } = normalizeQuantityAndUnit(
          Number(item.quantity) || 1,
          String(item.unit || 'g')
        );

        // Try exact / high similarity match
        let bestMatch: Ingredient | null = null;
        let highestSim = 0;

        for (const existing of ingredients) {
          const sim = calculateStringSimilarity(rawIngName, existing.name);
          if (sim > highestSim) {
            highestSim = sim;
            bestMatch = existing;
          }
        }

        if (bestMatch && highestSim >= 0.85) {
          return {
            originalText: rawIngName,
            mappedIngredientId: bestMatch.id,
            quantity: rawQty,
            unit: rawUnit,
            confidence: 'exact',
          };
        } else if (bestMatch && highestSim >= 0.5) {
          return {
            originalText: rawIngName,
            mappedIngredientId: bestMatch.id,
            quantity: rawQty,
            unit: rawUnit,
            confidence: 'fuzzy',
          };
        } else {
          // New ingredient needed
          return {
            originalText: rawIngName,
            mappedIngredientId: 'NEW_INGREDIENT',
            quantity: rawQty,
            unit: rawUnit,
            confidence: 'new',
            newIngredientName: rawIngName,
            newPackageQuantity: rawUnit === 'kg' || rawUnit === 'L' ? 1 : rawUnit === 'g' || rawUnit === 'ml' ? 1000 : 1,
            newPackageUnit: rawUnit === 'g' ? 'kg' : rawUnit === 'ml' ? 'L' : rawUnit,
            newPurchasePrice: 0,
            newCategory: settings.ingredientCategories[0] || 'Geral',
          };
        }
      });

      setMappedIngredients(mapped);
      setStep('review');
    } catch (err: any) {
      console.error('Error processing recipe text:', err);
      setErrorMessage(`Falha na interpretação da receita: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleMappedChange = (index: number, field: string, value: any) => {
    setMappedIngredients((prev) =>
      prev.map((row, idx) => {
        if (idx !== index) return row;

        if (field === 'mappedIngredientId') {
          if (value === 'NEW_INGREDIENT') {
            return {
              ...row,
              mappedIngredientId: 'NEW_INGREDIENT',
              confidence: 'new',
              newIngredientName: row.originalText,
              newPackageQuantity: 1,
              newPackageUnit: 'kg',
              newPurchasePrice: 0,
            };
          } else {
            return {
              ...row,
              mappedIngredientId: value,
              confidence: 'exact',
            };
          }
        }

        return { ...row, [field]: value };
      })
    );
  };

  const handleConfirmImport = () => {
    // 1. Gather any new ingredients to register. Each gets a tempId derived from
    // its row index in mappedIngredients — the SAME index used below to build the
    // recipe's ingredient line — so the two lists stay correctly linked even if the
    // user edited the suggested name during review.
    const newIngredientsToCreate: (Omit<Ingredient, 'id' | 'createdAt' | 'updatedAt'> & {
      tempId: string;
    })[] = [];

    mappedIngredients.forEach((m, idx) => {
      if (m.mappedIngredientId === 'NEW_INGREDIENT' && m.newIngredientName) {
        newIngredientsToCreate.push({
          tempId: `NEW_INGREDIENT_${idx}`,
          name: m.newIngredientName,
          category: m.newCategory || 'Geral',
          packageQuantity: m.newPackageQuantity || 1,
          packageUnit: m.newPackageUnit || 'kg',
          purchasePrice: m.newPurchasePrice || 0,
          active: true,
        });
      }
    });

    // 2. Build Recipe Object — new-ingredient lines point at the same tempId,
    // which App.tsx resolves to the real id right after creating each ingredient.
    const finalRecipeIngredients = mappedIngredients.map((m, idx) => ({
      id: `ing-${idx}`,
      ingredientId: m.mappedIngredientId === 'NEW_INGREDIENT' ? `NEW_INGREDIENT_${idx}` : m.mappedIngredientId,
      quantity: Number(m.quantity) || 1,
      unit: m.unit,
      notes: m.originalText ? `Original: ${m.originalText}` : undefined,
    }));

    const finalRecipe: Omit<Recipe, 'id' | 'createdAt' | 'updatedAt'> = {
      name: recipeName.trim() || 'Receita Importada',
      code: code.trim(),
      category,
      yieldAmount: Number(yieldAmount) || 1,
      yieldUnit: yieldUnit.trim() || 'unidade',
      ingredients: finalRecipeIngredients,
      instructions: instructions.trim(),
      prepTimeMinutes: prepTimeMinutes ? Number(prepTimeMinutes) : undefined,
      ovenTimeMinutes: ovenTimeMinutes ? Number(ovenTimeMinutes) : undefined,
      ovenTemperatureCelsius: ovenTemperatureCelsius ? Number(ovenTemperatureCelsius) : undefined,
      active: true,
      markup: settings.defaultMarkup || 3.0,
      targetMarginPercentage: settings.defaultTargetMargin || 40,
    };

    onRecipeImported(finalRecipe, newIngredientsToCreate);
  };

  const loadSampleText = (sampleType: 'cenoura' | 'brownie') => {
    if (sampleType === 'cenoura') {
      const sample = `BOLO DE CENOURA COM COBERTURA DE BRIGADEIRO

Rendimento: 12 fatias
Tempo de Preparo: 25 minutos
Tempo de Forno: 40 minutos a 180°C

Ingredientes da Massa:
- 250g de farinha de arroz
- 200g de açúcar refinado
- 100g de cacau em pó 50%
- 3 ovos inteiros
- 120ml de óleo de girassol
- 10g de fermento em pó

Modo de Preparo:
1. Bata no liquidificador as cenouras, os ovos e o óleo até ficar homogêneo.
2. Em um bowl, misture a farinha e o açúcar.
3. Despeje o líquido e mexa delicadamente com um fouet.
4. Adicione o fermento e asse em forno pré-aquecido a 180°C por 40 minutos.`;
      setRawText(sample);
      processRecipeText(sample);
    } else {
      const sample = `PÃO DE MEL GOURMET ARTESANAL

Rendimento: 20 unidades
Validade: 15 dias

Ingredientes:
- 300g de farinha de trigo especial
- 150g de açúcar mascavo
- 50g de cacau em pó 50%
- 200ml de leite integral
- 80g de mel silvestre puro
- 5g de canela em pó
- 5g de cravo em pó
- 400g de chocolate meio amargo para banhar

Modo de Preparo:
Misture todos os ingredientes secos, adicione os líquidos e asse em forminhas individuais a 180°C por 20 minutos. Deixe esfriar e banhe no chocolate temperado.`;
      setRawText(sample);
      processRecipeText(sample);
    }
  };

  return (
    <div id="import-recipe-ai-container" className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-emerald-100 text-emerald-800">
              <Sparkles className="w-5 h-5" />
            </span>
            <h2 className="text-xl font-bold text-gray-900">
              Importação Inteligente de Receitas
            </h2>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Envie arquivos Word (.DOCX, .DOC), texto (.TXT) ou cole o texto livre da receita. O sistema extrai ingredientes, quantidades e modo de preparo automaticamente.
          </p>
        </div>

        <button
          onClick={onCancel}
          className="px-4 py-2 bg-white hover:bg-gray-50 text-gray-700 rounded-lg text-xs font-semibold border border-gray-200 shadow-2xs self-start sm:self-auto transition-colors"
        >
          Voltar às Fichas
        </button>
      </div>

      {errorMessage && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-900 text-xs flex items-center gap-2 font-medium">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Step 1: Upload or Paste */}
      {step === 'upload' ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* File Upload Box */}
            <div className="bg-white rounded-2xl border-2 border-dashed border-stone-300 hover:border-amber-500 p-8 text-center transition-all shadow-xs flex flex-col items-center justify-center space-y-4">
              <input
                ref={fileInputRef}
                type="file"
                accept=".docx,.doc,.txt"
                onChange={handleFileUpload}
                className="hidden"
              />

              <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <Upload className="w-7 h-7" />
              </div>

              <div>
                <h3 className="text-base font-bold text-stone-900">
                  Carregar Documento de Receita
                </h3>
                <p className="text-xs text-stone-500 mt-1">
                  Formatos aceitos: Microsoft Word (.docx, .doc), Texto (.txt)
                </p>
              </div>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isProcessing}
                className="px-5 py-2.5 bg-stone-900 hover:bg-stone-800 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors flex items-center gap-2"
              >
                <FileText className="w-4 h-4" />
                <span>{isProcessing ? 'Lendo Arquivo...' : 'Selecionar Arquivo .DOCX'}</span>
              </button>
            </div>

            {/* Paste Raw Text Box */}
            <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-xs flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-bold text-stone-900 flex items-center gap-2">
                    <FileCode className="w-4 h-4 text-amber-600" />
                    Ou Cole o Texto da Receita
                  </h3>
                  <span className="text-[11px] text-stone-400">Texto livre desestruturado</span>
                </div>

                <textarea
                  rows={8}
                  placeholder="Cole aqui o texto da sua receita (ex: ingredientes, rendimento, modo de preparo)..."
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  className="w-full p-3 text-xs border border-stone-300 rounded-xl focus:ring-2 focus:ring-amber-500 font-sans"
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                {/* Sample Buttons */}
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-stone-400 text-[11px]">Exemplos:</span>
                  <button
                    type="button"
                    onClick={() => loadSampleText('cenoura')}
                    className="text-[11px] text-amber-700 hover:underline font-medium"
                  >
                    Bolo Cenoura
                  </button>
                  <span>•</span>
                  <button
                    type="button"
                    onClick={() => loadSampleText('brownie')}
                    className="text-[11px] text-amber-700 hover:underline font-medium"
                  >
                    Pão de Mel
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => processRecipeText(rawText)}
                  disabled={isProcessing || !rawText.trim()}
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-200" />
                  <span>{isProcessing ? 'Interpretando...' : 'Interpretar Texto'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Step 2: MANDATORY REVIEW SCREEN (TELA DE REVISÃO OBRIGATÓRIA) */
        <div className="space-y-6">
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3 text-xs text-amber-950">
            <CheckCircle2 className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-sm">Etapa Obrigatória de Conferência & Vínculo</h4>
              <p className="mt-0.5 text-amber-900 leading-relaxed">
                Revise os dados extraídos automaticamente. Verifique os ingredientes correspondentes no banco central ou cadastre novos insumos diretamente na tabela abaixo antes de confirmar.
              </p>
            </div>
          </div>

          {/* Recipe Metadata Form */}
          <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-xs space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-stone-700 pb-2 border-b border-stone-200">
              Dados Gerais da Ficha Técnica
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Nome do Produto *
                </label>
                <input
                  type="text"
                  value={recipeName}
                  onChange={(e) => setRecipeName(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-stone-300 rounded-lg font-bold text-stone-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Categoria
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-stone-300 rounded-lg bg-white"
                >
                  {settings.productCategories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 p-4 bg-stone-50 rounded-xl border border-stone-200">
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Rendimento *
                </label>
                <input
                  type="number"
                  step="any"
                  value={yieldAmount}
                  onChange={(e) => setYieldAmount(parseFloat(e.target.value) || 1)}
                  className="w-full px-3 py-1.5 text-sm font-bold font-mono border border-stone-300 rounded-lg bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Unidade de Rendimento
                </label>
                <input
                  type="text"
                  value={yieldUnit}
                  onChange={(e) => setYieldUnit(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm border border-stone-300 rounded-lg bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Preparo (min)
                </label>
                <input
                  type="number"
                  value={prepTimeMinutes || ''}
                  onChange={(e) => setPrepTimeMinutes(parseInt(e.target.value) || undefined)}
                  className="w-full px-3 py-1.5 text-sm border border-stone-300 rounded-lg bg-white font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Forno (min / °C)
                </label>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    placeholder="min"
                    value={ovenTimeMinutes || ''}
                    onChange={(e) => setOvenTimeMinutes(parseInt(e.target.value) || undefined)}
                    className="w-16 px-2 py-1.5 text-xs border border-stone-300 rounded-lg bg-white font-mono"
                  />
                  <input
                    type="number"
                    placeholder="°C"
                    value={ovenTemperatureCelsius || ''}
                    onChange={(e) =>
                      setOvenTemperatureCelsius(parseInt(e.target.value) || undefined)
                    }
                    className="w-16 px-2 py-1.5 text-xs border border-stone-300 rounded-lg bg-white font-mono"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Mapped Ingredients Table */}
          <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-stone-200">
              <h3 className="text-xs font-bold uppercase tracking-wider text-stone-700 flex items-center gap-2">
                <Layers className="w-4 h-4 text-amber-600" />
                <span>Vínculo com o Cadastro Central de Insumos ({mappedIngredients.length} itens)</span>
              </h3>
            </div>

            <div className="border border-stone-200 rounded-xl overflow-hidden shadow-2xs">
              <table className="w-full text-left text-xs">
                <thead className="bg-stone-100 text-stone-700 font-semibold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="p-3">Texto no Documento</th>
                    <th className="p-3">Insumo Vinculado no Banco</th>
                    <th className="p-3 w-24 text-right">Qtd.</th>
                    <th className="p-3 w-28">Unidade</th>
                    <th className="p-3 text-center">Status</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-stone-200">
                  {mappedIngredients.map((item, idx) => {
                    const isNew = item.mappedIngredientId === 'NEW_INGREDIENT';
                    const ing = ingredientMap.get(item.mappedIngredientId);

                    return (
                      <React.Fragment key={idx}>
                        <tr className="hover:bg-stone-50">
                          {/* Original Text */}
                          <td className="p-3 font-medium text-stone-800">
                            {item.originalText}
                          </td>

                          {/* Mapped Ingredient Select */}
                          <td className="p-3">
                            <select
                              value={item.mappedIngredientId}
                              onChange={(e) =>
                                handleMappedChange(idx, 'mappedIngredientId', e.target.value)
                              }
                              className={`w-full px-2.5 py-1.5 text-xs border rounded-lg font-medium ${
                                isNew
                                  ? 'border-blue-300 bg-blue-50 text-blue-900 font-bold'
                                  : 'border-stone-300 bg-white text-stone-900'
                              }`}
                            >
                              <option value="NEW_INGREDIENT">
                                ➕ Criar Novo Insumo: "{item.originalText}"
                              </option>
                              <optgroup label="Insumos Cadastrados">
                                {ingredients.map((ingItem) => (
                                  <option key={ingItem.id} value={ingItem.id}>
                                    {ingItem.name} {ingItem.brand ? `(${ingItem.brand})` : ''} - {formatCurrency(ingItem.purchasePrice)}/{ingItem.packageQuantity}{ingItem.packageUnit}
                                  </option>
                                ))}
                              </optgroup>
                            </select>
                          </td>

                          {/* Quantity */}
                          <td className="p-3 text-right">
                            <input
                              type="number"
                              step="any"
                              value={item.quantity}
                              onChange={(e) =>
                                handleMappedChange(
                                  idx,
                                  'quantity',
                                  parseFloat(e.target.value) || 0
                                )
                              }
                              className="w-full px-2 py-1 text-xs text-right font-mono font-bold border border-stone-300 rounded-md bg-white"
                            />
                          </td>

                          {/* Unit */}
                          <td className="p-3">
                            <select
                              value={item.unit}
                              onChange={(e) =>
                                handleMappedChange(idx, 'unit', e.target.value as UnitType)
                              }
                              className="w-full px-2 py-1 text-xs border border-stone-300 rounded-md bg-white"
                            >
                              {Object.entries(UNIT_LABELS).map(([unitKey, label]) => (
                                <option key={unitKey} value={unitKey}>
                                  {label}
                                </option>
                              ))}
                            </select>
                          </td>

                          {/* Status Badge */}
                          <td className="p-3 text-center">
                            {item.confidence === 'exact' ? (
                              <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-semibold">
                                Vínculo Exato
                              </span>
                            ) : item.confidence === 'fuzzy' ? (
                              <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-semibold">
                                Aproximado
                              </span>
                            ) : (
                              <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 font-semibold">
                                Novo Insumo
                              </span>
                            )}
                          </td>
                        </tr>

                        {/* Inline Form if New Ingredient is being created */}
                        {isNew && (
                          <tr className="bg-blue-50/50">
                            <td colSpan={5} className="p-3 border-t border-blue-100">
                              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                                <div>
                                  <label className="block text-[11px] font-semibold text-blue-950 mb-1">
                                    Nome do Novo Insumo:
                                  </label>
                                  <input
                                    type="text"
                                    value={item.newIngredientName || ''}
                                    onChange={(e) =>
                                      handleMappedChange(idx, 'newIngredientName', e.target.value)
                                    }
                                    className="w-full px-2 py-1 bg-white border border-blue-300 rounded-md"
                                  />
                                </div>

                                <div>
                                  <label className="block text-[11px] font-semibold text-blue-950 mb-1">
                                    Embalagem Compra:
                                  </label>
                                  <div className="flex gap-1">
                                    <input
                                      type="number"
                                      value={item.newPackageQuantity || 1}
                                      onChange={(e) =>
                                        handleMappedChange(
                                          idx,
                                          'newPackageQuantity',
                                          parseFloat(e.target.value) || 1
                                        )
                                      }
                                      className="w-16 px-2 py-1 bg-white border border-blue-300 rounded-md font-mono"
                                    />
                                    <select
                                      value={item.newPackageUnit || 'kg'}
                                      onChange={(e) =>
                                        handleMappedChange(idx, 'newPackageUnit', e.target.value)
                                      }
                                      className="flex-1 px-2 py-1 bg-white border border-blue-300 rounded-md"
                                    >
                                      {Object.entries(UNIT_LABELS).map(([k, l]) => (
                                        <option key={k} value={k}>
                                          {l}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                </div>

                                <div>
                                  <label className="block text-[11px] font-semibold text-blue-950 mb-1">
                                    Preço Pago (R$):
                                  </label>
                                  <input
                                    type="number"
                                    step="0.01"
                                    placeholder="0,00"
                                    value={item.newPurchasePrice || ''}
                                    onChange={(e) =>
                                      handleMappedChange(
                                        idx,
                                        'newPurchasePrice',
                                        parseFloat(e.target.value) || 0
                                      )
                                    }
                                    className="w-full px-2 py-1 bg-white border border-blue-300 rounded-md font-mono font-bold"
                                  />
                                </div>

                                <div>
                                  <label className="block text-[11px] font-semibold text-blue-950 mb-1">
                                    Categoria Insumo:
                                  </label>
                                  <select
                                    value={item.newCategory || 'Geral'}
                                    onChange={(e) =>
                                      handleMappedChange(idx, 'newCategory', e.target.value)
                                    }
                                    className="w-full px-2 py-1 bg-white border border-blue-300 rounded-md"
                                  >
                                    {settings.ingredientCategories.map((c) => (
                                      <option key={c} value={c}>
                                        {c}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Instructions */}
          <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-xs space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-stone-700">
              Modo de Preparo Extraído
            </h3>
            <textarea
              rows={4}
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              className="w-full p-3 text-xs border border-stone-300 rounded-xl"
            />
          </div>

          {/* Review Confirmation Buttons */}
          <div className="flex items-center justify-between p-4 bg-stone-100 rounded-2xl border border-stone-200">
            <button
              type="button"
              onClick={() => setStep('upload')}
              className="px-4 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-200 rounded-lg transition-colors"
            >
              Voltar ao Upload
            </button>

            <button
              id="btn-confirm-import-recipe"
              type="button"
              onClick={handleConfirmImport}
              className="flex items-center gap-2 px-6 py-2.5 text-xs font-semibold bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl shadow-xs transition-colors"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Confirmar e Cadastrar Ficha no Sistema</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
