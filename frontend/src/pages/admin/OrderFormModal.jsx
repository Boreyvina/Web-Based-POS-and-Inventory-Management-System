import { useEffect, useState } from 'react';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import { Field, Input, Select } from '../../components/ui/Field';
import { ErrorNote, Spinner } from '../../components/ui/Feedback';
import { useToast } from '../../components/ui/Toast';
import { productApi, purchaseApi, supplierApi } from '../../api/endpoints';
import { money, number } from '../../utils/format';

/**
 * Raising an order. Nothing touches stock here — the goods are not in the shop
 * yet. Stock only moves when the delivery is received.
 */
export default function OrderFormModal({ open, onClose, onSaved }) {
  const { push } = useToast();

  const [suppliers, setSuppliers] = useState([]);
  const [supplierId, setSupplierId] = useState('');
  const [expectedDate, setExpectedDate] = useState('');
  const [note, setNote] = useState('');
  const [lines, setLines] = useState([]);

  const [search, setSearch] = useState('');
  const [results, setResults] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSupplierId(''); setExpectedDate(''); setNote(''); setLines([]);
    setSearch(''); setResults([]); setError('');

    supplierApi.list().then(setSuppliers).catch(() => setSuppliers([]));

    setLoadingSuggestions(true);
    purchaseApi.suggestions()
      .then((res) => setSuggestions(res.data))
      .catch(() => setSuggestions([]))
      .finally(() => setLoadingSuggestions(false));
  }, [open]);

  useEffect(() => {
    if (!search.trim()) { setResults([]); return undefined; }
    const t = setTimeout(() => {
      productApi.list({ search, limit: 8 }).then((r) => setResults(r.data)).catch(() => setResults([]));
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  function addLine(product, quantity = 1) {
    setError('');
    setLines((current) => {
      if (current.some((l) => l.productId === product.id)) return current;
      return [...current, {
        productId: product.id,
        name: product.name,
        unit: product.unit || 'pcs',
        quantity,
        unitCost: Number(product.cost_price) || 0,
        expiryDate: '',
      }];
    });
    setSearch('');
    setResults([]);
  }

  const setLine = (id, key, value) =>
    setLines((c) => c.map((l) => (l.productId === id ? { ...l, [key]: value } : l)));

  const removeLine = (id) => setLines((c) => c.filter((l) => l.productId !== id));

  const total = lines.reduce((sum, l) => sum + (Number(l.quantity) || 0) * (Number(l.unitCost) || 0), 0);
  const invalid = lines.length === 0 || lines.some((l) => !(Number(l.quantity) > 0));

  async function submit(status) {
    if (invalid) return;
    setBusy(true);
    setError('');
    try {
      const order = await purchaseApi.create({
        supplierId: supplierId ? Number(supplierId) : null,
        expectedDate: expectedDate || null,
        note: note.trim() || null,
        status,
        items: lines.map((l) => ({
          productId: l.productId,
          quantity: Number(l.quantity),
          unitCost: Number(l.unitCost) || 0,
          expiryDate: l.expiryDate || null,
        })),
      });
      push(`${order.po_number} created`);
      onSaved();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const unadded = suggestions.filter((s) => !lines.some((l) => l.productId === s.product_id));

  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      title="New order"
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="tnum text-sm text-slate-600">
            {lines.length} line{lines.length === 1 ? '' : 's'} · <span className="font-semibold text-ink">{money(total)}</span>
          </span>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => submit('draft')} loading={busy} disabled={invalid}>
              Save as draft
            </Button>
            <Button onClick={() => submit('ordered')} loading={busy} disabled={invalid}>
              Save and mark sent
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <ErrorNote message={error} />

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Supplier">
            <Select value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
              <option value="">Not specified</option>
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          </Field>
          <Field label="Expected delivery" hint="When they said it will arrive">
            <Input type="date" value={expectedDate} onChange={(e) => setExpectedDate(e.target.value)} className="tnum" />
          </Field>
          <Field label="Note">
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Phoned through" />
          </Field>
        </div>

        {/* Suggestions: what is low, minus what is already on its way */}
        {(loadingSuggestions || unadded.length > 0) && (
          <div className="rounded-lg border border-slate-200 p-4">
            <p className="mb-2 text-sm font-medium">Running low</p>
            {loadingSuggestions ? (
              <Spinner label="Checking stock" />
            ) : (
              <>
                <p className="mb-3 text-xs text-slate-500">
                  Suggested amounts already subtract anything on an open order, so you do not order twice.
                </p>
                <div className="flex flex-wrap gap-2">
                  {unadded.slice(0, 10).map((s) => (
                    <button
                      key={s.product_id}
                      onClick={() => addLine(
                        { id: s.product_id, name: s.name, unit: s.unit, cost_price: s.cost_price },
                        s.suggested_quantity
                      )}
                      className="rounded-lg border border-slate-300 px-3 py-1.5 text-left text-xs hover:bg-slate-50"
                    >
                      <span className="font-medium">{s.name}</span>
                      <span className="tnum block text-slate-500">
                        {number(s.stock_quantity)} left · order {number(s.suggested_quantity)}
                        {s.on_order > 0 && ` · ${number(s.on_order)} coming`}
                      </span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* Product search */}
        <Field label="Add a product">
          <Input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or barcode"
          />
        </Field>

        {results.length > 0 && (
          <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
            {results.map((p) => (
              <li key={p.id}>
                <button
                  onClick={() => addLine(p)}
                  className="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm hover:bg-slate-50"
                >
                  <span>
                    <span className="font-medium">{p.name}</span>
                    <span className="tnum block text-xs text-slate-500">
                      {number(p.stock_quantity)} in stock · cost {money(p.cost_price)}
                    </span>
                  </span>
                  <span className="text-xs font-medium text-brand-600">Add</span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {/* The order lines */}
        {lines.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-500">
            Nothing on this order yet. Pick from the low-stock list or search above.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2 font-medium">Product</th>
                  <th className="px-3 py-2 font-medium">Quantity</th>
                  <th className="px-3 py-2 font-medium">Unit cost</th>
                  <th className="px-3 py-2 font-medium">Expiry expected</th>
                  <th className="px-3 py-2 text-right font-medium">Total</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {lines.map((l) => (
                  <tr key={l.productId}>
                    <td className="px-3 py-2 font-medium">{l.name}</td>
                    <td className="px-3 py-2">
                      <input type="number" min="1" value={l.quantity}
                             onChange={(e) => setLine(l.productId, 'quantity', e.target.value)}
                             className="tnum h-9 w-20 rounded-lg border border-slate-300 px-2 text-sm" />
                    </td>
                    <td className="px-3 py-2">
                      <input type="number" min="0" step="0.01" value={l.unitCost}
                             onChange={(e) => setLine(l.productId, 'unitCost', e.target.value)}
                             className="tnum h-9 w-24 rounded-lg border border-slate-300 px-2 text-sm" />
                    </td>
                    <td className="px-3 py-2">
                      <input type="date" value={l.expiryDate}
                             onChange={(e) => setLine(l.productId, 'expiryDate', e.target.value)}
                             className="tnum h-9 rounded-lg border border-slate-300 px-2 text-sm" />
                    </td>
                    <td className="tnum px-3 py-2 text-right font-medium">
                      {money((Number(l.quantity) || 0) * (Number(l.unitCost) || 0))}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button onClick={() => removeLine(l.productId)}
                              className="rounded-md px-2 py-1 text-xs font-medium text-danger-fg hover:bg-danger-bg">
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="rounded-lg bg-slate-50 px-4 py-3 text-xs text-slate-600">
          Saving this does not change your stock. The goods are added to the shelf when you
          record the delivery, and each delivery becomes its own batch with its own expiry date.
        </p>
      </div>
    </Modal>
  );
}
