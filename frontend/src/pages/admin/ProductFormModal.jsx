import { useEffect, useState } from 'react';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import { Field, Input, Select, Textarea } from '../../components/ui/Field';
import { ErrorNote } from '../../components/ui/Feedback';
import ImageUpload from '../../components/ui/ImageUpload';
import { productApi } from '../../api/endpoints';
import { toDateInput } from '../../utils/expiry';
import { useToast } from '../../components/ui/Toast';

const BLANK = {
  barcode: '', name: '', description: '', categoryId: '', unit: 'pcs',
  costPrice: '', sellingPrice: '', stockQuantity: '0', lowStockThreshold: '10', imageUrl: '',
  expiryDate: '', expiryWarningDays: '14',
};

export default function ProductFormModal({ open, onClose, onSaved, product, categories }) {
  const isEdit = Boolean(product);
  const { push } = useToast();
  const [form, setForm] = useState(BLANK);
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setServerError('');
    setForm(
      product
        ? {
            barcode: product.barcode ?? '',
            name: product.name ?? '',
            description: product.description ?? '',
            categoryId: product.category_id ?? '',
            unit: product.unit ?? 'pcs',
            costPrice: String(product.cost_price ?? ''),
            sellingPrice: String(product.selling_price ?? ''),
            stockQuantity: String(product.stock_quantity ?? '0'),
            lowStockThreshold: String(product.low_stock_threshold ?? '10'),
            imageUrl: product.image_url ?? '',
            expiryDate: toDateInput(product.expiry_date),
            expiryWarningDays: String(product.expiry_warning_days ?? '14'),
          }
        : BLANK
    );
  }, [open, product]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  /** Client-side checks mirror the server's rules so mistakes surface instantly. */
  function validate() {
    const next = {};
    if (form.name.trim().length < 2) next.name = 'Give the product a name';
    if (form.sellingPrice === '' || Number(form.sellingPrice) < 0) next.sellingPrice = 'Enter a selling price';
    if (form.costPrice !== '' && Number(form.costPrice) < 0) next.costPrice = 'Cost cannot be negative';
    if (!isEdit && Number(form.stockQuantity) < 0) next.stockQuantity = 'Stock cannot be negative';
    if (Number(form.lowStockThreshold) < 0) next.lowStockThreshold = 'Cannot be negative';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!validate()) return;
    setBusy(true);
    setServerError('');

    const payload = {
      barcode: form.barcode.trim() || null,
      name: form.name.trim(),
      description: form.description.trim() || null,
      categoryId: form.categoryId ? Number(form.categoryId) : null,
      unit: form.unit,
      costPrice: Number(form.costPrice) || 0,
      sellingPrice: Number(form.sellingPrice),
      lowStockThreshold: Number(form.lowStockThreshold) || 0,
      imageUrl: form.imageUrl ? form.imageUrl.trim() : null,
      // Sent even when empty, so clearing the date actually clears it.
      expiryDate: form.expiryDate || null,
      expiryWarningDays: Number(form.expiryWarningDays) || 14,
    };
    // Stock is only set at creation. After that it moves through the stock
    // endpoint so every change leaves an audit trail.
    if (!isEdit) payload.stockQuantity = Number(form.stockQuantity) || 0;

    try {
      if (isEdit) {
        await productApi.update(product.id, payload);
        push('Product updated');
      } else {
        await productApi.create(payload);
        push('Product added');
      }
      onSaved();
      onClose();
    } catch (err) {
      setServerError(err.message);
      if (err.details) {
        setErrors(Object.fromEntries(err.details.map((d) => [d.field, d.message])));
      }
    } finally {
      setBusy(false);
    }
  }

  const margin =
    form.sellingPrice && form.costPrice
      ? (Number(form.sellingPrice) - Number(form.costPrice)).toFixed(2)
      : null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      title={isEdit ? `Edit ${product.name}` : 'Add product'}
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} loading={busy}>
            {isEdit ? 'Save changes' : 'Add product'}
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <ErrorNote message={serverError} />

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Product name" required error={errors.name}>
            <Input value={form.name} onChange={set('name')} error={errors.name} placeholder="Bottled Water 500ml" autoFocus />
          </Field>

          <Field label="Category" error={errors.categoryId}>
            <Select value={form.categoryId} onChange={set('categoryId')}>
              <option value="">No category</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
          </Field>

          <Field label="Barcode" error={errors.barcode} hint="Scan the item into this box, or leave empty for loose goods">
            <Input value={form.barcode} onChange={set('barcode')} error={errors.barcode} className="tnum" placeholder="8850001000017" />
          </Field>

          <Field label="Cost price" error={errors.costPrice} hint="What you pay the supplier">
            <Input type="number" step="0.01" min="0" value={form.costPrice} onChange={set('costPrice')} error={errors.costPrice} className="tnum" placeholder="0.00" />
          </Field>

          <Field
            label="Selling price"
            required
            error={errors.sellingPrice}
            hint={margin !== null ? `Profit per unit: ${margin}` : 'What the customer pays'}
          >
            <Input type="number" step="0.01" min="0" value={form.sellingPrice} onChange={set('sellingPrice')} error={errors.sellingPrice} className="tnum" placeholder="0.00" />
          </Field>

          <Field label="Unit" hint="How you count it">
            <Select value={form.unit} onChange={set('unit')}>
              {['pcs', 'pack', 'box', 'kg', 'litre'].map((u) => <option key={u} value={u}>{u}</option>)}
            </Select>
          </Field>

          <Field
            label="Expiry date"
            error={errors.expiryDate}
            hint="Leave empty for things that do not expire"
          >
            <Input type="date" value={form.expiryDate} onChange={set('expiryDate')} error={errors.expiryDate} className="tnum" />
          </Field>

          <Field
            label="Warn me before"
            error={errors.expiryWarningDays}
            hint="Days of notice you want"
          >
            <Input type="number" min="0" max="365" value={form.expiryWarningDays}
                   onChange={set('expiryWarningDays')} error={errors.expiryWarningDays}
                   className="tnum" disabled={!form.expiryDate} />
          </Field>

          <Field label="Reorder level" error={errors.lowStockThreshold} hint="Warn me when stock drops to this">
            <Input type="number" min="0" value={form.lowStockThreshold} onChange={set('lowStockThreshold')} error={errors.lowStockThreshold} className="tnum" />
          </Field>

          {!isEdit && (
            <Field label="Opening stock" error={errors.stockQuantity} hint="How many you have right now">
              <Input type="number" min="0" value={form.stockQuantity} onChange={set('stockQuantity')} error={errors.stockQuantity} className="tnum" />
            </Field>
          )}

        </div>

        <ImageUpload
          value={form.imageUrl}
          onChange={(url) => setForm((f) => ({ ...f, imageUrl: url || '' }))}
          disabled={busy}
        />

        <Field label="Description">
          <Textarea value={form.description} onChange={set('description')} placeholder="Anything staff should know about this product" />
        </Field>

        {isEdit && (
          <p className="rounded-lg bg-slate-50 px-4 py-3 text-xs text-slate-600">
            Stock is not edited here. Use <span className="font-medium">Adjust stock</span> on the product row so the
            change is recorded in the inventory log.
          </p>
        )}
      </form>
    </Modal>
  );
}
