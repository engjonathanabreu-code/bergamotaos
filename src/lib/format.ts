const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const brl0 = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const num = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });

export const money = (v: number) => brl.format(Number.isFinite(v) ? v : 0);
export const money0 = (v: number) => brl0.format(Number.isFinite(v) ? v : 0);
export const pct = (v: number, digits = 1) =>
  `${Number.isFinite(v) ? v.toLocaleString('pt-BR', { maximumFractionDigits: digits, minimumFractionDigits: digits }) : '0'}%`;
export const number = (v: number) => num.format(v);

/** Valor compacto para eixos de gráfico: 12,5 mil */
export const compact = (v: number) =>
  Math.abs(v) >= 1000 ? `${(v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil` : `${Math.round(v)}`;

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const MONTHS_LONG = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const WEEKDAYS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

export const monthShort = (ym: string) => `${MONTHS[Number(ym.slice(5, 7)) - 1]}/${ym.slice(2, 4)}`;
export const monthLong = (ym: string) => `${MONTHS_LONG[Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}`;
export const weekdayShort = (d: number) => WEEKDAYS[d];

/** Datas sempre tratadas como locais (YYYY-MM-DD), sem fuso. */
export const parseDate = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
};
export const toISODate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const todayISO = () => toISODate(new Date());
export const currentMonth = () => todayISO().slice(0, 7);
export const dayMonth = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
export const fullDate = (iso: string) =>
  parseDate(iso).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' });

export const addMonths = (ym: string, n: number) => {
  const d = new Date(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)) - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};
export const daysInMonth = (ym: string) => new Date(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)), 0).getDate();
