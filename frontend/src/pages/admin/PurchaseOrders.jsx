import { useCallback, useEffect, useState } from 'react';
import { PageHeader } from '../../components/Layout';
import Button from '../../components/ui/Button';
import { Input, Select } from '../../components/ui/Field';
import { EmptyState, ErrorNote, Spinner } from '../../components/ui/Feedback';
import StatusBadge from '../../components/ui/StatusBadge';
import { useToast } from '../../components/ui/Toast';
import OrderFormModal from './OrderFormModal';
import ReceiveModal from './ReceiveModal';
import OrderDetailModal from './OrderDetailModal';
import SuppliersModal from './SuppliersModal';
import { purchaseApi } from '../../api/endpoints';
import { money, number, dateOnly } from '../../utils/format';

const STATUSES = [
  { value: '', label: 'All orders' },
  { value: 'draft', label: 'Draft' },
  { value: 'ordered', label: 'On order' },
  { value: 'partial', label: 'Part delivered' },
  { value: 'received', label: 'Received' },
  { value: 'cancelled', label: 'Cancelled' },
];

export default function PurchaseOrders() {
  const { push } = useToast();
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const [state, setState] = useState({ loading: true, error: '', rows: [], pagination: null });
  const [formOpen, setFormOpen] = useState(false);
  const [receiving, setReceiving] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [suppliersOpen, setSuppliersOpen] = useState(false);

  const load = useCallback(() => {
    setState((s) => ({ ...s, loading: true, error: '' }));
    purchaseApi
      .list({ status: status || undefined, search: search || undefined, page, limit: 20 })
      .then((res) => setState({ loading: false, error: '', rows: res.data, pagination: res.pagination }))
      .catch((err) => setState({ loading: false, error: err.message, rows: [], pagination: null }));
  }, [status, search, page]);

  useEffect(() => {
    const t = setTimeout(load, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, search]);

  async function markSent(order) {
    try {
      await purchaseApi.send(order.id);
      push(`${order.po_number} marked as sent`);
      load();
    } catch (err) {
      push(err.message, 'error');
    }
  }

  const { loading, error, rows, pagination } = state;

  return (
    <>
      <PageHeader
        title="Orders"
        description="Stock you have ordered from suppliers, and what is still to arrive"
        action={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setSuppliersOpen(true)}>Suppliers</Button>
            <Button onClick={() => setFormOpen(true)}>New order</Button>
          </div>
        }
      />

      <div className="p-4 sm:p-6">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row">
          <Input
            type="search"
            value={search}
            onChange={(e) => { setPage(1); setSearch(e.target.value); }}
            placeholder="Search by order number"
            className="tnum sm:max-w-xs"
          />
          <Select value={status} onChange={(e) => { setPage(1); setStatus(e.target.value); }} className="sm:max-w-[200px]">
            {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </Select>
        </div>

        {error && <ErrorNote message={error} onRetry={load} />}
        {loading && <Spinner label="Loading orders" />}

        {!loading && !error && rows.length === 0 && (
          <div className="rounded-xl bg-white shadow-card">
            <EmptyState
              title={status || search ? 'No orders match that' : 'No orders yet'}
              description={
                status || search
                  ? 'Clear the filters to see everything.'
                  : 'Raise an order when you need stock from a supplier. Receiving it adds the goods to your shelves.'
              }
              action={<Button onClick={() => setFormOpen(true)}>New order</Button>}
            />
          </div>
        )}

        {!loading && rows.length > 0 && (
          <>
            <div className="hidden overflow-hidden rounded-xl bg-white shadow-card lg:block">
              <table className="w-full text-sm">
                <thead className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">Order</th>
                    <th className="px-4 py-3 font-medium">Supplier</th>
                    <th className="px-4 py-3 font-medium">Expected</th>
                    <th className="px-4 py-3 text-right font-medium">Lines</th>
                    <th className="px-4 py-3 text-right font-medium">Outstanding</th>
                    <th className="px-4 py-3 text-right font-medium">Cost</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((o) => (
                    <tr key={o.id} className="hover:bg-slate-50/60">
                      <td className="tnum px-4 py-3 font-medium">{o.po_number}</td>
                      <td className="px-4 py-3 text-slate-600">{o.supplier_name || '—'}</td>
                      <td className="tnum px-4 py-3 text-slate-600">
                        {o.expected_date ? dateOnly(o.expected_date) : '—'}
                      </td>
                      <td className="tnum px-4 py-3 text-right text-slate-600">{number(o.line_count)}</td>
                      <td className="tnum px-4 py-3 text-right">
                        {o.units_outstanding > 0
                          ? <span className="font-medium text-warn-fg">{number(o.units_outstanding)}</span>
                          : <span className="text-slate-400">—</span>}
                      </td>
                      <td className="tnum px-4 py-3 text-right font-medium">{money(o.total_cost)}</td>
                      <td className="px-4 py-3"><StatusBadge status={o.status} /></td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          {o.status === 'draft' && <RowAction onClick={() => markSent(o)}>Mark sent</RowAction>}
                          {(o.status === 'ordered' || o.status === 'partial') && (
                            <RowAction accent onClick={() => setReceiving(o)}>Receive</RowAction>
                          )}
                          <RowAction onClick={() => setViewing(o)}>Open</RowAction>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="space-y-3 lg:hidden">
              {rows.map((o) => (
                <div key={o.id} className="rounded-xl bg-white p-4 shadow-card">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="tnum font-medium">{o.po_number}</p>
                      <p className="text-xs text-slate-500">{o.supplier_name || 'No supplier'}</p>
                    </div>
                    <StatusBadge status={o.status} />
                  </div>
                  <p className="tnum mt-2 text-sm text-slate-600">
                    {money(o.total_cost)} · {number(o.line_count)} lines
                    {o.units_outstanding > 0 && ` · ${number(o.units_outstanding)} outstanding`}
                  </p>
                  <div className="mt-3 flex justify-end gap-1">
                    {o.status === 'draft' && <RowAction onClick={() => markSent(o)}>Mark sent</RowAction>}
                    {(o.status === 'ordered' || o.status === 'partial') && (
                      <RowAction accent onClick={() => setReceiving(o)}>Receive</RowAction>
                    )}
                    <RowAction onClick={() => setViewing(o)}>Open</RowAction>
                  </div>
                </div>
              ))}
            </div>

            {pagination && pagination.totalPages > 1 && (
              <div className="mt-4 flex items-center justify-between">
                <p className="tnum text-sm text-slate-500">
                  Page {pagination.page} of {pagination.totalPages} · {number(pagination.total)} orders
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

      <OrderFormModal open={formOpen} onClose={() => setFormOpen(false)} onSaved={load} />
      <ReceiveModal open={Boolean(receiving)} onClose={() => setReceiving(null)} onSaved={load} order={receiving} />
      <OrderDetailModal open={Boolean(viewing)} onClose={() => setViewing(null)} onChanged={load} order={viewing} />
      <SuppliersModal open={suppliersOpen} onClose={() => setSuppliersOpen(false)} />
    </>
  );
}

function RowAction({ accent, children, ...props }) {
  return (
    <button
      className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
        accent ? 'bg-brand-50 text-brand-700 hover:bg-brand-100' : 'text-slate-600 hover:bg-slate-100'
      }`}
      {...props}
    >
      {children}
    </button>
  );
}
