/**
 * Modelo financeiro do Bergamota OS.
 *
 * Tudo é calculado por COMPETÊNCIA (mês a que a despesa pertence), igual à
 * planilha "Entradas e saídas": receita = soma das vendas do mês; saídas =
 * lançamentos com aquela competência.
 */
import type { ClosedDay, FinanceSettings, FinTransaction, RecurringExpense, Sale, SaleMethod } from '../types';
import { addMonths, daysInMonth, parseDate, toISODate } from '../lib/format';

// ---------------------------------------------------------------------------
// Classificação das saídas em linhas do DRE
// ---------------------------------------------------------------------------

export type DreLine =
  | 'impostos_vendas'
  | 'cmv'
  | 'outras_compras'
  | 'pessoal'
  | 'prolabore'
  | 'fixas'
  | 'variaveis'
  | 'esporadicas'
  | 'financeiro'
  | 'outras_receitas';

export const DRE_LABELS: Record<DreLine, string> = {
  impostos_vendas: 'Impostos sobre vendas (Simples/DARE)',
  cmv: 'CMV — insumos e embalagens',
  outras_compras: 'Outras compras operacionais',
  pessoal: 'Pessoal e encargos',
  prolabore: 'Pró-labore dos sócios',
  fixas: 'Despesas fixas',
  variaveis: 'Despesas variáveis',
  esporadicas: 'Despesas esporádicas',
  financeiro: 'Empréstimos e financiamentos',
  outras_receitas: 'Outras receitas',
};

const CMV_CATEGORIES = new Set(['Insumos e Fornecedores', 'Embalagens']);

export function dreLine(t: FinTransaction): DreLine {
  if (t.type === 'entrada') return 'outras_receitas';
  const desc = t.description.trim().toLowerCase();
  if (t.category === 'Pró-labore') return 'prolabore';
  if (t.category === 'Empréstimos e Financiamentos') return 'financeiro';
  if (t.category === 'Impostos sobre Vendas' || /^(simples|dare)\b/.test(desc)) return 'impostos_vendas';
  if (/^inss\b/.test(desc)) return 'pessoal';
  switch (t.grp) {
    case 'compras':
      return CMV_CATEGORIES.has(t.category) ? 'cmv' : 'outras_compras';
    case 'funcionario':
      return 'pessoal';
    case 'fixa':
      return 'fixas';
    case 'variavel':
      return 'variaveis';
    case 'esporadica':
      return 'esporadicas';
    default:
      return 'outras_compras';
  }
}

// ---------------------------------------------------------------------------
// Calendário de funcionamento
// ---------------------------------------------------------------------------

