import { useCallback, useEffect, useState } from 'react';
import { PageHeader } from '../../components/Layout';
import Button from '../../components/ui/Button';
import { Input, Select } from '../../components/ui/Field';
import { Badge, EmptyState, ErrorNote, Spinner } from '../../components/ui/Feedback';
import StockModal from '../admin/StockModal';
import { categoryApi, productApi } from '../../api/endpoints';
import { money, number } from '../../utils/format';
import Thumb from '../../components/ui/Thumb';
import { expiryLabel } from '../../utils/expiry';
import { dateOnly } from '../../utils/format';

/**
 * Read-only catalogue for cashiers, plus the one write they are allowed:
 * correcting a stock count. Prices and product details stay locked.
 */
export default function CashierProducts() {
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [categories, setCategories] = useState([]);
  const [state, setState] = useState({ loading: true, error: '', rows: [] });
  const [stockFor, setStockFor] = useState(null);

  useEffect(() => {
    categoryApi.list().then(setCategories).catch(() => setCategories([]));
  }, []);

  const load = useCallback(() => {
    setState((s) => ({ ...s, loading: true, error: '' }));
    productApi
      .list({ search: search || undefined, categoryId: categoryId || undefined, limit: 60 })
      .then((res) => setState({ loading: false, error: '', rows: res.data }))
      .catch((err) => setState({ loading: false, error: err.message, rows: [] }));
  }, [search, categoryId]);

  useEffect(() => {
    const t = setTimeout(load, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, search]);

  const { loading, error, rows } = state;

  return (
    <>
      <PageHeader title="Products" description="Check a price or what is left on the shelf" />

      <div className="p-4 sm:p-6">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row">
          <Input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or barcode"
            className="sm:max-w-xs"
          />
          <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="sm:max-w-[200px]">
            <option value="">All categories</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </div>

        {error && <ErrorNote message={error} onRetry={load} />}
        {loading && <Spinner label="Loading products" />}

        {!loading && !error && rows.length === 0 && (
          <div className="rounded-xl bg-white shadow-card">
            <EmptyState title="Nothing matches that search" description="Try a shorter search, or clear the category filter." />
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((p) => {
            const out = p.stock_quantity <= 0;
            const expiry = expiryLabel(p);
            return (
              <div key={p.id} className="flex flex-col rounded-xl bg-white p-4 shadow-card">
                <div className="flex items-start gap-3">
                  <Thumb src={p.image_url} size="md" />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{p.name}</p>
                    <p className="tnum text-xs text-slate-500">{p.category_name || 'No category'}</p>
                  </div>
                  <p className="tnum shrink-0 text-lg font-semibold">{money(p.selling_price)}</p>
                </div>

                {p.expiry_date && (
                  <p className={`tnum mt-2 text-xs ${
                    p.expiry_status === 'expired' ? 'text-danger-fg'
                      : p.expiry_status === 'expiring' ? 'text-warn-fg' : 'text-slate-500'
                  }`}>
                    Expiry {dateOnly(p.expiry_date)}{expiry && expiry.short ? ` · ${expiry.long}` : ''}
                  </p>
                )}

                <div className="mt-3 flex items-center justify-between">
                  <span className="inline-flex items-center gap-2">
                    <span className={`tnum text-sm font-medium ${out ? 'text-danger-fg' : p.is_low_stock ? 'text-warn-fg' : ''}`}>
                      {number(p.stock_quantity)} {p.unit}
                    </span>
                    {out && <Badge tone="danger">Out of stock</Badge>}
                    {!out && p.is_low_stock && <Badge tone="warn">Running low</Badge>}
                  </span>
                  <Button variant="secondary" size="sm" onClick={() => setStockFor(p)}>Correct count</Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <StockModal open={Boolean(stockFor)} onClose={() => setStockFor(null)} onSaved={load} product={stockFor} />
    </>
  );
}
