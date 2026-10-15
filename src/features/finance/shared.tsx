import React, { useMemo } from 'react';
import { useFinance } from '../../data/finance';
import type { FinanceSettings, SaleMethod } from '../../types';
import { SALE_METHOD_LABELS } from '../../types';
import type { ModelData } from '../../utils/financeModel';
import { CHART } from '../../ui';
import { money } from '../../lib/format';

export function useModelData(fin: FinanceSettings): ModelData {
  const { sales, transactions, closedDays } = useFinance();
  return useMemo(() => ({ sales, transactions, closedDays, fin }), [sales, transactions, closedDays, fin]);
}

export const METHODS: SaleMethod[] = ['dinheiro', 'pix', 'debito', 'credito'];

export const GROUP_LABELS: Record<string, string> = {
  compras: 'Compras',
  funcionario: 'Funcionários',
  fixa: 'Fixas',
  variavel: 'Variáveis',
  esporadica: 'Esporádicas',
  receita: 'Receitas',
};

/** Tooltip padrão dos gráficos: rótulo + valores em R$, texto em cor de texto, marcador colorido ao lado. */
export function MoneyTooltip({ active, payload, label, labelFormatter }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white shadow-lg rounded-[4px] px-3 py-2 text-xs border border-stone-100">
      <div className="text-stone-500 mb-1">{labelFormatter ? labelFormatter(label) : label}</div>
      {payload
        .filter((p: any) => p.value !== undefined && p.value !== null)
        .map((p: any) => (
          <div key={p.dataKey} className="flex items-center gap-2 text-stone-800">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: p.color || p.fill || p.stroke }} />
            <span className="text-stone-500">{p.name}</span>
            <span className="ml-auto tabular font-medium">{money(Number(p.value))}</span>
          </div>
        ))}
    </div>
  );
}

export function MethodLegend() {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-stone-600">
      {METHODS.map((m) => (
        <span key={m} className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: CHART.methods[m] }} />
          {SALE_METHOD_LABELS[m]}
        </span>
      ))}
    </div>
  );
}
