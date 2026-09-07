import { useEffect, useState } from 'react';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import { Input } from '../../components/ui/Field';
import { Badge, ErrorNote, Spinner } from '../../components/ui/Feedback';
import StatusBadge from '../../components/ui/StatusBadge';
import { useToast } from '../../components/ui/Toast';
import { purchaseApi } from '../../api/endpoints';
import { money, number, dateOnly } from '../../utils/format';

export default function OrderDetailModal({ open, onClose, onChanged, order }) {
  const { push } = useToast();
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (!open || !order) return;
    setLoading(true);
    setError('');
    setCancelling(false);
    setReason('');
    purchaseApi.get(order.id)
      .then(setDetail)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [open, order]);

  async function confirmCancel() {
    try {
      await purchaseApi.cancel(order.id, reason.trim() || undefined);
      push(`${order.po_number} cancelled`);
      onChanged();
      onClose();
    } catch (err) {
      push(err.message, 'error');
    }
  }

  if (!order) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      title={order.po_number}
      footer={
        detail && detail.status !== 'received' && detail.status !== 'cancelled' ? (
          cancelling ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Input value={reason} onChange={(e) => setReason(e.target.value)}
                     placeholder="Why is it cancelled?" className="max-w-xs" />
              <div className="flex gap-3">
                <Button variant="secondary" onClick={() => setCancelling(false)}>Keep it</Button>
                <Button variant="danger" onClick={confirmCancel}>Cancel order</Button>
              </div>
            </div>
          ) : (
            <div className="flex justify-between gap-3">
              <Button variant="ghost" onClick={() => setCancelling(true)}>Cancel this order</Button>
              <Button variant="secondary" onClick={onClose}>Close</Button>
            </div>
          )
        ) : (
          <div className="flex justify-end"><Button variant="secondary" onClick={onClose}>Close</Button></div>
        )
      }
    >
      <div className="space-y-4">
        <ErrorNote message={error} />
        {loading && <Spinner label="Loading" />}

        {!loading && detail && (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <StatusBadge status={detail.status} />
              {detail.supplier_name && <span className="text-sm text-slate-600">{detail.supplier_name}</span>}
              {detail.supplier_phone && <span className="tnum text-sm text-slate-500">{detail.supplier_phone}</span>}
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Meta label="Raised by" value={detail.created_by} />
              <Meta label="Ordered" value={detail.order_date ? dateOnly(detail.order_date) : 'Not sent yet'} />
              <Meta label="Expected" value={detail.expected_date ? dateOnly(detail.expected_date) : '—'} />
              <Meta label="Received" value={detail.received_date ? dateOnly(detail.received_date) : '—'} />
            </div>

            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full text-sm">
                <thead className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-3 py-2 font-medium">Product</th>
                    <th className="px-3 py-2 text-right font-medium">Ordered</th>
                    <th className="px-3 py-2 text-right font-medium">Received</th>
                    <th className="px-3 py-2 text-right font-medium">Cost each</th>
                    <th className="px-3 py-2 text-right font-medium">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {detail.items.map((i) => (
                    <tr key={i.id}>
                      <td className="px-3 py-2">
                        <p className="font-medium">{i.product_name}</p>
                        {i.expiry_date && (
                          <p className="tnum text-xs text-slate-500">expiry expected {dateOnly(i.expiry_date)}</p>
                        )}
                      </td>
                      <td className="tnum px-3 py-2 text-right text-slate-600">{number(i.quantity_ordered)}</td>
                      <td className="tnum px-3 py-2 text-right">
                        {number(i.quantity_received)}
                        {i.quantity_outstanding > 0 && (
                          <Badge tone="warn">{number(i.quantity_outstanding)} to come</Badge>
                        )}
                      </td>
                      <td className="tnum px-3 py-2 text-right text-slate-600">{money(i.unit_cost)}</td>
                      <td className="tnum px-3 py-2 text-right font-medium">{money(i.line_total)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t border-slate-200">
                  <tr>
                    <td colSpan="4" className="px-3 py-2 text-right font-medium">Total</td>
                    <td className="tnum px-3 py-2 text-right text-base font-semibold">{money(detail.total_cost)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {detail.note && (
              <p className="rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-600">{detail.note}</p>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}

function Meta({ label, value }) {
  return (
    <div className="rounded-lg bg-slate-50 px-3 py-2.5">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-0.5 text-sm font-medium">{value}</p>
    </div>
  );
}
