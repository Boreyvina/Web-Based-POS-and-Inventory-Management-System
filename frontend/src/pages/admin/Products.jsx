import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PageHeader } from '../../components/Layout';
import Button from '../../components/ui/Button';
import { Input, Select } from '../../components/ui/Field';
import { Badge, EmptyState, ErrorNote, Spinner } from '../../components/ui/Feedback';
import Modal from '../../components/ui/Modal';
import { useToast } from '../../components/ui/Toast';
import ProductFormModal from './ProductFormModal';
import StockModal from './StockModal';
import CategoriesModal from './CategoriesModal';
import { categoryApi, productApi } from '../../api/endpoints';
import { money, number } from '../../utils/format';
import Thumb from '../../components/ui/Thumb';
import WriteOffModal from './WriteOffModal';
import { expiryLabel } from '../../utils/expiry';
import { dateOnly } from '../../utils/format';

export default function Products() {
  const { push } = useToast();
  const [params] = useSearchParams();

  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [lowStock, setLowStock] = useState(params.get('lowStock') === 'true');
  const [expiring, setExpiring] = useState(params.get('expiring') === 'true');
  const [page, setPage] = useState(1);

  const [categories, setCategories] = useState([]);
  const [state, setState] = useState({ loading: true, error: '', rows: [], pagination: null });

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [stockFor, setStockFor] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [writingOff, setWritingOff] = useState(null);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [busyDelete, setBusyDelete] = useState(false);

  const loadCategories = useCallback(() => {
    categoryApi.list().then(setCategories).catch(() => setCategories([]));
  }, []);

  const loadProducts = useCallback(() => {
    setState((s) => ({ ...s, loading: true, error: '' }));
    productApi
      .list({
        search: search || undefined,
        categoryId: categoryId || undefined,
        lowStock: lowStock || undefined,
        expiring: expiring || undefined,
        page,
        limit: 20,
      })
      .then((res) => setState({ loading: false, error: '', rows: res.data, pagination: res.pagination }))
      .catch((err) => setState({ loading: false, error: err.message, rows: [], pagination: null }));
  }, [search, categoryId, lowStock, expiring, page]);

  useEffect(loadCategories, [loadCategories]);

  // Debounce the search box so we aren't firing a request per keystroke.
  useEffect(() => {
    const t = setTimeout(loadProducts, search ? 350 : 0);
    return () => clearTimeout(t);
  }, [loadProducts, search]);

  function resetToFirstPage(fn) {
    return (value) => { setPage(1); fn(value); };
  }

  async function confirmDelete() {
    setBusyDelete(true);
    try {
      await productApi.remove(deleting.id);
      push(`${deleting.name} removed from the catalogue`);
      setDeleting(null);
      loadProducts();
    } catch (err) {
      push(err.message, 'error');
    } finally {
      setBusyDelete(false);
    }
  }

  const { loading, error, rows, pagination } = state;

  return (
    <>
      <PageHeader
        title="Products"
        description="Everything you sell, and how much of it is on the shelf"
        action={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setCategoriesOpen(true)}>Categories</Button>
            <Button onClick={() => { setEditing(null); setFormOpen(true); }}>Add product</Button>
          </div>
        }
      />

      <div className="p-4 sm:p-6">
        {/* Filters */}
        <div className="mb-4 flex flex-col gap-3 sm:flex-row">
          <Input
            value={search}
            onChange={(e) => resetToFirstPage(setSearch)(e.target.value)}
            placeholder="Search by name or barcode"
            className="sm:max-w-xs"
            type="search"
          />
          <Select
            value={categoryId}
            onChange={(e) => resetToFirstPage(setCategoryId)(e.target.value)}
            className="sm:max-w-[200px]"
          >
            <option value="">All categories</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
          <button
            onClick={() => resetToFirstPage(setLowStock)(!lowStock)}
            className={`h-11 rounded-lg border px-4 text-sm font-medium ${
              lowStock ? 'border-warn-fg bg-warn-bg text-warn-fg' : 'border-slate-300 bg-white text-slate-600'
            }`}
          >
            Needs reordering
          </button>
          <button
            onClick={() => resetToFirstPage(setExpiring)(!expiring)}
            className={`h-11 rounded-lg border px-4 text-sm font-medium ${
              expiring ? 'border-danger-fg bg-danger-bg text-danger-fg' : 'border-slate-300 bg-white text-slate-600'
            }`}
          >
            Expiring soon
          </button>
        </div>

        {error && <ErrorNote message={error} onRetry={loadProducts} />}
        {loading && <Spinner label="Loading products" />}

        {!loading && !error && rows.length === 0 && (
          <div className="rounded-xl bg-white shadow-card">
            <EmptyState
              title={search || categoryId || lowStock || expiring ? 'Nothing matches those filters' : 'No products yet'}
              description={
                search || categoryId || lowStock || expiring
                  ? 'Clear the filters to see the whole catalogue.'
                  : 'Add your first product to start selling.'
              }
              action={
                search || categoryId || lowStock || expiring ? (
                  <Button variant="secondary" onClick={() => { setSearch(''); setCategoryId(''); setLowStock(false); setExpiring(false); }}>
                    Clear filters
                  </Button>
                ) : (
                  <Button onClick={() => { setEditing(null); setFormOpen(true); }}>Add product</Button>
                )
              }
            />
          </div>
        )}

        {!loading && rows.length > 0 && (
          <>
            {/* Table — desktop */}
            <div className="hidden overflow-hidden rounded-xl bg-white shadow-card lg:block">
              <table className="w-full text-sm">
                <thead className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">Product</th>
                    <th className="px-4 py-3 font-medium">Category</th>
                    <th className="px-4 py-3 text-right font-medium">Cost</th>
                    <th className="px-4 py-3 text-right font-medium">Price</th>
                    <th className="px-4 py-3 font-medium">Expiry</th>
                    <th className="px-4 py-3 text-right font-medium">Stock</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50/60">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Thumb src={p.image_url} alt="" size="sm" />
                          <div className="min-w-0">
                            <p className="font-medium">{p.name}</p>
                            <p className="tnum text-xs text-slate-500">{p.barcode || 'No barcode'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{p.category_name || '—'}</td>
                      <td className="tnum px-4 py-3 text-right text-slate-500">{money(p.cost_price)}</td>
                      <td className="tnum px-4 py-3 text-right font-medium">{money(p.selling_price)}</td>
                      <td className="px-4 py-3">
                        <ExpiryCell product={p} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <StockCell product={p} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          {p.expiry_status === 'expired' && p.stock_quantity > 0 && (
                            <RowAction danger onClick={() => setWritingOff(p)}>Write off</RowAction>
                          )}
                          <RowAction onClick={() => setStockFor(p)}>Stock</RowAction>
                          <RowAction onClick={() => { setEditing(p); setFormOpen(true); }}>Edit</RowAction>
                          <RowAction danger onClick={() => setDeleting(p)}>Remove</RowAction>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Cards — mobile/tablet */}
            <div className="space-y-3 lg:hidden">
              {rows.map((p) => (
                <div key={p.id} className="rounded-xl bg-white p-4 shadow-card">
                  <div className="flex items-start gap-3">
                    <Thumb src={p.image_url} alt="" size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{p.name}</p>
                      <p className="tnum text-xs text-slate-500">{p.category_name || 'No category'}</p>
                    </div>
                    <p className="tnum shrink-0 font-semibold">{money(p.selling_price)}</p>
                  </div>
                  <div className="mt-2"><ExpiryCell product={p} /></div>
                  <div className="mt-3 flex items-center justify-between">
                    <StockCell product={p} />
                    <div className="flex gap-1">
                      {p.expiry_status === 'expired' && p.stock_quantity > 0 && (
                        <RowAction danger onClick={() => setWritingOff(p)}>Write off</RowAction>
                      )}
                      <RowAction onClick={() => setStockFor(p)}>Stock</RowAction>
                      <RowAction onClick={() => { setEditing(p); setFormOpen(true); }}>Edit</RowAction>
                      <RowAction danger onClick={() => setDeleting(p)}>Remove</RowAction>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {pagination && pagination.totalPages > 1 && (
              <div className="mt-4 flex items-center justify-between">
                <p className="tnum text-sm text-slate-500">
                  Page {pagination.page} of {pagination.totalPages} · {number(pagination.total)} products
                </p>
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
                  <Button variant="secondary" size="sm" disabled={page >= pagination.totalPages} onClick={() => setPage(page + 1)}>Next</Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <ProductFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={loadProducts}
        product={editing}
        categories={categories}
      />

      <StockModal
        open={Boolean(stockFor)}
        onClose={() => setStockFor(null)}
        onSaved={loadProducts}
        product={stockFor}
      />

      <CategoriesModal
        open={categoriesOpen}
        onClose={() => setCategoriesOpen(false)}
        onChanged={() => { loadCategories(); loadProducts(); }}
        categories={categories}
      />

      <WriteOffModal
        open={Boolean(writingOff)}
        onClose={() => setWritingOff(null)}
        onSaved={loadProducts}
        product={writingOff}
      />

      <Modal
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        title="Remove product"
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setDeleting(null)}>Keep it</Button>
            <Button variant="danger" loading={busyDelete} onClick={confirmDelete}>Remove product</Button>
          </div>
        }
      >
        <p className="text-sm text-slate-600">
          <span className="font-medium text-ink">{deleting?.name}</span> will stop appearing in the till and the
          customer list. Past sales that include it stay exactly as they are, so your reports do not change.
        </p>
      </Modal>
    </>
  );
}

function ExpiryCell({ product }) {
  const label = expiryLabel(product);
  if (!product.expiry_date) return <span className="text-xs text-slate-400">—</span>;
  return (
    <span className="inline-flex items-center gap-2">
      <span className="tnum text-xs text-slate-500">{dateOnly(product.expiry_date)}</span>
      {label && label.short && <Badge tone={label.tone}>{label.short}</Badge>}
    </span>
  );
}

function StockCell({ product }) {
  const out = product.stock_quantity === 0;
  const low = !out && product.stock_quantity <= product.low_stock_threshold;
  return (
    <span className="inline-flex items-center gap-2">
      <span className={`tnum font-medium ${out ? 'text-danger-fg' : low ? 'text-warn-fg' : ''}`}>
        {number(product.stock_quantity)}
      </span>
      {out && <Badge tone="danger">Out of stock</Badge>}
      {low && <Badge tone="warn">Reorder</Badge>}
    </span>
  );
}

function RowAction({ danger, children, ...props }) {
  return (
    <button
      className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
        danger ? 'text-danger-fg hover:bg-danger-bg' : 'text-slate-600 hover:bg-slate-100'
      }`}
      {...props}
    >
      {children}
    </button>
  );
}
