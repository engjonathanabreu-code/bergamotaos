/**
 * Componentes base do Bergamota OS, seguindo o guia de UI:
 * app bar laranja, cartões brancos com sombra leve, rótulos em caixa alta,
 * listas com ícone circular, FAB laranja redondo, abas sublinhadas.
 */
import React, { useEffect } from 'react';
import { ChevronLeft, ChevronRight, X, Plus } from 'lucide-react';
import { monthLong } from '../lib/format';

export function Card({
  children,
  className = '',
  padded = true,
}: {
  children: React.ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return <div className={`bg-white rounded-[4px] shadow-sm ${padded ? 'p-4 sm:p-5' : ''} ${className}`}>{children}</div>;
}

export function CardHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 mb-4">
      <div className="min-w-0">
        <h3 className="section-label">{title}</h3>
        {subtitle && <p className="text-xs text-stone-500 mt-1">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-5">
      <div>
        <h1 className="text-xl sm:text-2xl font-normal text-stone-800">{title}</h1>
        {subtitle && <p className="text-sm text-stone-500 mt-0.5">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

type Tone = 'neutral' | 'brand' | 'good' | 'bad' | 'info';
const toneText: Record<Tone, string> = {
  neutral: 'text-stone-800',
  brand: 'text-amber-600',
  good: 'text-emerald-700',
  bad: 'text-rose-600',
  info: 'text-blue-600',
};

export function Stat({
  label,
  value,
  hint,
  tone = 'neutral',
  icon,
  delta,
}: {
  label: string;
  value: string;
  hint?: React.ReactNode;
  tone?: Tone;
  icon?: React.ReactNode;
  delta?: number | null;
}) {
  return (
    <Card className="flex flex-col gap-1 min-w-0">
      <div className="flex items-center justify-between gap-2">
        <span className="section-label truncate">{label}</span>
        {icon && <span className="text-stone-400 shrink-0">{icon}</span>}
      </div>
      <div className={`text-xl xl:text-2xl font-normal tabular truncate ${toneText[tone]}`}>{value}</div>
      <div className="flex items-center gap-2 text-xs text-stone-500 min-h-4">
        {delta !== undefined && delta !== null && Number.isFinite(delta) && (
          <span className={`font-medium ${delta >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
            {delta >= 0 ? '▲' : '▼'} {Math.abs(delta).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%
          </span>
        )}
        {hint}
      </div>
    </Card>
  );
}

export function MonthPicker({
  value,
  onChange,
  min,
  max,
}: {
  value: string;
  onChange: (m: string) => void;
  min?: string;
  max?: string;
}) {
  const shift = (n: number) => {
    const d = new Date(Number(value.slice(0, 4)), Number(value.slice(5, 7)) - 1 + n, 1);
    const m = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if ((min && m < min) || (max && m > max)) return;
    onChange(m);
  };
  return (
    <div className="inline-flex items-center bg-white rounded-[2px] shadow-sm h-9">
      <button type="button" aria-label="Mês anterior" onClick={() => shift(-1)} className="px-2 h-full text-stone-600 hover:text-amber-600">
        <ChevronLeft className="w-4 h-4" />
      </button>
      <span className="px-2 text-sm text-stone-800 min-w-32 text-center">{monthLong(value)}</span>
      <button type="button" aria-label="Próximo mês" onClick={() => shift(1)} className="px-2 h-full text-stone-600 hover:text-amber-600">
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}

export function Tabs<T extends string>({
  value,
  onChange,
  items,
}: {
  value: T;
  onChange: (v: T) => void;
  items: { id: T; label: string; badge?: string }[];
}) {
  return (
    <div className="flex overflow-x-auto border-b border-stone-200 -mx-1 px-1">
      {items.map((it) => {
        const active = it.id === value;
        return (
          <button
            key={it.id}
            type="button"
            onClick={() => onChange(it.id)}
            className={`relative shrink-0 px-4 h-11 text-[13px] font-medium uppercase tracking-wide transition-colors ${
              active ? 'text-amber-600' : 'text-stone-500 hover:text-stone-800'
            }`}
          >
            {it.label}
            {it.badge && <span className="ml-1.5 text-[11px] text-stone-400 normal-case">{it.badge}</span>}
            {active && <span className="absolute left-0 right-0 bottom-0 h-0.5 bg-amber-500" />}
          </button>
        );
      })}
    </div>
  );
}

export function Fab({ onClick, label, icon }: { onClick: () => void; label: string; icon?: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="no-print fixed right-5 bottom-5 sm:right-8 sm:bottom-8 z-30 w-14 h-14 rounded-full bg-amber-500 hover:bg-amber-600 text-white shadow-lg flex items-center justify-center transition-colors"
    >
      {icon || <Plus className="w-6 h-6" />}
    </button>
  );
}

export function Dialog({
  open,
  onClose,
  title,
  children,
  footer,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(e) => e.stopPropagation()}
        className={`bg-white w-full ${wide ? 'sm:max-w-2xl' : 'sm:max-w-md'} max-h-[92vh] flex flex-col rounded-t-[8px] sm:rounded-[4px] shadow-2xl`}
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <h2 className="text-lg font-medium text-stone-800">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Fechar" className="text-stone-400 hover:text-stone-700">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="px-5 pb-4 overflow-y-auto">{children}</div>
        {footer && <div className="px-5 py-3 flex justify-end gap-2 border-t border-stone-100">{footer}</div>}
      </div>
    </div>
  );
}

export function ListItem({
  icon,
  iconBg = 'bg-amber-500',
  title,
  subtitle,
  meta,
  right,
  onClick,
}: {
  icon?: React.ReactNode;
  iconBg?: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  meta?: React.ReactNode;
  right?: React.ReactNode;
  onClick?: () => void;
}) {
  const Comp = onClick ? 'button' : 'div';
  return (
    <Comp
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 text-left border-b border-stone-100 last:border-0 ${
        onClick ? 'hover:bg-stone-50' : ''
      }`}
    >
      {icon && (
        <span className={`w-9 h-9 rounded-full ${iconBg} text-white flex items-center justify-center shrink-0`}>{icon}</span>
      )}
      <span className="flex-1 min-w-0">
        {meta && <span className="block text-[11px] text-stone-400">{meta}</span>}
        <span className="block text-sm text-stone-800 truncate">{title}</span>
        {subtitle && <span className="block text-xs text-stone-500 truncate">{subtitle}</span>}
      </span>
      {right && <span className="shrink-0 text-right">{right}</span>}
    </Comp>
  );
}

export function Chip({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: Tone }) {
  const cls: Record<Tone, string> = {
    neutral: 'bg-stone-100 text-stone-600',
    brand: 'bg-amber-50 text-amber-700',
    good: 'bg-emerald-50 text-emerald-700',
    bad: 'bg-rose-100 text-rose-600',
    info: 'bg-blue-50 text-blue-700',
  };
  return <span className={`inline-flex items-center px-2 h-5 rounded-full text-[11px] font-medium ${cls[tone]}`}>{children}</span>;
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <label className="inline-flex items-center gap-2 cursor-pointer select-none text-sm text-stone-700">
      <span className="relative inline-block w-9 h-5">
        <input type="checkbox" className="sr-only peer" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span className="absolute inset-x-0 top-1 h-3 rounded-full bg-stone-300 peer-checked:bg-amber-200 transition-colors" />
        <span className="absolute top-0 left-0 w-5 h-5 rounded-full bg-white shadow-md peer-checked:translate-x-4 peer-checked:bg-amber-500 transition-transform" />
      </span>
      {label}
    </label>
  );
}

export function Progress({ value, tone = 'brand' }: { value: number; tone?: Tone }) {
  const bar: Record<Tone, string> = {
    neutral: 'bg-stone-400',
    brand: 'bg-amber-500',
    good: 'bg-emerald-500',
    bad: 'bg-rose-500',
    info: 'bg-blue-500',
  };
  return (
    <div className="h-1.5 w-full rounded-full bg-stone-100 overflow-hidden">
      <div className={`h-full ${bar[tone]} rounded-full transition-all`} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

export function EmptyState({ icon, title, text, action }: { icon?: React.ReactNode; title: string; text?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center text-center py-10 px-6">
      {icon && <div className="w-14 h-14 rounded-full bg-amber-50 text-amber-500 flex items-center justify-center mb-3">{icon}</div>}
      <p className="text-sm font-medium text-stone-800">{title}</p>
      {text && <p className="text-xs text-stone-500 mt-1 max-w-xs">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="block text-[11px] text-stone-400 mt-1">{hint}</span>}
    </label>
  );
}

/** Paleta dos gráficos, derivada do guia. */
export const CHART = {
  brand: '#FF9C2E',
  brandDark: '#E77F11',
  green: '#68C166',
  red: '#EE001D',
  blue: '#4A90E2',
  grey: '#A6A6A6',
  dark: '#272A33',
  grid: '#EEEEEE',
  // validado (CVD/normal-vision) com o validador do dataviz; sempre acompanhado de legenda
  methods: { dinheiro: '#4FA84D', pix: '#2F74C6', debito: '#E77F11', credito: '#8E5BB5', outro: '#A6A6A6' },
};
