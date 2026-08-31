import { useCallback, useEffect, useState } from 'react';
import '../../components/charts/registerCharts';
import { RevenueChart, TopProductsChart, CategoryChart } from '../../components/charts/Charts';
import { PageHeader } from '../../components/Layout';
import Button from '../../components/ui/Button';
import { Field, Input, Select } from '../../components/ui/Field';
import { ErrorNote, Spinner, Badge } from '../../components/ui/Feedback';
import { useToast } from '../../components/ui/Toast';
import { inventoryApi, productApi, reportApi } from '../../api/endpoints';
import { expiryLabel } from '../../utils/expiry';
import { money, number, dateTime, dateOnly, daysAgo, toInputDate } from '../../utils/format';

const PRESETS = [
  { label: 'Today', from: () => toInputDate(Date.now()), groupBy: 'day' },
  { label: 'Last 7 days', from: () => daysAgo(6), groupBy: 'day' },
  { label: 'Last 30 days', from: () => daysAgo(29), groupBy: 'day' },
  { label: 'Last 12 months', from: () => daysAgo(364), groupBy: 'month' },
];

export default function Reports() {
  const { push } = useToast();
  const [tab, setTab] = useState('sales');

  const [from, setFrom] = useState(daysAgo(29));
  const [to, setTo] = useState(toInputDate(Date.now()));
  const [groupBy, setGroupBy] = useState('day');

  const [sales, setSales] = useState({ loading: true, error: '', data: null });
  const [logs, setLogs] = useState({ loading: false, error: '', rows: [] });
  const [expiry, setExpiry] = useState({ loading: false, rows: [], valueAtRisk: 0 });
  const [downloading, setDownloading] = useState('');

  const loadSales = useCallback(() => {
    setSales((s) => ({ ...s, loading: true, error: '' }));
    const params = { from, to };
    Promise.all([
      reportApi.revenue({ ...params, groupBy }),
      reportApi.topProducts({ ...params, limit: 10 }),
      reportApi.byCategory(params),
      reportApi.paymentMethods(params),
    ])
      .then(([revenue, top, byCategory, payments]) =>
        setSales({ loading: false, error: '', data: { revenue, top, byCategory, payments } })
      )
      .catch((err) => setSales({ loading: false, error: err.message, data: null }));
  }, [from, to, groupBy]);

  const loadExpiry = useCallback(() => {
    setExpiry((s) => ({ ...s, loading: true }));
    productApi
      .expiring()
      .then((res) => setExpiry({ loading: false, rows: res.data, valueAtRisk: res.valueAtRisk }))
      .catch(() => setExpiry({ loading: false, rows: [], valueAtRisk: 0 }));
  }, []);

  const loadLogs = useCallback(() => {
    setLogs((s) => ({ ...s, loading: true, error: '' }));
    inventoryApi
      .logs({ from, to, limit: 50 })
      .then((res) => setLogs({ loading: false, error: '', rows: res.data }))
      .catch((err) => setLogs({ loading: false, error: err.message, rows: [] }));
  }, [from, to]);

  useEffect(() => {
    if (tab === 'sales') loadSales();
    else { loadLogs(); loadExpiry(); }
  }, [tab, loadSales, loadLogs, loadExpiry]);

  async function download(type, format) {
    const key = `${type}-${format}`;
    setDownloading(key);
    try {
      await reportApi.download({ type, format, from, to });
      push(`${type} report downloaded`);
    } catch (err) {
      push(err.message, 'error');
    } finally {
      setDownloading('');
    }
  }

  function applyPreset(p) {
    setFrom(p.from());
    setTo(toInputDate(Date.now()));
    setGroupBy(p.groupBy);
  }

  const totalRevenue = sales.data?.revenue.rows.reduce((n, r) => n + Number(r.revenue), 0) || 0;
  const totalTx = sales.data?.revenue.rows.reduce((n, r) => n + Number(r.transactions), 0) || 0;

  return (
    <>
      <PageHeader title="Reports" description="Sales and stock movement over a period you choose" />

      <div className="space-y-5 p-4 sm:p-6">
        {/* Period picker */}
        <div className="rounded-xl bg-white p-4 shadow-card">
          <div className="mb-3 flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <button
                key={p.label}
                onClick={() => applyPreset(p)}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="From">
              <Input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className="tnum" />
            </Field>
            <Field label="To">
              <Input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} className="tnum" />
            </Field>
            <Field label="Group by">
              <Select value={groupBy} onChange={(e) => setGroupBy(e.target.value)}>
                <option value="day">Day</option>
                <option value="week">Week</option>
                <option value="month">Month</option>
              </Select>
            </Field>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
          {[
            { key: 'sales', label: 'Sales' },
            { key: 'inventory', label: 'Inventory' },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 rounded-md py-2 text-sm font-medium ${
                tab === t.key ? 'bg-white text-ink shadow-sm' : 'text-slate-600'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'sales' && (
          <>
            {sales.error && <ErrorNote message={sales.error} onRetry={loadSales} />}
            {sales.loading && <Spinner label="Building your report" />}

            {sales.data && (
              <>
                <div className="grid gap-4 sm:grid-cols-3">
                  <Stat label="Revenue" value={money(totalRevenue)} />
                  <Stat label="Transactions" value={number(totalTx)} />
                  <Stat label="Average sale" value={money(totalTx ? totalRevenue / totalTx : 0)} />
                </div>

                <Panel
                  title="Revenue over time"
                  action={
                    <ExportButtons
                      onCsv={() => download('sales', 'csv')}
                      onPdf={() => download('sales', 'pdf')}
                      downloading={downloading}
                      type="sales"
                    />
                  }
                >
                  <RevenueChart data={sales.data.revenue} />

                  {sales.data.revenue.rows.length > 0 && (
                    <div className="mt-5 overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                          <tr>
                            <th className="py-2 font-medium">Period</th>
                            <th className="py-2 text-right font-medium">Transactions</th>
                            <th className="py-2 text-right font-medium">Discounts</th>
                            <th className="py-2 text-right font-medium">Revenue</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {sales.data.revenue.rows.map((r) => (
                            <tr key={r.period}>
                              <td className="tnum py-2">{r.period}</td>
                              <td className="tnum py-2 text-right text-slate-600">{number(r.transactions)}</td>
                              <td className="tnum py-2 text-right text-slate-600">{money(r.discounts)}</td>
                              <td className="tnum py-2 text-right font-medium">{money(r.revenue)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </Panel>

                <div className="grid gap-5 xl:grid-cols-2">
                  <Panel title="Best sellers">
                    <TopProductsChart data={sales.data.top} />
                  </Panel>
                  <Panel title="Revenue by category">
                    <CategoryChart data={sales.data.byCategory} />
                  </Panel>
                </div>

                <Panel title="How customers paid">
                  {sales.data.payments.rows.length === 0 ? (
                    <p className="py-8 text-center text-sm text-slate-500">No payments in this period.</p>
                  ) : (
                    <ul className="divide-y divide-slate-100">
                      {sales.data.payments.rows.map((r) => (
                        <li key={r.payment_method} className="flex items-center justify-between py-3">
                          <span className="text-sm font-medium capitalize">{r.payment_method}</span>
                          <span className="tnum text-sm">
                            <span className="text-slate-500">{number(r.transactions)} sales · </span>
                            <span className="font-medium">{money(r.revenue)}</span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </Panel>
              </>
            )}
          </>
        )}

        {tab === 'inventory' && (
          <>
          <Panel
            title="Expiry watch"
            hint={expiry.rows.length ? `${money(expiry.valueAtRisk)} of stock at risk` : undefined}
            action={
              <ExportButtons
                onCsv={() => download('expiry', 'csv')}
                onPdf={() => download('expiry', 'pdf')}
                downloading={downloading}
                type="expiry"
              />
            }
          >
            {expiry.loading && <Spinner label="Checking dates" />}
            {!expiry.loading && expiry.rows.length === 0 && (
              <p className="py-8 text-center text-sm text-slate-500">Nothing is near its expiry date.</p>
            )}
            {expiry.rows.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="py-2 font-medium">Product</th>
                      <th className="py-2 font-medium">Expiry</th>
                      <th className="py-2 text-right font-medium">In stock</th>
                      <th className="py-2 text-right font-medium">Value at risk</th>
                      <th className="py-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {expiry.rows.map((r) => {
                      const label = expiryLabel(r);
                      return (
                        <tr key={r.id}>
                          <td className="py-2">
                            <p className="font-medium">{r.name}</p>
                            <p className="text-xs text-slate-500">{r.category || 'No category'}</p>
                          </td>
                          <td className="tnum py-2 text-slate-600">{dateOnly(r.expiry_date)}</td>
                          <td className="tnum py-2 text-right text-slate-600">{number(r.stock_quantity)} {r.unit}</td>
                          <td className="tnum py-2 text-right font-medium">{money(r.value_at_risk)}</td>
                          <td className="py-2">{label && <Badge tone={label.tone}>{label.long}</Badge>}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          <div className="h-5" />

          <Panel
            title="Stock movement"
            hint="Most recent 50 changes"
            action={
              <ExportButtons
                onCsv={() => download('inventory', 'csv')}
                onPdf={() => download('inventory', 'pdf')}
                downloading={downloading}
                type="inventory"
              />
            }
          >
            {logs.error && <ErrorNote message={logs.error} onRetry={loadLogs} />}
            {logs.loading && <Spinner label="Loading movements" />}

            {!logs.loading && logs.rows.length === 0 && (
              <p className="py-8 text-center text-sm text-slate-500">No stock moved in this period.</p>
            )}

            {logs.rows.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="py-2 font-medium">When</th>
                      <th className="py-2 font-medium">Product</th>
                      <th className="py-2 font-medium">Reason</th>
                      <th className="py-2 text-right font-medium">Change</th>
                      <th className="py-2 text-right font-medium">After</th>
                      <th className="py-2 font-medium">By</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {logs.rows.map((l) => (
                      <tr key={l.id}>
                        <td className="py-2 text-slate-600">{dateTime(l.created_at)}</td>
                        <td className="py-2">
                          <p className="font-medium">{l.product_name}</p>

                        </td>
                        <td className="py-2">
                          <Badge tone={l.quantity_change > 0 ? 'ok' : 'neutral'}>{l.change_type}</Badge>
                        </td>
                        <td className={`tnum py-2 text-right font-medium ${l.quantity_change > 0 ? 'text-ok-fg' : 'text-danger-fg'}`}>
                          {l.quantity_change > 0 ? '+' : ''}{number(l.quantity_change)}
                        </td>
                        <td className="tnum py-2 text-right text-slate-600">{number(l.stock_after)}</td>
                        <td className="py-2 text-slate-600">{l.user_name || 'System'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
          </>
        )}
      </div>
    </>
  );
}

function ExportButtons({ onCsv, onPdf, downloading, type }) {
  return (
    <div className="flex gap-2">
      <Button variant="secondary" size="sm" loading={downloading === `${type}-csv`} onClick={onCsv}>CSV</Button>
      <Button variant="secondary" size="sm" loading={downloading === `${type}-pdf`} onClick={onPdf}>PDF</Button>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="rounded-xl bg-white p-5 shadow-card">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="tnum mt-2 text-2xl font-semibold tracking-tight">{value}</p>
    </div>
  );
}

function Panel({ title, hint, action, children }) {
  return (
    <section className="rounded-xl bg-white p-5 shadow-card">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-semibold">{title}</h2>
        {action || (hint && <span className="text-xs text-slate-500">{hint}</span>)}
      </div>
      {children}
    </section>
  );
}
