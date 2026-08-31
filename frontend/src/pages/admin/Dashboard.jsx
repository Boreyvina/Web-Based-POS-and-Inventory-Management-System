import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import '../../components/charts/registerCharts';
import { RevenueChart, TopProductsChart, CategoryChart, StockChart } from '../../components/charts/Charts';
import { PageHeader } from '../../components/Layout';
import { ErrorNote, Spinner, Badge } from '../../components/ui/Feedback';
import { reportApi, productApi } from '../../api/endpoints';
import { money, number, dateOnly, daysAgo, toInputDate } from '../../utils/format';
import { expiryLabel } from '../../utils/expiry';

const RANGES = [
  { label: '7 days', days: 7, groupBy: 'day' },
  { label: '30 days', days: 30, groupBy: 'day' },
  { label: '3 months', days: 90, groupBy: 'week' },
  { label: '12 months', days: 365, groupBy: 'month' },
];

export default function Dashboard() {
  const [rangeIdx, setRangeIdx] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const [state, setState] = useState({ loading: true, error: '', data: null });

  const range = RANGES[rangeIdx];

  useEffect(() => {
    let cancelled = false;
    const params = { from: daysAgo(range.days), to: toInputDate(Date.now()) };

    setState((s) => ({ ...s, loading: true, error: '' }));

    Promise.all([
      reportApi.summary(),
      reportApi.revenue({ ...params, groupBy: range.groupBy }),
      reportApi.topProducts({ ...params, limit: 8 }),
      reportApi.byCategory(params),
      reportApi.stockLevels({ limit: 12 }),
      productApi.lowStock(),
      productApi.expiring(),
    ])
      .then(([summary, revenue, top, byCategory, stock, low, expiring]) => {
        if (!cancelled) setState({ loading: false, error: '', data: { summary, revenue, top, byCategory, stock, low, expiring } });
      })
      .catch((err) => {
        if (!cancelled) setState({ loading: false, error: err.message, data: null });
      });

    return () => { cancelled = true; };
  }, [rangeIdx, reloadKey]);

  const { loading, error, data } = state;

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="How the shop is doing right now"
        action={
          <div className="flex rounded-lg border border-slate-300 bg-white p-0.5">
            {RANGES.map((r, i) => (
              <button
                key={r.label}
                onClick={() => setRangeIdx(i)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  i === rangeIdx ? 'bg-ink text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        }
      />

      <div className="space-y-5 p-4 sm:p-6">
        {error && <ErrorNote message={error} onRetry={() => setReloadKey((k) => k + 1)} />}
        {loading && <Spinner label="Loading your numbers" />}

        {data && (
          <>
            {/* The four figures an owner checks first. */}
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
              <Stat label="Sold today" value={money(data.summary.today.revenue)}
                    sub={`${number(data.summary.today.transactions)} transactions`} />
              <Stat label="This month" value={money(data.summary.month.revenue)}
                    sub={`${number(data.summary.month.transactions)} transactions`} />
              <Stat label="Stock value" value={money(data.summary.inventory.stock_value)}
                    sub={`${number(data.summary.inventory.total_units)} units on shelf`} />
              <Stat
                label="Needs reordering"
                value={number(data.summary.inventory.low_stock_count)}
                sub={`${number(data.summary.inventory.out_of_stock_count)} completely out`}
                tone={data.summary.inventory.low_stock_count > 0 ? 'warn' : 'ok'}
              />
              <Stat
                label="Expiring or expired"
                value={number(data.summary.expiry.expiredCount + data.summary.expiry.expiringCount)}
                sub={`${money(data.summary.expiry.valueAtRisk)} of stock at risk`}
                tone={data.summary.expiry.expiredCount > 0 ? 'warn' : 'ok'}
              />
            </div>

            <div className="grid gap-5 xl:grid-cols-3">
              <Panel className="xl:col-span-2" title="Revenue" hint={`Last ${range.label}`}>
                <RevenueChart data={data.revenue} />
              </Panel>
              <Panel title="Best sellers" hint="By units sold">
                <TopProductsChart data={data.top} />
              </Panel>
            </div>

            <div className="grid gap-5 xl:grid-cols-3">
              <Panel title="Revenue by category">
                <CategoryChart data={data.byCategory} />
              </Panel>
              <Panel className="xl:col-span-2" title="Stock levels" hint="Lowest first">
                <StockChart data={data.stock} />
              </Panel>
            </div>

            <Panel
              title="Expiry watch"
              hint={`${data.expiring.count} product${data.expiring.count === 1 ? '' : 's'}`}
              action={<Link to="/admin/products?expiring=true" className="text-sm font-medium text-brand-600 underline underline-offset-2">Open in Products</Link>}
            >
              {data.expiring.count === 0 ? (
                <p className="py-8 text-center text-sm text-slate-500">
                  Nothing is close to its expiry date.
                </p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {data.expiring.data.slice(0, 8).map((e) => {
                    const label = expiryLabel(e);
                    return (
                      <li key={e.id} className="flex items-center justify-between gap-4 py-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{e.name}</p>
                          <p className="tnum text-xs text-slate-500">
                            {dateOnly(e.expiry_date)} · {number(e.stock_quantity)} {e.unit} · {money(e.value_at_risk)}
                          </p>
                        </div>
                        {label && <Badge tone={label.tone}>{label.short}</Badge>}
                      </li>
                    );
                  })}
                </ul>
              )}
            </Panel>

            <Panel
              title="Reorder list"
              hint={`${data.low.count} product${data.low.count === 1 ? '' : 's'}`}
              action={<Link to="/admin/products?lowStock=true" className="text-sm font-medium text-brand-600 underline underline-offset-2">Open in Products</Link>}
            >
              {data.low.count === 0 ? (
                <p className="py-8 text-center text-sm text-slate-500">
                  Everything is above its reorder level.
                </p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {data.low.data.slice(0, 8).map((p) => (
                    <li key={p.id} className="flex items-center justify-between gap-4 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{p.name}</p>
                        <p className="text-xs text-slate-500">{p.category || 'No category'}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="tnum text-sm">
                          {number(p.stock_quantity)}<span className="text-slate-400"> / {number(p.low_stock_threshold)}</span>
                        </span>
                        <Badge tone={p.stock_quantity === 0 ? 'danger' : 'warn'}>
                          {p.stock_quantity === 0 ? 'Out' : 'Low'}
                        </Badge>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </>
        )}
      </div>
    </>
  );
}

function Stat({ label, value, sub, tone = 'neutral' }) {
  return (
    <div className="rounded-xl bg-white p-5 shadow-card">
      <p className="text-sm text-slate-500">{label}</p>
      <p className={`tnum mt-2 text-3xl font-semibold tracking-tight ${tone === 'warn' ? 'text-warn-fg' : ''}`}>
        {value}
      </p>
      <p className="mt-1 text-xs text-slate-500">{sub}</p>
    </div>
  );
}

function Panel({ title, hint, action, className = '', children }) {
  return (
    <section className={`rounded-xl bg-white p-5 shadow-card ${className}`}>
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <h2 className="font-semibold">{title}</h2>
        {action || (hint && <span className="text-xs text-slate-500">{hint}</span>)}
      </div>
      {children}
    </section>
  );
}
