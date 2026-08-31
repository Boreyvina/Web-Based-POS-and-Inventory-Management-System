import { useEffect, useState } from 'react';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import { Field, Input, Select } from '../../components/ui/Field';
import { ErrorNote } from '../../components/ui/Feedback';
import { productApi } from '../../api/endpoints';
import { useToast } from '../../components/ui/Toast';
import { number } from '../../utils/format';

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
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setChangeType('restock');
    setDirection(1);
    setQty('');
    setNote('');
    setError('');
  }, [open]);

  if (!product) return null;

  const amount = Number(qty) || 0;
  const delta = direction * amount;
  const after = product.stock_quantity + delta;
  const invalid = amount <= 0 || after < 0;

  async function handleSubmit() {
    if (invalid) return;
    setBusy(true);
    setError('');
    try {
      await productApi.adjustStock(product.id, { changeType, quantityChange: delta, note: note.trim() || null });
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

        <Field label="Note" hint="Optional, but future-you will thank you">
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Delivery from supplier" />
        </Field>

        {amount > 0 && after >= 0 && (
          <p className="tnum rounded-lg bg-brand-50 px-4 py-3 text-sm text-brand-700">
            {number(product.stock_quantity)} → <span className="font-semibold">{number(after)}</span> {product.unit}
          </p>
        )}
      </div>
    </Modal>
  );
}
