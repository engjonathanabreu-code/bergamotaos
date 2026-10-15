import { Ingredient, Recipe, CalculatedRecipeCost, UnitType } from '../types';
import { normalizeQuantityAndUnit } from './conversions';

// xlsx e mammoth são bibliotecas pesadas usadas só em ações específicas
// (importar/exportar planilha, ler .docx) — importadas dinamicamente aqui para
// não engordar o bundle inicial carregado por qualquer pessoa que só abre o
// sistema para consultar uma ficha técnica.

/**
 * Converte o HTML do mammoth.convertToHtml em texto simples, mas preservando
 * tabelas como uma linha por linha da tabela e células separadas por " | ".
 * O extractRawText do mammoth solta cada célula em um parágrafo próprio, o que
 * destrói a associação entre nome do insumo e sua quantidade/unidade quando a
 * ficha técnica está em formato de tabela (muito comum em .docx).
 */
function htmlToStructuredText(html: string): string {
  let text = html;

  // Remove o <p> "de dentro" de cada célula antes de tratar quebras de linha,
  // para não confundir fim de célula com fim de parágrafo.
  text = text.replace(/<t([dh])[^>]*>\s*<p[^>]*>/gi, '<t$1>');
  text = text.replace(/<\/p>\s*<\/t([dh])>/gi, '</t$1>');

  // Cada <tr> vira uma linha; células dentro da linha são unidas com " | "
  text = text.replace(/<tr[^>]*>/gi, '\n');
  text = text.replace(/<\/tr>/gi, '');
  // [ \t]* (não \s*) é importante aqui: \s* inclui quebra de linha, o que
  // "engoliria" a quebra de linha entre uma linha da tabela e a próxima
  // (inserida no passo anterior), juntando todas as linhas da tabela em uma só.
  text = text.replace(/<\/t[dh]>[ \t]*<t[dh][^>]*>/gi, ' | ');
  text = text.replace(/<t[dh][^>]*>/gi, '');
  text = text.replace(/<\/t[dh]>/gi, '');

  // Parágrafos e títulos fora de tabela viram uma linha cada
  text = text.replace(/<\/p>/gi, '\n');
  text = text.replace(/<\/h[1-6]>/gi, '\n');
  text = text.replace(/<br\s*\/?>/gi, '\n');

  // Listas de marcadores/numeradas (<ul>/<ol>/<li>) — o formato real das
  // fichas técnicas do Daniel. Sem isso, cada item da lista era removido sem
  // nenhuma quebra de linha, juntando TODOS os ingredientes em uma string só
  // (ex: "8 ovos400 ml de óleo de girassol400 g de cenoura"), o que fazia a
  // ficha técnica sair vazia ou sem sentido.
  text = text.replace(/<\/li>/gi, '\n');
  text = text.replace(/<li[^>]*>/gi, '');
  text = text.replace(/<\/?[uo]l[^>]*>/gi, '\n');

  // Remove qualquer tag restante (table, tbody, aberturas de p/h etc.)
  text = text.replace(/<[^>]+>/g, '');

  text = text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');

  return text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .join('\n');
}

export async function extractTextFromDocFile(file: File): Promise<string> {
  const extension = file.name.split('.').pop()?.toLowerCase();

  if (extension === 'docx') {
    const mammoth = (await import('mammoth')).default;
    const arrayBuffer = await file.arrayBuffer();

    let html;
    try {
      const result = await mammoth.convertToHtml({ arrayBuffer });
      html = result.value;
    } catch (err: any) {
      // NÃO cai para leitura de texto puro em cima do arquivo binário — um
      // .docx é um .zip por baixo, então isso geraria lixo em vez de um erro
      // compreensível (foi exatamente esse o bug: parecia "ficha técnica
      // vazia" porque o texto extraído virava bytes ilegíveis).
      throw new Error(
        `Não foi possível ler este .docx (${err?.message || 'arquivo corrompido ou em formato inesperado'}). Tente copiar e colar o texto da receita diretamente.`
      );
    }

    const structuredText = htmlToStructuredText(html);
    if (structuredText.trim().length > 0) {
      return structuredText;
    }

    // O mammoth rodou sem erro, mas não encontrou texto extraível — comum
    // quando o conteúdo está em caixas de texto, SmartArt, ou uma estrutura
    // que a extração não alcança.
    throw new Error(
      'O arquivo .docx foi lido, mas nenhum texto pôde ser extraído dele (o conteúdo pode estar em caixas de texto, imagens ou um formato incomum). Tente copiar e colar o texto da receita diretamente, ou me envie o arquivo para eu conferir o que está acontecendo.'
    );
  }

  if (extension === 'doc') {
    // .doc antigo (formato binário Word 97-2003) não é suportado pelo mammoth
    // nem por leitura de texto puro — mesma armadilha do .docx acima, só que
    // pior, porque nem tenta extrair nada hoje.
    throw new Error(
      'Arquivos .doc antigos (Word 97-2003) não são suportados. Salve como .docx no Word ("Salvar como" → .docx) ou copie e cole o texto da receita diretamente.'
    );
  }

  // .txt e outros arquivos de texto puro
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result;
      if (typeof content === 'string') {
        resolve(content);
      } else if (content instanceof ArrayBuffer) {
        const decoder = new TextDecoder('utf-8');
        resolve(decoder.decode(content));
      } else {
        resolve('');
      }
    };
    reader.onerror = (e) => reject(e);
    reader.readAsText(file);
  });
}