/** Dias do mês em que a loja abre (dias da semana configurados, menos dias fechados, mais dias com venda). */
export function openDays(month: string, fin: FinanceSettings, closed: ClosedDay[], sales: Sale[]): string[] {
  const closedSet = new Set(closed.map((c) => c.date));
  const withSales = new Set(sales.filter((s) => s.date.startsWith(month)).map((s) => s.date));
  const out: string[] = [];
  for (let d = 1; d <= daysInMonth(month); d++) {
    const iso = `${month}-${String(d).padStart(2, '0')}`;
    const wd = parseDate(iso).getDay();
    if (withSales.has(iso) || (fin.openWeekdays.includes(wd) && !closedSet.has(iso))) out.push(iso);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Resumo mensal / DRE
// ---------------------------------------------------------------------------

export interface MonthSummary {
  month: string;
  receitaVendas: number;
  outrasReceitas: number;
  receitaBruta: number;
  byMethod: Record<SaleMethod, number>;
  taxasCartao: number;
  lines: Record<DreLine, number>;
  receitaLiquida: number;
  lucroBruto: number;
  resultadoOperacional: number;
  resultadoLiquido: number;
  /** Entradas − saídas, exatamente como a "Saúde dos meses" da planilha (sem taxas de cartão). */
  saldoCaixa: number;
  totalSaidas: number;
  tickets: number;
  ticketMedio: number;
  diasComVenda: number;
  mediaDiaria: number;
  diasAbertos: number;
  metaDiaria: number;
  previstoPendente: number;
}

const emptyLines = (): Record<DreLine, number> => ({
  impostos_vendas: 0,
  cmv: 0,
  outras_compras: 0,
  pessoal: 0,
  prolabore: 0,
  fixas: 0,
  variaveis: 0,
  esporadicas: 0,
  financeiro: 0,
  outras_receitas: 0,
});

export interface ModelData {
  sales: Sale[];
  transactions: FinTransaction[];
  closedDays: ClosedDay[];
  fin: FinanceSettings;
}

export function summarizeMonth(month: string, data: ModelData, includePrevisto = true): MonthSummary {
  const sales = data.sales.filter((s) => s.date.startsWith(month));
  const txs = data.transactions.filter(
    (t) => t.competencia === month && (includePrevisto || t.status === 'realizado')
  );

  const byMethod: Record<SaleMethod, number> = { dinheiro: 0, pix: 0, debito: 0, credito: 0, outro: 0 };
  let tickets = 0;
  let ticketSum = 0;
  const days = new Set<string>();
  for (const s of sales) {
    byMethod[s.method] += s.amount;
    days.add(s.date);
    if (!s.is_aggregate) {
      tickets++;
      ticketSum += s.amount;
    }
  }
  const receitaVendas = Object.values(byMethod).reduce((a, b) => a + b, 0);
  const taxasCartao = (Object.keys(byMethod) as SaleMethod[]).reduce(
    (acc, m) => acc + byMethod[m] * ((data.fin.cardFees[m] || 0) / 100),
    0
  );

  const lines = emptyLines();
  let totalSaidas = 0;
  let previstoPendente = 0;
  for (const t of txs) {
    const line = dreLine(t);
    lines[line] += t.value;
    if (t.type === 'saida') totalSaidas += t.value;
    if (t.status === 'previsto' && t.type === 'saida') previstoPendente += t.value;
  }

  const outrasReceitas = lines.outras_receitas;
  const receitaBruta = receitaVendas + outrasReceitas;
  const receitaLiquida = receitaBruta - lines.impostos_vendas - taxasCartao;
  const lucroBruto = receitaLiquida - lines.cmv;
  const resultadoOperacional =
    lucroBruto -
    lines.outras_compras -
    lines.pessoal -
    lines.prolabore -
    lines.fixas -
    lines.variaveis -
    lines.esporadicas;
  const resultadoLiquido = resultadoOperacional - lines.financeiro;

  const abertos = openDays(month, data.fin, data.closedDays, data.sales);
  const allSaidasMes = data.transactions
    .filter((t) => t.competencia === month && t.type === 'saida')
    .reduce((a, t) => a + t.value, 0);
  const metaDiaria = Math.max(data.fin.minDailyTarget, abertos.length ? allSaidasMes / abertos.length : 0);

  return {
    month,
    receitaVendas,
    outrasReceitas,
    receitaBruta,
    byMethod,
    taxasCartao,
    lines,
    receitaLiquida,
    lucroBruto,
    resultadoOperacional,
    resultadoLiquido,
    saldoCaixa: receitaBruta - totalSaidas,
    totalSaidas,
    tickets,
    ticketMedio: tickets ? ticketSum / tickets : 0,
    diasComVenda: days.size,
    mediaDiaria: days.size ? receitaVendas / days.size : 0,
    diasAbertos: abertos.length,
    metaDiaria,
    previstoPendente,
  };
}

/** Meses (YYYY-MM) que têm qualquer dado, em ordem crescente, incluindo o mês atual. */
export function monthsWithData(data: ModelData, current: string): string[] {
  const set = new Set<string>([current]);
  data.sales.forEach((s) => set.add(s.date.slice(0, 7)));
  data.transactions.forEach((t) => set.add(t.competencia));
  return Array.from(set).sort();
}

// ---------------------------------------------------------------------------
// Série diária (gráfico Venda × Média × Meta, como a aba "Gráfico" da planilha)
// ---------------------------------------------------------------------------

export interface DayPoint {
  date: string;
  total: number;
  tickets: number;
  byMethod: Record<SaleMethod, number>;
}

export function dailySeries(month: string, data: ModelData): DayPoint[] {
  const map = new Map<string, DayPoint>();
  for (const d of openDays(month, data.fin, data.closedDays, data.sales)) {
    map.set(d, { date: d, total: 0, tickets: 0, byMethod: { dinheiro: 0, pix: 0, debito: 0, credito: 0, outro: 0 } });
  }
  for (const s of data.sales) {
    if (!s.date.startsWith(month)) continue;
    const p = map.get(s.date);
    if (!p) continue;
    p.total += s.amount;
    p.byMethod[s.method] += s.amount;
    if (!s.is_aggregate) p.tickets++;
  }
  return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
}

/** Média de venda por dia da semana num intervalo de meses. */
export function weekdayAverages(months: string[], data: ModelData) {
  const acc = Array.from({ length: 7 }, () => ({ total: 0, days: 0, tickets: 0 }));
  const byDay = new Map<string, { total: number; tickets: number }>();
  for (const s of data.sales) {
    if (!months.includes(s.date.slice(0, 7))) continue;
    const d = byDay.get(s.date) || { total: 0, tickets: 0 };
    d.total += s.amount;
    if (!s.is_aggregate) d.tickets++;
    byDay.set(s.date, d);
  }
  for (const [date, v] of byDay) {
    const wd = parseDate(date).getDay();
    acc[wd].total += v.total;
    acc[wd].tickets += v.tickets;
    acc[wd].days++;
  }
  return acc.map((a, wd) => ({
    weekday: wd,
    media: a.days ? a.total / a.days : 0,
    ticketsMedio: a.days ? a.tickets / a.days : 0,
    dias: a.days,
  }));
}

// ---------------------------------------------------------------------------
// Ponto de equilíbrio e precificação
// ---------------------------------------------------------------------------

export interface BreakEven {
  months: string[];
  receitaMedia: number;
  custosVariaveisPct: number; // % da receita
  margemContribuicaoPct: number;
  custosFixosMensais: number;
  pontoEquilibrioMensal: number;
  pontoEquilibrioDiario: number;
  diasAbertosMedio: number;
  margemSeguranca: number; // % acima (ou abaixo) do PE
  despesasFixasPct: number; // custos fixos / receita
  markupSugerido: number;
  detalhe: { variaveis: Record<string, number>; fixos: Record<string, number> };
}

/**
 * Custos variáveis: CMV, impostos sobre vendas, taxas de cartão, outras compras e
 * despesas variáveis. Custos fixos: pessoal, pró-labore, fixas, esporádicas e
 * parcelas de empréstimos (saem do caixa todo mês).
 */
export function breakEven(months: string[], data: ModelData): BreakEven {
  const sums = months.map((m) => summarizeMonth(m, data, false));
  const n = Math.max(1, sums.length);
  const avg = (f: (s: MonthSummary) => number) => sums.reduce((a, s) => a + f(s), 0) / n;

  const receitaMedia = avg((s) => s.receitaBruta);
  const variaveis = {
    'CMV (insumos e embalagens)': avg((s) => s.lines.cmv),
    'Impostos sobre vendas': avg((s) => s.lines.impostos_vendas),
    'Taxas de cartão': avg((s) => s.taxasCartao),
    'Outras compras': avg((s) => s.lines.outras_compras),
    'Despesas variáveis': avg((s) => s.lines.variaveis),
  };
  const fixos = {
    'Pessoal e encargos': avg((s) => s.lines.pessoal),
    'Pró-labore': avg((s) => s.lines.prolabore),
    'Despesas fixas': avg((s) => s.lines.fixas),
    'Esporádicas': avg((s) => s.lines.esporadicas),
    'Empréstimos': avg((s) => s.lines.financeiro),
  };
  const totalVar = Object.values(variaveis).reduce((a, b) => a + b, 0);
  const custosFixosMensais = Object.values(fixos).reduce((a, b) => a + b, 0);
  const custosVariaveisPct = receitaMedia ? (totalVar / receitaMedia) * 100 : 0;
  const margemContribuicaoPct = 100 - custosVariaveisPct;
  const pontoEquilibrioMensal = margemContribuicaoPct > 0 ? custosFixosMensais / (margemContribuicaoPct / 100) : 0;
  const diasAbertosMedio = avg((s) => s.diasAbertos) || 22;
  const despesasFixasPct = receitaMedia ? (custosFixosMensais / receitaMedia) * 100 : 0;

  // Markup divisor: preço = custo direto / (1 − (DF% + DV% sem CMV + lucro%))
  const dvSemCmvPct = receitaMedia ? ((totalVar - variaveis['CMV (insumos e embalagens)']) / receitaMedia) * 100 : 0;
  const lucro = data.fin.targetProfitPct;
  const divisor = 1 - (despesasFixasPct + dvSemCmvPct + lucro) / 100;

  return {
    months,
    receitaMedia,
    custosVariaveisPct,
    margemContribuicaoPct,
    custosFixosMensais,
    pontoEquilibrioMensal,
    pontoEquilibrioDiario: pontoEquilibrioMensal / diasAbertosMedio,
    diasAbertosMedio,
    margemSeguranca: pontoEquilibrioMensal ? ((receitaMedia - pontoEquilibrioMensal) / pontoEquilibrioMensal) * 100 : 0,
    despesasFixasPct,
    markupSugerido: divisor > 0.05 ? 1 / divisor : 0,
    detalhe: { variaveis, fixos },
  };
}

// ---------------------------------------------------------------------------
// Projeção de caixa
// ---------------------------------------------------------------------------

export interface ProjectionRow {
  month: string;
  receita: number;
  saidasPrevistas: number; // já lançadas (previstas/realizadas)
  recorrentes: number; // recorrentes ativas ainda não geradas no mês
  compras: number; // CMV estimado pelo % histórico, quando não lançado
  saidas: number;
  saldo: number;
  acumulado: number;
  realizado: boolean;
}

/**
 * Projeta os próximos meses: receita = média diária dos últimos meses fechados ×
 * dias abertos do mês; saídas = lançamentos já existentes + recorrentes ativas
 * ainda não geradas + compras estimadas pelo % histórico de CMV quando ainda não foram lançadas.
 */
export function projectCashFlow(
  history: string[],
  current: string,
  ahead: number,
  data: ModelData,
  recurring: RecurringExpense[] = []
): ProjectionRow[] {
  const closed = history.filter((m) => m < current).slice(-3);
  const base = closed.map((m) => summarizeMonth(m, data, false));
  const mediaDiaria = base.length ? base.reduce((a, s) => a + s.mediaDiaria, 0) / base.length : 0;
  const comprasPct = base.length
    ? base.reduce((a, s) => a + (s.receitaBruta ? (s.lines.cmv + s.lines.outras_compras) / s.receitaBruta : 0), 0) / base.length
    : 0;

  const rows: ProjectionRow[] = [];
  let acumulado = 0;
  for (const m of history.filter((x) => x < current)) {
    const s = summarizeMonth(m, data, true);
    acumulado += s.saldoCaixa;
    rows.push({
      month: m,
      receita: s.receitaBruta,
      saidasPrevistas: s.totalSaidas,
      recorrentes: 0,
      compras: 0,
      saidas: s.totalSaidas,
      saldo: s.saldoCaixa,
      acumulado,
      realizado: true,
    });
  }
  for (let i = 0; i <= ahead; i++) {
    const m = addMonths(current, i);
    const s = summarizeMonth(m, data, true);
    const dias = openDays(m, data.fin, data.closedDays, data.sales);
    let receita: number;
    if (i === 0) {
      // mês corrente: vendido até hoje + média diária nos dias abertos que faltam
      const today = toISODate(new Date());
      const faltam = dias.filter((d) => d > today).length;
      receita = s.receitaBruta + faltam * mediaDiaria;
    } else {
      receita = dias.length * mediaDiaria;
    }
    const comprasLancadas = s.lines.cmv + s.lines.outras_compras;
    const comprasEstimadas = Math.max(0, receita * comprasPct - comprasLancadas);
    const geradas = new Set(data.transactions.filter((t) => t.competencia === m && t.recurring_id).map((t) => t.recurring_id));
    const recorrentes = recurring
      .filter((r) => r.active && r.start_month <= m && (!r.end_month || r.end_month >= m) && !geradas.has(r.id))
      .reduce((a, r) => a + r.value, 0);
    const saidas = s.totalSaidas + recorrentes + comprasEstimadas;
    acumulado += receita - saidas;
    rows.push({
      month: m,
      receita,
      saidasPrevistas: s.totalSaidas,
      recorrentes,
      compras: comprasEstimadas,
      saidas,
      saldo: receita - saidas,
      acumulado,
      realizado: false,
    });
  }
  return rows;
}
