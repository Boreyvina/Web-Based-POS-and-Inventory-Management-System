import { useEffect, useState } from 'react';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import { Field, Input } from '../../components/ui/Field';
import { ErrorNote, Spinner } from '../../components/ui/Feedback';
import { useToast } from '../../components/ui/Toast';
import { purchaseApi } from '../../api/endpoints';
import { money, number, toInputDate } from '../../utils/format';

/**
 * Recording a delivery. Each line received creates its own batch, so today's
 * milk stays separate from last week's — which is what makes "sell the oldest
 * first" possible at the till.
 */
export default function ReceiveModal({ open, onClose, onSaved, order }) {
  const { push } = useToast();
  const [detail, setDetail] = useState(null);
  const [lines, setLines] = useState({});
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open || !order) return;
    setLoading(true);
    setError('');
    setNote('');
    purchaseApi
      .get(order.id)
      .then((res) => {
        setDetail(res);
        // Default to "everything outstanding arrived", which is the usual case.
        const initial = {};
        res.items.forEach((i) => {
          initial[i.id] = {
            quantity: String(i.quantity_outstanding),
            expiryDate: i.expiry_date ? toInputDate(i.expiry_date) : '',
            batchNo: '',
            unitCost: String(i.unit_cost),
          };
        });
        setLines(initial);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [open, order]);

  const setLine = (id, key, value) =>
    setLines((c) => ({ ...c, [id]: { ...c[id], [key]: value } }));

  if (!order) return null;

  const outstandingItems = detail?.items.filter((i) => i.quantity_outstanding > 0) || [];
  const totalReceiving = outstandingItems.reduce(
    (n, i) => n + (Number(lines[i.id]?.quantity) || 0), 0
  );
  const overReceiving = outstandingItems.some(
    (i) => (Number(lines[i.id]?.quantity) || 0) > i.quantity_outstanding
  );

  async function submit() {
    if (totalReceiving === 0 || overReceiving) return;
    setBusy(true);
    setError('');
    try {
      const result = await purchaseApi.receive(order.id, {
        note: note.trim() || null,
        lines: outstandingItems
          .filter((i) => Number(lines[i.id]?.quantity) > 0)
          .map((i) => ({
            itemId: i.id,
            quantity: Number(lines[i.id].quantity),
            expiryDate: lines[i.id].expiryDate || null,
            batchNo: lines[i.id].batchNo || null,
            unitCost: lines[i.id].unitCost === String(i.unit_cost)
              ? undefined
              : Number(lines[i.id].unitCost),
          })),
      });
      push(
        result.status === 'received'
          ? `${result.po_number} fully received`
          : `${result.po_number} part delivered — the rest stays on order`
      );
      onSaved();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      title={`Receive delivery — ${order.po_number}`}
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="tnum text-sm text-slate-600">
            Receiving <span className="font-semibold text-ink">{number(totalReceiving)}</span> units
          </span>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button onClick={submit} loading={busy} disabled={totalReceiving === 0 || overReceiving}>
              Add to stock
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <ErrorNote message={error} />
        {loading && <Spinner label="Loading the order" />}

        {!loading && detail && (
          <>
            {outstandingItems.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-500">
                Everything on this order has already been received.
              </p>
            ) : (
              <>
                <p className="rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-600">
                  Enter what actually turned up. Short deliveries are fine — the rest stays on order.
                  Check the expiry date on the box: it becomes this batch's date.
                </p>

                <div className="overflow-x-auto rounded-lg border border-slate-200">
                  <table className="w-full text-sm">
                    <thead className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-3 py-2 font-medium">Product</th>
                        <th className="px-3 py-2 text-right font-medium">Outstanding</th>
                        <th className="px-3 py-2 font-medium">Arrived</th>
                        <th className="px-3 py-2 font-medium">Expiry on the box</th>
                        <th className="px-3 py-2 font-medium">Lot no.</th>
                        <th className="px-3 py-2 font-medium">Cost each</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {outstandingItems.map((i) => {
                        const line = lines[i.id] || {};
                        const over = (Number(line.quantity) || 0) > i.quantity_outstanding;
                        return (
                          <tr key={i.id}>
                            <td className="px-3 py-2">
                              <p className="font-medium">{i.product_name}</p>
                              <p className="tnum text-xs text-slate-500">
                                {number(i.current_stock)} on shelf now
                              </p>
                            </td>
                            <td className="tnum px-3 py-2 text-right text-slate-600">
                              {number(i.quantity_outstanding)}
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="number" min="0" max={i.quantity_outstanding}
                                value={line.quantity ?? ''}
                                onChange={(e) => setLine(i.id, 'quantity', e.target.value)}
                                className={`tnum h-9 w-20 rounded-lg border px-2 text-sm ${
                                  over ? 'border-danger-600' : 'border-slate-300'
                                }`}
                              />
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="date" value={line.expiryDate ?? ''}
                                onChange={(e) => setLine(i.id, 'expiryDate', e.target.value)}
                                className="tnum h-9 rounded-lg border border-slate-300 px-2 text-sm"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <input
                                value={line.batchNo ?? ''}
                                onChange={(e) => setLine(i.id, 'batchNo', e.target.value)}
                                placeholder="optional"
                                className="tnum h-9 w-24 rounded-lg border border-slate-300 px-2 text-sm"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="number" min="0" step="0.01" value={line.unitCost ?? ''}
                                onChange={(e) => setLine(i.id, 'unitCost', e.target.value)}
                                className="tnum h-9 w-24 rounded-lg border border-slate-300 px-2 text-sm"
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {overReceiving && (
                  <ErrorNote message="One line is more than was ordered. Reduce it, or raise a separate order." />
                )}

                <Field label="Delivery note" hint="Optional. Shown against every batch created.">
                  <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Driver left two boxes" />
                </Field>

                <p className="rounded-lg bg-brand-50 px-4 py-3 text-xs text-brand-700">
                  Changing a cost here updates that product's cost price, so your profit figures
                  stay honest when a supplier puts prices up.
                </p>
              </>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