export interface SpreadsheetRow {
  [key: string]: any;
}

/**
 * Decodifica um CSV tentando UTF-8 primeiro; se o resultado tiver caracteres de
 * substituição (sinal de bytes inválidos em UTF-8), tenta Windows-1252 — a
 * codificação que o Excel/Windows usa por padrão ao salvar "CSV" sem escolher
 * explicitamente "CSV UTF-8". Sem isso, acentos (ç, ã, é, ú...) saem
 * corrompidos em qualquer planilha exportada dessa forma.
 */
function smartDecodeCsv(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);

  // BOM UTF-8 (EF BB BF): sinal explícito de que já é UTF-8 correto
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return new TextDecoder('utf-8').decode(bytes.slice(3));
  }

  const utf8Text = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  const hasReplacementChar = utf8Text.includes('\uFFFD');

  if (hasReplacementChar) {
    try {
      return new TextDecoder('windows-1252').decode(bytes);
    } catch {
      return utf8Text;
    }
  }

  return utf8Text;
}

export async function parseSpreadsheetFile(file: File): Promise<{
  headers: string[];
  rows: SpreadsheetRow[];
  sheetNames: string[];
}> {
  const XLSX = await import('xlsx');
  const isCsv = file.name.toLowerCase().endsWith('.csv');

  let workbook;
  if (isCsv) {
    const arrayBuffer = await file.arrayBuffer();
    const csvText = smartDecodeCsv(arrayBuffer);
    workbook = XLSX.read(csvText, { type: 'string' });
  } else {
    // .xlsx/.xls já carregam a própria codificação internamente (XML em UTF-8),
    // então o caminho binário original continua correto para esses formatos.
    const arrayBuffer = await file.arrayBuffer();
    workbook = XLSX.read(arrayBuffer, { type: 'array' });
  }

  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];
  
  const rawRows = XLSX.utils.sheet_to_json<any>(worksheet, { header: 1, defval: '' });
  
  if (rawRows.length === 0) {
    return { headers: [], rows: [], sheetNames: workbook.SheetNames };
  }

  // Find header row (first non-empty row)
  let headerIndex = 0;
  while (headerIndex < rawRows.length && (!rawRows[headerIndex] || rawRows[headerIndex].every((c: any) => !c))) {
    headerIndex++;
  }

  const rawHeaders: string[] = (rawRows[headerIndex] || []).map((h: any) => String(h || '').trim());
  const headers = rawHeaders.filter((h) => h.length > 0);

  const rows: SpreadsheetRow[] = [];
  for (let i = headerIndex + 1; i < rawRows.length; i++) {
    const rowArray = rawRows[i];
    if (!rowArray || rowArray.every((c: any) => c === '' || c === undefined || c === null)) continue;
    
    const rowObj: SpreadsheetRow = {};
    headers.forEach((header, colIdx) => {
      rowObj[header] = rowArray[colIdx];
    });
    rows.push(rowObj);
  }

  return {
    headers,
    rows,
    sheetNames: workbook.SheetNames,
  };
}

export async function exportDataToExcel(fileName: string, sheetName: string, data: any[]): Promise<void> {
  const XLSX = await import('xlsx');
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName || 'Dados');
  XLSX.writeFile(workbook, `${fileName}.xlsx`);
}

/**
 * Exporta TUDO em um único arquivo .xlsx com várias abas — Insumos, resumo de
 * Fichas Técnicas (uma linha por produto) e o detalhamento de insumos de cada
 * receita (uma linha por ingrediente usado), no espírito da planilha original
 * de precificação (uma aba por assunto, em vez de arquivos separados).
 */
