import {
  LayoutDashboard,
  Calculator,
  Receipt,
  FileBarChart,
  Target,
  Cake,
  Boxes,
  BadgeDollarSign,
  Sparkles,
  History,
  BarChart3,
  Settings,
  ChefHat,
  ShoppingBag,
  type LucideIcon,
} from 'lucide-react';

export type ActiveTab =
  | 'fin-painel'
  | 'fin-caixa'
  | 'fin-vendas'
  | 'fin-despesas'
  | 'fin-dre'
  | 'fin-planejamento'
  | 'dashboard'
  | 'recipes'
  | 'ingredients'
  | 'pricing'
  | 'import-ai'
  | 'history'
  | 'reports'
  | 'settings';

export interface NavItem {
  id: ActiveTab;
  label: string;
  icon: LucideIcon;
}

export const NAV_SECTIONS: { title: string; items: NavItem[] }[] = [
  {
    title: 'Gestão',
    items: [
      { id: 'fin-painel', label: 'Painel', icon: LayoutDashboard },
      { id: 'fin-caixa', label: 'Caixa do dia', icon: Calculator },
      { id: 'fin-vendas', label: 'Vendas', icon: ShoppingBag },
      { id: 'fin-despesas', label: 'Despesas', icon: Receipt },
      { id: 'fin-dre', label: 'DRE', icon: FileBarChart },
      { id: 'fin-planejamento', label: 'Planejamento', icon: Target },
    ],
  },
  {
    title: 'Produção',
    items: [
      { id: 'dashboard', label: 'Visão da cozinha', icon: ChefHat },
      { id: 'recipes', label: 'Fichas técnicas', icon: Cake },
      { id: 'ingredients', label: 'Insumos', icon: Boxes },
      { id: 'pricing', label: 'Precificação', icon: BadgeDollarSign },
      { id: 'import-ai', label: 'Importar receita', icon: Sparkles },
      { id: 'history', label: 'Histórico de preços', icon: History },
      { id: 'reports', label: 'Relatórios', icon: BarChart3 },
    ],
  },
  {
    title: 'Sistema',
    items: [{ id: 'settings', label: 'Configurações', icon: Settings }],
  },
];

export const ALL_TABS = NAV_SECTIONS.flatMap((s) => s.items);
export const tabLabel = (t: ActiveTab) => ALL_TABS.find((i) => i.id === t)?.label || '';
