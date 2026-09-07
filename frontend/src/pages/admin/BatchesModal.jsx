import { useEffect, useState } from 'react';
import Modal from '../../components/ui/Modal';
import { Badge, ErrorNote, Spinner } from '../../components/ui/Feedback';
import { productApi } from '../../api/endpoints';
import { expiryLabel } from '../../utils/expiry';
import { money, number, dateOnly } from '../../utils/format';

/**
 * Every delivery of one product, listed separately. This is the screen that
 * answers "how much of this is old stock and how much is new?"
 */
export default function BatchesModal({ open, onClose, product }) {
  const [state, setState] = useState({ loading: true, error: '', rows: [], summary: null });

  useEffect(() => {
    if (!open || !product) return;
    setState({ loading: true, error: '', rows: [], summary: null });
    productApi
      .batches(product.id)
      .then((res) => setState({ loading: false, error: '', rows: res.data, summary: res.summary }))
      .catch((err) => setState({ loading: false, error: err.message, rows: [], summary: null }));
  }, [open, product]);

  if (!product) return null;

  const { loading, error, rows, summary } = state;
  const onShelf = rows.filter((r) => r.quantity_remaining > 0);
  const soldOut = rows.filter((r) => r.quantity_remaining === 0);

  return (
    <Modal open={open} onClose={onClose} wide title={`Stock batches — ${product.name}`}>
      <div className="space-y-4">
        <ErrorNote message={error} />
        {loading && <Spinner label="Loading batches" />}

        {!loading && !error && (
          <>
            <p className="rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-600">
              Each delivery is kept separate, with its own expiry date and cost. The till always
              sells the batch that expires soonest, so old stock leaves the shelf before new stock.
            </p>

            {summary && onShelf.length > 0 && (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <MiniStat label="Batches on shelf" value={number(summary.batchCount)} />
                <MiniStat label="Total units" value={`${number(summary.totalRemaining)} ${product.unit}`} />
                <MiniStat
                  label="Sells next"
                  value={summary.oldest?.expiry_date ? dateOnly(summary.oldest.expiry_date) : 'Oldest first'}
                />
              </div>
            )}

            {onShelf.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-500">
                Nothing on the shelf. Receive a delivery to create the first batch.
              </p>
            ) : (
              <BatchTable rows={onShelf} unit={product.unit} />
            )}

            {soldOut.length > 0 && (
              <details className="rounded-lg border border-slate-200">
                <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-slate-600">
                  {soldOut.length} sold-out batch{soldOut.length === 1 ? '' : 'es'} (kept for history)
                </summary>
                <div className="border-t border-slate-200 px-4 pb-3">
                  <BatchTable rows={soldOut} unit={product.unit} faded />
                </div>
              </details>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}

function BatchTable({ rows, unit, faded }) {
  return (
    <div className="overflow-x-auto">
      <table className={`w-full text-sm ${faded ? 'text-slate-400' : ''}`}>
        <thead className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="py-2 font-medium">Received</th>
            <th className="py-2 font-medium">Batch</th>
            <th className="py-2 font-medium">Expiry</th>
            <th className="py-2 text-right font-medium">Cost</th>
            <th className="py-2 text-right font-medium">Left</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((b, i) => {
            const label = expiryLabel(b);
            return (
              <tr key={b.id}>
                <td className="tnum py-2">
                  {dateOnly(b.received_at)}
                  {!faded && i === 0 && (
                    <span className="ml-2 text-xs font-medium text-brand-600">sells first</span>
                  )}
                </td>
                <td className="tnum py-2 text-slate-500">{b.batch_no || b.po_number || '—'}</td>
                <td className="py-2">
                  {b.expiry_date ? (
                    <span className="inline-flex items-center gap-2">
                      <span className="tnum">{dateOnly(b.expiry_date)}</span>
                      {label?.short && <Badge tone={label.tone}>{label.short}</Badge>}
                    </span>
                  ) : (
                    <span className="text-slate-400">No date</span>
                  )}
                </td>
                <td className="tnum py-2 text-right">{money(b.cost_price)}</td>
                <td className="tnum py-2 text-right font-medium">
                  {number(b.quantity_remaining)}
                  <span className="text-slate-400"> / {number(b.quantity_received)} {unit}</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function MiniStat({ label, value }) {
  return (
    <div className="rounded-lg bg-slate-50 px-3 py-2.5">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="tnum mt-0.5 font-semibold">{value}</p>
    </div>
  );
}
