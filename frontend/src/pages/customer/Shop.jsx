import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Input } from '../../components/ui/Field';
import { Badge, EmptyState, ErrorNote, Spinner } from '../../components/ui/Feedback';
import Button from '../../components/ui/Button';
import { publicApi } from '../../api/endpoints';
import { money, number } from '../../utils/format';
import Thumb from '../../components/ui/Thumb';

/** The guest view. No login, no stock numbers, no cost prices. */
export default function Shop() {
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [categories, setCategories] = useState([]);
  const [page, setPage] = useState(1);
  const [state, setState] = useState({ loading: true, error: '', rows: [], pagination: null });

  useEffect(() => {
    publicApi.categories().then(setCategories).catch(() => setCategories([]));
  }, []);

  const load = useCallback(() => {
    setState((s) => ({ ...s, loading: true, error: '' }));
    publicApi
      .products({ search: search || undefined, categoryId: categoryId || undefined, page, limit: 24 })
      .then((res) => setState({ loading: false, error: '', rows: res.data, pagination: res.pagination }))
      .catch((err) => setState({ loading: false, error: err.message, rows: [], pagination: null }));
  }, [search, categoryId, page]);

  useEffect(() => {
    const t = setTimeout(load, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, search]);

  const { loading, error, rows, pagination } = state;

  const AVAILABILITY = {
    in_stock: { tone: 'ok', label: 'In stock' },
    low: { tone: 'warn', label: 'Only a few left' },
    out_of_stock: { tone: 'danger', label: 'Out of stock' },
  };

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <span className="flex items-center gap-2.5 font-semibold">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-ink text-white">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
                   strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 9h16v11H4V9Zm0 0 2-5h12l2 5M9 20v-6h6v6" />
              </svg>
            </span>
            Our shop
          </span>
          <Link to="/login" className="text-sm font-medium text-slate-600 hover:text-ink">
            Staff sign in
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight">What we have in today</h1>
          <p className="mt-1 text-sm text-slate-500">Prices are per item. Pop in to buy — we do not sell online.</p>
        </div>

        <div className="mb-5 flex flex-col gap-3">
          <Input
            type="search"
            value={search}
            onChange={(e) => { setPage(1); setSearch(e.target.value); }}
            placeholder="Search for something"
            className="sm:max-w-md"
          />
          <div className="flex flex-wrap gap-2">
            <FilterChip active={!categoryId} onClick={() => { setPage(1); setCategoryId(''); }}>
              Everything
            </FilterChip>
            {categories.map((c) => (
              <FilterChip
                key={c.id}
                active={String(categoryId) === String(c.id)}
                onClick={() => { setPage(1); setCategoryId(c.id); }}
              >
                {c.name}
              </FilterChip>
            ))}
          </div>
        </div>

        {error && <ErrorNote message={error} onRetry={load} />}
        {loading && <Spinner label="Loading the shelves" />}

        {!loading && !error && rows.length === 0 && (
          <div className="rounded-xl bg-white shadow-card">
            <EmptyState
              title="Nothing matches that"
              description="Try a different word, or browse everything."
              action={<Button variant="secondary" onClick={() => { setSearch(''); setCategoryId(''); }}>Show everything</Button>}
            />
          </div>
        )}

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {rows.map((p) => {
            const a = AVAILABILITY[p.availability];
            return (
              <article key={p.id} className="flex flex-col overflow-hidden rounded-xl bg-white shadow-card">
                <Thumb src={p.image_url} alt={p.name} size="lg" />
                <div className="flex flex-1 flex-col p-3">
                  <p className="text-sm font-medium leading-snug">{p.name}</p>
                  {p.category && <p className="mt-0.5 text-xs text-slate-500">{p.category}</p>}
                  <div className="mt-auto pt-3">
                    <p className="tnum text-lg font-semibold">{money(p.price)}</p>
                    <div className="mt-1.5">
                      <Badge tone={a.tone}>{a.label}</Badge>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        {pagination && pagination.totalPages > 1 && (
          <div className="mt-6 flex items-center justify-between">
            <p className="tnum text-sm text-slate-500">
              {number(pagination.total)} products · page {pagination.page} of {pagination.totalPages}
            </p>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
              <Button variant="secondary" size="sm" disabled={page >= pagination.totalPages} onClick={() => setPage(page + 1)}>Next</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function FilterChip({ active, children, ...props }) {
  return (
    <button
      className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
        active ? 'bg-ink text-white' : 'bg-white text-slate-600 shadow-card hover:bg-slate-50'
      }`}
      {...props}
    >
      {children}
    </button>
  );
}
