import React, { useMemo, useState } from 'react';
import { Cake, Search } from 'lucide-react';
import { ListItem } from '../../ui';
import { money } from '../../lib/format';
import type { Recipe } from '../../types';

/** Lista de produtos (fichas técnicas ativas) para escolher na venda. */
export function ProductPicker({ products, onPick }: { products: Recipe[]; onPick: (r: Recipe) => void }) {
  const [q, setQ] = useState('');
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return products
      .filter((p) => !s || p.name.toLowerCase().includes(s) || (p.code || '').toLowerCase().includes(s))
      .slice(0, 80);
  }, [products, q]);

  if (products.length === 0) {
    return <p className="text-sm text-stone-500 py-4">Nenhum produto ativo. Cadastre em Fichas técnicas.</p>;
  }

  return (
    <div>
      <div className="relative mb-2">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
        <input
          autoFocus
          className="field"
          style={{ paddingLeft: 36 }}
          placeholder="Buscar produto ou código"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>
      <div className="max-h-72 overflow-y-auto rounded-[4px] border border-stone-100">
        {list.map((p) => (
          <ListItem
            key={p.id}
            icon={<Cake className="w-4 h-4" />}
            title={p.name}
            subtitle={p.code}
            right={
              p.practicedPrice ? (
                <span className="tabular text-sm text-stone-800">{money(p.practicedPrice)}</span>
              ) : (
                <span className="text-[11px] text-stone-400">sem preço</span>
              )
            }
            onClick={() => onPick(p)}
          />
        ))}
        {list.length === 0 && <p className="p-4 text-sm text-stone-500">Nenhum produto encontrado.</p>}
      </div>
    </div>
  );
}