export async function exportAllDataToExcel(
  ingredients: Ingredient[],
  calculatedRecipes: { recipe: Recipe; cost: CalculatedRecipeCost }[]
): Promise<void> {
  const XLSX = await import('xlsx');
  const workbook = XLSX.utils.book_new();

  // Aba 1: Insumos
  const insumosData = ingredients.map((i) => ({
    Insumo: i.name,
    Categoria: i.category,
    Marca: i.brand || '',
    'Preço (R$)': i.purchasePrice,
    'Qtd. Embalagem': i.packageQuantity,
    Unidade: i.packageUnit,
    'Densidade (g/ml)': i.densityGramsPerMl || '',
    Fornecedor: i.supplier || '',
    Ativo: i.active ? 'Sim' : 'Não',
  }));
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(insumosData), 'Insumos');

  // Aba 2: Fichas Técnicas — resumo (uma linha por produto)
  const resumoData = calculatedRecipes.map(({ recipe, cost }) => ({
    Produto: recipe.name,
    Categoria: recipe.category,
    Código: recipe.code || '',
    Rendimento: recipe.yieldAmount,
    'Unidade Rendimento': recipe.yieldUnit,
    'Custo por Unidade (R$)': Number(cost.costPerUnit.toFixed(2)),
    'Preço Praticado (R$)': recipe.practicedPrice || '',
    'Margem Real (%)': Number(cost.realMarginPercentage.toFixed(1)),
    'Markup Real': Number(cost.realMarkup.toFixed(2)),
    Status: cost.isIncomplete ? 'Incompleta' : 'OK',
    Ativa: recipe.active ? 'Sim' : 'Não',
  }));
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(resumoData), 'Fichas Técnicas - Resumo');

  // Aba 3: Detalhamento — uma linha por insumo usado em cada receita
  const detalheData: any[] = [];
  calculatedRecipes.forEach(({ recipe, cost }) => {
    cost.ingredientsBreakdown.forEach((item) => {
      detalheData.push({
        Produto: recipe.name,
        Insumo: item.ingredientName,
        Quantidade: item.quantity,
        Unidade: item.unit,
        'Custo (R$)': item.hasPrice ? Number(item.calculatedCost.toFixed(2)) : '',
        '% do Custo': item.hasPrice ? Number(item.costPercentageOfTotal.toFixed(1)) : '',
        Status: item.hasPrice ? 'OK' : item.error || 'Sem preço',
      });
    });
  });
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(detalheData), 'Fichas Técnicas - Detalhado');

  const now = new Date();
  const dataStr = now.toISOString().slice(0, 10);
  XLSX.writeFile(workbook, `confeitaria_pro_export_completo_${dataStr}.xlsx`);
}

/**
 * String similarity using Dice coefficient & Token matching
 */
export function calculateStringSimilarity(str1: string, str2: string): number {
  const s1 = normalizeString(str1);
  const s2 = normalizeString(str2);

  if (s1 === s2) return 1.0;
  if (s1.length === 0 || s2.length === 0) return 0.0;

  // Exact contains
  if (s1.includes(s2) || s2.includes(s1)) {
    const ratio = Math.min(s1.length, s2.length) / Math.max(s1.length, s2.length);
    return 0.8 + ratio * 0.2;
  }

  // Word token overlap
  const tokens1 = new Set(s1.split(/\s+/).filter((t) => t.length > 2));
  const tokens2 = new Set(s2.split(/\s+/).filter((t) => t.length > 2));

  let intersection = 0;
  tokens1.forEach((t) => {
    if (tokens2.has(t)) intersection++;
  });

  const union = new Set([...tokens1, ...tokens2]).size;
  if (union > 0) {
    const tokenScore = intersection / union;
    if (tokenScore >= 0.5) return 0.7 + tokenScore * 0.3;
  }

  // Character bigrams
  const getBigrams = (str: string) => {
    const bigrams = new Set<string>();
    for (let i = 0; i < str.length - 1; i++) {
      bigrams.add(str.slice(i, i + 2));
    }
    return bigrams;
  };

  const b1 = getBigrams(s1);
  const b2 = getBigrams(s2);
  let common = 0;
  b1.forEach((bg) => {
    if (b2.has(bg)) common++;
  });

  const total = b1.size + b2.size;
  return total > 0 ? (2 * common) / total : 0;
}

