import { useEffect, useState } from 'react';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import { Field, Input } from '../../components/ui/Field';
import { ErrorNote } from '../../components/ui/Feedback';
import { productApi } from '../../api/endpoints';
import { useToast } from '../../components/ui/Toast';
import { money, number, dateOnly } from '../../utils/format';

/**
 * Throwing away expired stock. This is a loss, so it gets its own action and
 * its own reason in the inventory log rather than hiding inside a generic
 * stock correction — otherwise nobody could ever total up what expiry costs.
 */
export default function WriteOffModal({ open, onClose, onSaved, product }) {
  const { push } = useToast();
  const [qty, setQty] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open || !product) return;
    setQty(String(product.stock_quantity ?? ''));
    setNote('');
    setError('');
  }, [open, product]);

  if (!product) return null;

  const amount = Number(qty) || 0;
  const invalid = amount <= 0 || amount > product.stock_quantity;
  const loss = amount * Number(product.cost_price || 0);

  async function handleSubmit() {
    if (invalid) return;
    setBusy(true);
    setError('');
    try {
      await productApi.writeOff(product.id, { quantity: amount, note: note.trim() || null });
      push(`${amount} × ${product.name} written off`);
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
      title="Write off expired stock"
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="danger" loading={busy} disabled={invalid} onClick={handleSubmit}>
            Write off
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <ErrorNote message={error} />

        <div className="rounded-lg bg-slate-50 px-4 py-3">
          <p className="font-medium">{product.name}</p>
          <p className="tnum text-sm text-slate-500">
            {number(product.stock_quantity)} {product.unit} in stock
            {product.expiry_date && ` · expiry ${dateOnly(product.expiry_date)}`}
          </p>
        </div>

        <Field
          label="How many are you throwing away?"
          required
          error={amount > product.stock_quantity ? `You only have ${product.stock_quantity}` : null}
          hint="Usually all of it, but you can write off part of a batch"
        >
          <Input type="number" min="1" max={product.stock_quantity} value={qty}
                 onChange={(e) => setQty(e.target.value)} className="tnum" autoFocus />
        </Field>

        <Field label="Note" hint="Optional. Shown in the stock movement log.">
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Past use-by date, binned" />
        </Field>

        {amount > 0 && !invalid && (
          <p className="tnum rounded-lg bg-danger-bg px-4 py-3 text-sm text-danger-fg">
            Loss at cost price: <span className="font-semibold">{money(loss)}</span>
          </p>
        )}

        <p className="rounded-lg bg-slate-50 px-4 py-3 text-xs text-slate-600">
          The stock goes down and the reason is recorded as "expired", so you can total up
          what expiry is costing you over a month. Nothing is deleted.
        </p>
      </div>
    </Modal>
  );
}
