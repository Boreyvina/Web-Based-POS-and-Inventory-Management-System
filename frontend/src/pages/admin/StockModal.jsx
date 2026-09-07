import { useEffect, useState } from 'react';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import { Field, Input, Select } from '../../components/ui/Field';
import { ErrorNote } from '../../components/ui/Feedback';
import { productApi } from '../../api/endpoints';
import { useToast } from '../../components/ui/Toast';
import { money, number } from '../../utils/format';

const REASONS = [
  { value: 'restock', label: 'Delivery received', sign: 1 },
  { value: 'return', label: 'Customer return', sign: 1 },
  { value: 'adjustment', label: 'Correction / damage / expiry', sign: 0 },
];

export default function StockModal({ open, onClose, onSaved, product }) {
  const { push } = useToast();
  const [changeType, setChangeType] = useState('restock');
  const [direction, setDirection] = useState(1);
  const [qty, setQty] = useState('');
  const [note, setNote] = useState('');
  // Only used when stock is coming IN — a delivery arrives with its own date,
  // its own lot number and possibly a different cost from last time.
  const [expiryDate, setExpiryDate] = useState('');
  const [batchNo, setBatchNo] = useState('');
  const [costPrice, setCostPrice] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open || !product) return;
    setChangeType('restock');
    setDirection(1);
    setQty('');
    setNote('');
    setExpiryDate('');
    setBatchNo('');
    setCostPrice(product ? String(product.cost_price ?? '') : '');
    setError('');
  }, [open, product]);

  if (!product) return null;

  const amount = Number(qty) || 0;
  const delta = direction * amount;
  const adding = direction > 0;
  const after = product.stock_quantity + delta;
  const invalid = amount <= 0 || after < 0;

  async function handleSubmit() {
    if (invalid) return;
    setBusy(true);
    setError('');
    try {
      await productApi.adjustStock(product.id, {
        changeType,
        quantityChange: delta,
        note: note.trim() || null,
        // Sent only when adding stock; a reduction takes from existing batches.
        ...(delta > 0
          ? {
              expiryDate: expiryDate || null,
              batchNo: batchNo.trim() || null,
              costPrice: costPrice === '' ? undefined : Number(costPrice),
            }
          : {}),
      });
      push(`${product.name}: ${delta > 0 ? '+' : ''}${delta} — now ${after}`);
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
      title="Adjust stock"
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} loading={busy} disabled={invalid}>Record change</Button>
        </div>
      }
    >
      <div className="space-y-4">
        <ErrorNote message={error} />

        <div className="rounded-lg bg-slate-50 px-4 py-3">
          <p className="font-medium">{product.name}</p>
          <p className="tnum text-sm text-slate-500">
            Currently {number(product.stock_quantity)} {product.unit}
          </p>
        </div>

        <Field label="Reason">
          <Select
            value={changeType}
            onChange={(e) => {
              const r = REASONS.find((x) => x.value === e.target.value);
              setChangeType(r.value);
              if (r.sign !== 0) setDirection(r.sign);
            }}
          >
            {REASONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </Select>
        </Field>

        {changeType === 'adjustment' && (
          <div className="grid grid-cols-2 gap-3">
            {[{ v: 1, l: 'Add stock' }, { v: -1, l: 'Remove stock' }].map((o) => (
              <button
                key={o.v}
                type="button"
                onClick={() => setDirection(o.v)}
                className={`h-11 rounded-lg border text-sm font-medium ${
                  direction === o.v ? 'border-ink bg-ink text-white' : 'border-slate-300 bg-white text-slate-600'
                }`}
              >
                {o.l}
              </button>
            ))}
          </div>
        )}

        <Field
          label="Quantity"
          required
          error={after < 0 ? `That would leave ${after}. You only have ${product.stock_quantity}.` : null}
        >
          <Input type="number" min="1" value={qty} onChange={(e) => setQty(e.target.value)} className="tnum" autoFocus placeholder="0" />
        </Field>

        {adding && (
          <>
            <div className="rounded-lg border border-slate-200 p-4">
              <p className="mb-3 text-sm font-medium">This delivery</p>

              <div className="space-y-3">
                <Field
                  label="Expiry date"
                  hint="Read it off the box. Leave empty if this product does not expire."
                >
                  <Input
                    type="date"
                    value={expiryDate}
                    onChange={(e) => setExpiryDate(e.target.value)}
                    className="tnum"
                  />
                </Field>

                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Lot number" hint="Optional, if the supplier prints one">
                    <Input value={batchNo} onChange={(e) => setBatchNo(e.target.value)} className="tnum" placeholder="LOT-8891" />
                  </Field>

                  <Field label="Cost each" hint="Change it if the price went up">
                    <Input
                      type="number" min="0" step="0.01"
                      value={costPrice}
                      onChange={(e) => setCostPrice(e.target.value)}
                      className="tnum"
                    />
                  </Field>
                </div>
              </div>

              <p className="mt-3 text-xs text-slate-500">
                This becomes a new batch, kept separate from the stock already on the shelf.
                The till sells whichever batch expires soonest.
              </p>
            </div>
          </>
        )}

        <Field label="Note" hint="Optional, but future-you will thank you">
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Delivery from supplier" />
        </Field>

        {amount > 0 && after >= 0 && (
          <div className="rounded-lg bg-brand-50 px-4 py-3 text-sm text-brand-700">
            <p className="tnum">
              {number(product.stock_quantity)} → <span className="font-semibold">{number(after)}</span> {product.unit}
            </p>
            {adding ? (
              <p className="tnum mt-1 text-xs">
                New batch of {number(amount)}
                {expiryDate ? `, expiring ${expiryDate}` : ', with no expiry date'}
                {costPrice !== '' && ` at ${money(costPrice)} each`}
              </p>
            ) : (
              <p className="mt-1 text-xs">Taken from the oldest stock first</p>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