export function normalizeString(str: string): string {
  return (str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove accents
    .replace(/[^a-z0-9\s]/g, ' ') // remove special symbols
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Intelligent Fallback Recipe Parser from unstructured text
 */
export function parseRecipeTextFallback(text: string): {
  name: string;
  category: string;
  yieldAmount: number;
  yieldUnit: string;
  prepTimeMinutes?: number;
  ovenTimeMinutes?: number;
  ovenTemperatureCelsius?: number;
  ingredients: {
    ingredientName: string;
    quantity: number;
    unit: UnitType;
  }[];
  instructions: string;
} {
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  let name = 'Nova Receita';
  let yieldAmount = 1;
  let yieldUnit = 'unidade';
  let prepTimeMinutes: number | undefined;
  let ovenTimeMinutes: number | undefined;
  let ovenTemperatureCelsius: number | undefined;
  const ingredients: { ingredientName: string; quantity: number; unit: UnitType }[] = [];
  const instructionLines: string[] = [];

  let section: 'header' | 'ingredients' | 'instructions' = 'header';

  // First line is often title
  if (lines.length > 0) {
    name = lines[0].replace(/^#+\s*/, '').replace(/[:.]\s*$/, '').trim();
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lower = line.toLowerCase();
    const trimmedLine = line.trim();

    // Check yield
    if (lower.includes('rendimento') || lower.includes('rende')) {
      const match = line.match(/(?:rendimento|rende)[:\s]*([0-9.,]+)\s*([a-zA-Záéíóúãõç]+)?/i);
      if (match) {
        yieldAmount = parseFloat(match[1].replace(',', '.')) || 1;
        if (match[2]) yieldUnit = match[2].toLowerCase();
      }
      continue;
    }

    // Check oven / prep time
    if (lower.includes('tempo de preparo') || lower.includes('preparo:')) {
      const match = line.match(/([0-9]+)\s*(?:min|minutos)/i);
      if (match) prepTimeMinutes = parseInt(match[1]);
    }
    if (lower.includes('forno') || lower.includes('assar')) {
      const timeMatch = line.match(/([0-9]+)\s*(?:min|minutos)/i);
      if (timeMatch) ovenTimeMinutes = parseInt(timeMatch[1]);
      const tempMatch = line.match(/([0-9]+)\s*(?:°c|graus|c)/i);
      if (tempMatch) ovenTemperatureCelsius = parseInt(tempMatch[1]);
    }

    // Section triggers — checa INÍCIO da linha (não conteúdo em qualquer
    // lugar, que causava falso positivo em frases como "Misture os
    // ingredientes secos"), mas aceita variações como "Ingredientes Secos" ou
    // "Ingredientes Líquidos e Gorduras" (subseções reais, não just a palavra
    // sozinha).
    if (
      /^ingredientes?\b/i.test(trimmedLine) ||
      /^(massa|cobertura|recheio)\s*:/i.test(trimmedLine)
    ) {
      section = 'ingredients';
      continue;
    }

    if (
      /^(m[ée]todo de preparo|m[ée]todo|modo de preparo|modo de fazer|como fazer|instruç(?:ões|oes|ao|ão)|preparo|montagem)\b/i.test(
        trimmedLine
      )
    ) {
      section = 'instructions';
      continue;
    }

    // Muitas receitas em texto corrido nunca escrevem a palavra "Ingredientes:"
    // — a lista começa direto depois do título. Sem essa heurística, o parser
    // ficava esperando um gatilho de seção que nunca chegava, e a ficha
    // técnica saía sem nenhum ingrediente. Aqui, se a linha "parece" um
    // ingrediente (começa com número) e ainda não estamos no modo instruções,
    // tratamos como ingrediente mesmo sem cabeçalho explícito. Regex simples
    // de propósito: cobre tanto "200g Cenoura" quanto "8 ovos" (onde a
    // "unidade" já É o nome do ingrediente, sem texto depois dela).
    const looksLikeIngredientLine =
      section !== 'instructions' &&
      (line.includes('|') || /^[0-9]+(?:[,.][0-9]+)?\s*[a-zA-Zà-úÀ-Ú]/.test(line.trim()));

    if (section === 'ingredients' || looksLikeIngredientLine) {
      if (section === 'header') section = 'ingredients';
      // Line is an ingredient candidate
      // Remove marcadores de lista reais ("- ", "• ", "1. ", "2) ") sem tocar
      // em números de quantidade. A regex antiga era uma classe de caracteres
      // [-*•\d+.] que removia UM ÚNICO dígito de números como "190g" (virando
      // "90g"!), corrompendo silenciosamente toda quantidade de 2+ dígitos —
      // esse era o motivo real da ficha técnica sair com valores errados/vazios.
      const cleanLine = line.replace(/^(?:[-*•]\s+|\d+[.)]\s+)/, '').trim();
      if (!cleanLine) continue;

      // Linha vinda de uma TABELA (ex: .docx com tabela, convertida preservando
      // colunas): "Cenoura | 200 | g". Sem isso, cada célula da tabela vinha
      // solta em linhas separadas e o parser não conseguia juntar nome +
      // quantidade + unidade — resultando numa ficha técnica vazia/errada.
      if (cleanLine.includes('|')) {
        const parts = cleanLine.split('|').map((p) => p.trim()).filter((p) => p.length > 0);
        const looksLikeHeaderRow = parts.some((p) =>
          ['ingrediente', 'insumo', 'quantidade', 'unidade', 'qtd', 'nome'].includes(p.toLowerCase())
        );

        if (!looksLikeHeaderRow && parts.length >= 2) {
          const ingName = parts[0];
          // As colunas restantes podem vir separadas ("200" e "g") ou juntas ("200g")
          const rest = parts.slice(1).join(' ');
          const restMatch = rest.match(/^([0-9]+(?:[,.][0-9]+)?)\s*(.*)$/);
          if (restMatch) {
            const qty = parseFloat(restMatch[1].replace(',', '.')) || 1;
            const { quantity: adjustedQty, unit } = normalizeQuantityAndUnit(qty, restMatch[2].trim());
            ingredients.push({ ingredientName: ingName, quantity: adjustedQty, unit });
          } else {
            ingredients.push({ ingredientName: ingName, quantity: 1, unit: 'unidade' });
          }
        }
        continue;
      }

      // Extract quantity and unit
      // Examples: "250g de farinha", "3 ovos", "1.5 kg acucar", "200 ml leite", "2 colheres de sopa fermento"
      const ingRegex =
        /^([0-9]+(?:[,.][0-9]+)?|\d+\/\d+)?\s*(kg|g|gr|gramas|quilos|ml|l|litros|un|unidade|unidades|ovos|colher(?:es)?(?:\s+de\s+(?:sopa|chá|sobremesa))?|xícara(?:s)?|pitada(?:s)?)?\s*(?:de\s+)?(.+)$/i;

      const match = cleanLine.match(ingRegex);
      if (match) {
        const rawQty = match[1] || '1';
        let qty = 1;
        if (rawQty.includes('/')) {
          const [num, den] = rawQty.split('/').map(Number);
          qty = den ? num / den : 1;
        } else {
          qty = parseFloat(rawQty.replace(',', '.')) || 1;
        }

        const rawUnit = (match[2] || '').toLowerCase().trim();
        const ingName = (match[3] || cleanLine).trim();

        // Medidas caseiras (colher, xícara, pitada) ajustam a QUANTIDADE também
        // (ex: "2 colheres de sopa" vira 30g, não "2 unidade").
        const { quantity: adjustedQty, unit } = normalizeQuantityAndUnit(qty, rawUnit);

        ingredients.push({
          ingredientName: ingName,
          quantity: adjustedQty,
          unit,
        });
      } else {
        ingredients.push({
          ingredientName: cleanLine,
          quantity: 1,
          unit: 'unidade',
        });
      }
    } else if (section === 'instructions') {
      instructionLines.push(line);
    }
  }

  return {
    name: name || 'Receita Importada',
    category: 'Bolos',
    yieldAmount: yieldAmount || 1,
    yieldUnit: yieldUnit || 'unidade',
    prepTimeMinutes,
    ovenTimeMinutes,
    ovenTemperatureCelsius,
    ingredients: ingredients.length > 0 ? ingredients : [],
    instructions: instructionLines.join('\n'),
  };
}

/**
 * Finds best matching ingredient from registry for imported text
 */
export function findBestIngredientMatch(
  query: string,
  ingredients: Ingredient[]
): {
  matchedIngredient: Ingredient | null;
  score: number;
  status: 'exact' | 'suggested' | 'not_found';
} {
  if (!query || ingredients.length === 0) {
    return { matchedIngredient: null, score: 0, status: 'not_found' };
  }

  const normalizedQuery = normalizeString(query);
  let bestScore = 0;
  let bestIngredient: Ingredient | null = null;

  for (const ing of ingredients) {
    const normalizedName = normalizeString(ing.name);
    
    if (normalizedName === normalizedQuery) {
      return { matchedIngredient: ing, score: 1.0, status: 'exact' };
    }

    const score = calculateStringSimilarity(query, ing.name);
    if (score > bestScore) {
      bestScore = score;
      bestIngredient = ing;
    }
  }

  if (bestScore >= 0.85) {
    return { matchedIngredient: bestIngredient, score: bestScore, status: 'exact' };
  } else if (bestScore >= 0.50) {
    return { matchedIngredient: bestIngredient, score: bestScore, status: 'suggested' };
  } else {
    return { matchedIngredient: null, score: bestScore, status: 'not_found' };
  }
}
