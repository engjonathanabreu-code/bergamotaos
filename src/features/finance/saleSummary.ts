import type { Sale, SaleItem } from '../../types';

/** "2× Bolo de Cenoura" | "Pão sem glúten" | "Venda avulsa" */
export function itemLabel(i: Pick<SaleItem, 'product_name' | 'quantity'>): string {
  if (!i.product_name) return 'Venda avulsa';
  return i.quantity > 1 ? `${i.quantity}× ${i.product_name}` : i.product_name;
}

/** Título de uma venda: os itens juntos, ou o rótulo do total consolidado. */
export function saleTitle(s: Sale): string {
  if (s.is_aggregate) return 'Total consolidado';
  if (!s.items.length) return 'Venda avulsa';
  return s.items.map(itemLabel).join(' + ');
}
