import { useCallback, useEffect, useState } from 'react';
import { PageHeader } from '../components/Layout';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import Receipt from '../components/Receipt';
import { Input, Select, Field } from '../components/ui/Field';
import { Badge, EmptyState, ErrorNote, Spinner } from '../components/ui/Feedback';
import { useToast } from '../components/ui/Toast';
import { useAuth } from '../context/AuthContext';
import { authApi, saleApi } from '../api/endpoints';
import { money, number, dateTime, daysAgo, toInputDate } from '../utils/format';

/**
 * One screen serves both roles. The backend already filters a cashier's
 * results to their own sales, so the difference here is only what we show.
 */
export default function SalesHistory() {
  const { isAdmin } = useAuth();
  const { push } = useToast();

  const [from, setFrom] = useState(daysAgo(30));
  const [to, setTo] = useState(toInputDate(Date.now()));
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [cashierId, setCashierId] = useState('');
  const [staff, setStaff] = useState([]);
  const [page, setPage] = useState(1);

  const [state, setState] = useState({ loading: true, error: '', rows: [], summary: null, pagination: null });
  const [receipt, setReceipt] = useState(null);
  const [voiding, setVoiding] = useState(null);
  const [reason, setReason] = useState('');
  const [busyVoid, setBusyVoid] = useState(false);

  // The staff list is only needed for the admin's cashier filter.
  useEffect(() => {
    if (!isAdmin) return;
    authApi
      .listUsers()
      .then((rows) => setStaff(rows.filter((u) => u.role !== 'customer')))
      .catch(() => setStaff([]));
  }, [isAdmin]);

  const load = useCallback(() => {
    setState((s) => ({ ...s, loading: true, error: '' }));
    saleApi
      .list({
        from,
        to,
        status: status || undefined,
        search: search || undefined,
        cashierId: cashierId || undefined,
        page,
        limit: 20,
      })
      .then((res) => setState({ loading: false, error: '', rows: res.data, summary: res.summary, pagination: res.pagination }))
      .catch((err) => setState({ loading: false, error: err.message, rows: [], summary: null, pagination: null }));
  }, [from, to, status, search, cashierId, page]);

  useEffect(() => {
    const t = setTimeout(load, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, search]);

  async function openReceipt(id) {
    try {
      setReceipt(await saleApi.get(id));
    } catch (err) {
      push(err.message, 'error');
    }
  }

  async function confirmVoid() {
    setBusyVoid(true);
    try {
      await saleApi.void(voiding.id, reason.trim() || undefined);
      push(`${voiding.invoice_no} voided, stock restored`);
      setVoiding(null);
      setReason('');
      load();
    } catch (err) {
      push(err.message, 'error');
    } finally {
      setBusyVoid(false);
    }
  }

  const { loading, error, rows, summary, pagination } = state;

  return (
    <>
      <PageHeader
        title={isAdmin ? 'Sales' : 'My sales'}
        description={isAdmin ? 'Every transaction in the shop' : 'Transactions you rang up'}
        action={
          summary && (
            <div className="text-right">
              <p className="text-xs text-slate-500">Taken in this period</p>
              <p className="tnum text-2xl font-semibold">{money(summary.revenue)}</p>
            </div>
          )
        }
      />

      <div className="p-4 sm:p-6">
        <div className={`mb-4 grid gap-3 sm:grid-cols-2 ${isAdmin ? 'lg:grid-cols-5' : 'lg:grid-cols-4'}`}>
          <Field label="From">
            <Input type="date" value={from} onChange={(e) => { setPage(1); setFrom(e.target.value); }} className="tnum" />
          </Field>
          <Field label="To">
            <Input type="date" value={to} onChange={(e) => { setPage(1); setTo(e.target.value); }} className="tnum" />
          </Field>
          <Field label="Status">
            <Select value={status} onChange={(e) => { setPage(1); setStatus(e.target.value); }}>
              <option value="">All</option>
              <option value="completed">Completed</option>
              <option value="voided">Voided</option>
            </Select>
          </Field>
          {isAdmin && (
            <Field label="Served by">
              <Select value={cashierId} onChange={(e) => { setPage(1); setCashierId(e.target.value); }}>
                <option value="">All staff</option>
                {staff.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.full_name}{u.is_active ? '' : ' (blocked)'}
                  </option>
                ))}
              </Select>
            </Field>
          )}

          <Field label="Receipt number">
            <Input type="search" value={search} onChange={(e) => { setPage(1); setSearch(e.target.value); }} placeholder="INV-…" className="tnum" />
          </Field>
        </div>

        {error && <ErrorNote message={error} onRetry={load} />}
        {loading && <Spinner label="Loading sales" />}

        {!loading && !error && rows.length === 0 && (
          <div className="rounded-xl bg-white shadow-card">
            <EmptyState
              title={cashierId ? 'No sales from that person in this period' : 'No sales in this period'}
              description="Widen the date range, or clear the filters."
            />
          </div>
        )}

        {!loading && rows.length > 0 && (
          <>
            <div className="hidden overflow-hidden rounded-xl bg-white shadow-card lg:block">
              <table className="w-full text-sm">
                <thead className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">Receipt</th>
                    <th className="px-4 py-3 font-medium">When</th>
                    {isAdmin && <th className="px-4 py-3 font-medium">Cashier</th>}
                    <th className="px-4 py-3 font-medium">Payment</th>
                    <th className="px-4 py-3 text-right font-medium">Items</th>
                    <th className="px-4 py-3 text-right font-medium">Total</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50/60">
                      <td className="tnum px-4 py-3 font-medium">
                        {s.invoice_no}
                        {s.status !== 'completed' && <Badge tone="danger">{s.status}</Badge>}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{dateTime(s.created_at)}</td>
                      {isAdmin && <td className="px-4 py-3 text-slate-600">{s.cashier_name}</td>}
                      <td className="px-4 py-3 capitalize text-slate-600">{s.payment_method}</td>
                      <td className="tnum px-4 py-3 text-right text-slate-600">{number(s.item_count)}</td>
                      <td className="tnum px-4 py-3 text-right font-semibold">{money(s.total_amount)}</td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <RowAction onClick={() => openReceipt(s.id)}>Receipt</RowAction>
                          {isAdmin && s.status === 'completed' && (
                            <RowAction danger onClick={() => setVoiding(s)}>Void</RowAction>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="space-y-3 lg:hidden">
              {rows.map((s) => (
                <div key={s.id} className="rounded-xl bg-white p-4 shadow-card">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="tnum font-medium">{s.invoice_no}</p>
                      <p className="text-xs text-slate-500">{dateTime(s.created_at)}</p>
                      {isAdmin && <p className="text-xs text-slate-500">{s.cashier_name}</p>}
                    </div>
                    <div className="text-right">
                      <p className="tnum font-semibold">{money(s.total_amount)}</p>
                      <p className="tnum text-xs capitalize text-slate-500">{s.payment_method} · {number(s.item_count)} items</p>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    {s.status !== 'completed' ? <Badge tone="danger">{s.status}</Badge> : <span />}
                    <div className="flex gap-1">
                      <RowAction onClick={() => openReceipt(s.id)}>Receipt</RowAction>
                      {isAdmin && s.status === 'completed' && <RowAction danger onClick={() => setVoiding(s)}>Void</RowAction>}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {pagination && pagination.totalPages > 1 && (
              <div className="mt-4 flex items-center justify-between">
                <p className="tnum text-sm text-slate-500">
                  Page {pagination.page} of {pagination.totalPages} · {number(pagination.total)} sales
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

      <Receipt open={Boolean(receipt)} sale={receipt} onClose={() => setReceipt(null)} />

      <Modal
        open={Boolean(voiding)}
        onClose={() => setVoiding(null)}
        title="Void sale"
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setVoiding(null)}>Keep the sale</Button>
            <Button variant="danger" loading={busyVoid} onClick={confirmVoid}>Void and restore stock</Button>
          </div>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Voiding <span className="tnum font-medium text-ink">{voiding?.invoice_no}</span> puts every item back on
            the shelf and removes <span className="tnum font-medium text-ink">{money(voiding?.total_amount)}</span> from
            your revenue. The sale stays in the log, marked voided.
          </p>
          <Field label="Reason" hint="Shown in the inventory log next to the restored stock">
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Customer changed their mind" autoFocus />
          </Field>
        </div>
      </Modal>
    </>
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
