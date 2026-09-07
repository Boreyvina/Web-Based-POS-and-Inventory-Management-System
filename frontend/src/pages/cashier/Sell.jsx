import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Button from '../../components/ui/Button';
import { Input, Select } from '../../components/ui/Field';
import { Badge, ErrorNote, Spinner } from '../../components/ui/Feedback';
import Receipt from '../../components/Receipt';
import { useToast } from '../../components/ui/Toast';
import { categoryApi, productApi, saleApi } from '../../api/endpoints';
import { money, number } from '../../utils/format';
import Thumb from '../../components/ui/Thumb';
import { expiryLabel } from '../../utils/expiry';
import PaymentQr from '../../components/PaymentQr';
import { publishCart, publishSale, publishPayment, openCustomerDisplay } from '../../utils/customerDisplay';

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'card', label: 'Card' },
  { value: 'qr', label: 'QR' },
];

export default function Sell() {
  const { push } = useToast();
  const scanRef = useRef(null);

  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [categories, setCategories] = useState([]);
  const [catalogue, setCatalogue] = useState({ loading: true, error: '', rows: [] });

  const [cart, setCart] = useState([]);
  const [orderDiscount, setOrderDiscount] = useState('');
  const [discountMode, setDiscountMode] = useState('amount'); // 'amount' | 'percent'
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [amountPaid, setAmountPaid] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [receipt, setReceipt] = useState(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [qrForDisplay, setQrForDisplay] = useState(null);

  useEffect(() => {
    categoryApi.list().then(setCategories).catch(() => setCategories([]));
  }, []);

  const loadCatalogue = useCallback(() => {
    setCatalogue((s) => ({ ...s, loading: true, error: '' }));
    productApi
      .list({ search: search || undefined, categoryId: categoryId || undefined, limit: 60 })
      .then((res) => setCatalogue({ loading: false, error: '', rows: res.data }))
      .catch((err) => setCatalogue({ loading: false, error: err.message, rows: [] }));
  }, [search, categoryId]);

  useEffect(() => {
    const t = setTimeout(loadCatalogue, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [loadCatalogue, search]);

  /* ---------------- cart ---------------- */

  const addToCart = useCallback(
    (product) => {
      if (product.stock_quantity <= 0) {
        push(`${product.name} is out of stock`, 'error');
        return;
      }
      // The backend refuses expired items anyway; stopping here means the
      // cashier finds out while the customer is still holding the item,
      // rather than at the moment they try to pay.
      if (product.expiry_status === 'expired') {
        push(`${product.name} has expired — take it off the shelf`, 'error');
        return;
      }
      setError('');
      setCart((current) => {
        const existing = current.find((l) => l.id === product.id);
        if (!existing) {
          return [...current, {
            id: product.id, name: product.name, image: product.image_url,
            price: Number(product.selling_price), stock: product.stock_quantity,
            quantity: 1, discount: 0,
          }];
        }
        if (existing.quantity >= product.stock_quantity) {
          push(`Only ${product.stock_quantity} of ${product.name} left`, 'error');
          return current;
        }
        return current.map((l) => (l.id === product.id ? { ...l, quantity: l.quantity + 1 } : l));
      });
    },
    [push]
  );

  function setQuantity(id, quantity) {
    setCart((current) =>
      current.flatMap((l) => {
        if (l.id !== id) return [l];
        if (quantity <= 0) return [];
        return [{ ...l, quantity: Math.min(quantity, l.stock) }];
      })
    );
  }

  function setLineDiscount(id, value) {
    setCart((current) => current.map((l) => (l.id === id ? { ...l, discount: Math.max(0, Number(value) || 0) } : l)));
  }

  function clearCart() {
    setCart([]);
    setQrForDisplay(null);
    publishPayment(null);
    setOrderDiscount('');
    setDiscountMode('amount');
    setAmountPaid('');
    setError('');
  }

  /* ---------------- totals ---------------- */

  const totals = useMemo(() => {
    const subtotal = cart.reduce((sum, l) => sum + l.price * l.quantity - l.discount, 0);
    // A percentage is turned into an amount here, because the backend only ever
    // stores money. Storing "10%" would make old receipts change meaning if the
    // rule were ever edited.
    const entered = Number(orderDiscount) || 0;
    const raw = discountMode === 'percent' ? (subtotal * Math.min(entered, 100)) / 100 : entered;
    const discount = Math.min(Math.round(raw * 100) / 100, subtotal);
    const total = Math.max(0, subtotal - discount);
    const paid = Number(amountPaid) || 0;
    return {
      subtotal: Math.round(subtotal * 100) / 100,
      discount: Math.round(discount * 100) / 100,
      total: Math.round(total * 100) / 100,
      change: Math.round((paid - total) * 100) / 100,
      itemCount: cart.reduce((n, l) => n + l.quantity, 0),
    };
  }, [cart, orderDiscount, discountMode, amountPaid]);

  // Mirror the cart to the customer-facing screen on every change.
  useEffect(() => {
    publishCart({
      lines: cart.map((l) => ({
        id: l.id, name: l.name, price: l.price, quantity: l.quantity,
        discount: l.discount, image: l.image,
      })),
      subtotal: totals.subtotal,
      discount: totals.discount,
      total: totals.total,
      itemCount: totals.itemCount,
    });
  }, [cart, totals]);

  // Take the code off the customer screen the moment QR stops being the
  // chosen method, the cart empties, or the total changes.
  useEffect(() => {
    if (paymentMethod !== 'qr' || totals.total <= 0) {
      setQrForDisplay(null);
      publishPayment(null);
    }
  }, [paymentMethod, totals.total]);

  const shortPaid = paymentMethod === 'cash' && (Number(amountPaid) || 0) < totals.total;
  const canPay = cart.length > 0 && !shortPaid && !submitting;

  /* ---------------- scanning ---------------- */

  async function handleScan(e) {
    e.preventDefault();
    const code = scanRef.current?.value.trim();
    if (!code) return;
    try {
      const product = await productApi.byBarcode(code);
      addToCart(product);
      scanRef.current.value = '';
    } catch (err) {
      push(err.message, 'error');
      scanRef.current.select();
    }
  }

  /* ---------------- checkout ---------------- */

  async function handleCheckout() {
    setSubmitting(true);
    setError('');
    try {
      const sale = await saleApi.checkout({
        items: cart.map((l) => ({ productId: l.id, quantity: l.quantity, discount: l.discount })),
        paymentMethod,
        amountPaid: paymentMethod === 'cash' ? Number(amountPaid) || 0 : totals.total,
        discountAmount: totals.discount,
      });
      setReceipt(sale);
      publishPayment(null);
      publishSale(sale);
      setCartOpen(false);
      clearCart();
      loadCatalogue(); // stock has moved
    } catch (err) {
      setError(err.message);
      loadCatalogue();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className="lg:flex lg:h-[calc(100vh-0px)]">
        {/* ---------- catalogue ---------- */}
        <div className="min-w-0 flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="mb-3 flex gap-2">
            <form onSubmit={handleScan} className="flex-1">
              <Input
                ref={scanRef}
                autoFocus
                className="tnum h-14 text-base"
                placeholder="Scan barcode, then press Enter"
                aria-label="Scan barcode"
              />
            </form>
            <button
              type="button"
              onClick={openCustomerDisplay}
              title="Opens a second window to face the customer"
              className="hidden h-14 shrink-0 rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-600 hover:bg-slate-50 lg:block"
            >
              Customer screen
            </button>
          </div>

          <div className="mb-4 flex flex-col gap-3 sm:flex-row">
            <Input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search products by name"
              className="sm:max-w-xs"
            />
            <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="sm:max-w-[200px]">
              <option value="">All categories</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </div>

          {catalogue.error && <ErrorNote message={catalogue.error} onRetry={loadCatalogue} />}
          {catalogue.loading && <Spinner label="Loading products" />}

          {!catalogue.loading && catalogue.rows.length === 0 && (
            <p className="py-14 text-center text-sm text-slate-500">
              No products match that search.
            </p>
          )}

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {catalogue.rows.map((p) => {
              const out = p.stock_quantity <= 0;
              const expired = p.expiry_status === 'expired';
              const expiry = expiryLabel(p);
              return (
                <button
                  key={p.id}
                  onClick={() => addToCart(p)}
                  disabled={out || expired}
                  className={`flex flex-col rounded-xl bg-white p-3 text-left shadow-card transition
                    ${out || expired ? 'opacity-50' : 'hover:ring-2 hover:ring-brand-500 active:scale-[0.98]'}
                    ${expired ? 'ring-1 ring-danger-600' : ''}`}
                >
                  <Thumb src={p.image_url} size="md" className="mb-2 self-center" />
                  <span className="line-clamp-2 min-h-[2.5rem] text-sm font-medium">{p.name}</span>
                  <span className="tnum mt-1 text-lg font-semibold">{money(p.selling_price)}</span>
                  <span className={`tnum mt-0.5 text-xs ${out ? 'text-danger-fg' : p.is_low_stock ? 'text-warn-fg' : 'text-slate-500'}`}>
                    {out ? 'Out of stock' : `${number(p.stock_quantity)} ${p.unit} left`}
                  </span>
                  {expiry && expiry.short && (
                    <span className={`mt-1 text-[11px] font-medium ${expired ? 'text-danger-fg' : 'text-warn-fg'}`}>
                      {expired ? 'Expired — do not sell' : `Expires in ${expiry.short}`}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* ---------- cart: fixed panel on desktop, sheet on tablet ---------- */}
        <aside
          className={`flex w-full flex-col border-slate-200 bg-white lg:w-[380px] lg:shrink-0 lg:border-l
            ${cartOpen
              ? 'fixed inset-x-0 bottom-0 top-16 z-40 lg:static lg:inset-auto'
              : 'hidden lg:flex'}`}
        >
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <h2 className="font-semibold">
              Cart {totals.itemCount > 0 && <span className="tnum text-slate-500">· {totals.itemCount}</span>}
            </h2>
            <div className="flex items-center gap-2">
              {cart.length > 0 && (
                <button onClick={clearCart} className="text-sm font-medium text-slate-500 hover:text-danger-fg">
                  Clear
                </button>
              )}
              <button onClick={() => setCartOpen(false)} className="text-sm font-medium text-slate-500 lg:hidden">
                Close
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-5">
            {cart.length === 0 ? (
              <p className="py-14 text-center text-sm text-slate-500">
                Scan an item or tap a product to start a sale.
              </p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {cart.map((l) => (
                  <li key={l.id} className="py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{l.name}</p>
                        <p className="tnum text-xs text-slate-500">{money(l.price)} each</p>
                      </div>
                      <p className="tnum shrink-0 text-sm font-semibold">
                        {money(l.price * l.quantity - l.discount)}
                      </p>
                    </div>

                    <div className="mt-2 flex items-center gap-2">
                      <div className="flex items-center rounded-lg border border-slate-300">
                        <Stepper onClick={() => setQuantity(l.id, l.quantity - 1)} label="Decrease quantity">−</Stepper>
                        <input
                          type="number"
                          value={l.quantity}
                          onChange={(e) => setQuantity(l.id, parseInt(e.target.value, 10) || 0)}
                          className="tnum h-10 w-12 border-x border-slate-300 text-center text-sm"
                          aria-label={`Quantity of ${l.name}`}
                        />
                        <Stepper
                          onClick={() => setQuantity(l.id, l.quantity + 1)}
                          disabled={l.quantity >= l.stock}
                          label="Increase quantity"
                        >
                          +
                        </Stepper>
                      </div>

                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={l.discount || ''}
                        onChange={(e) => setLineDiscount(l.id, e.target.value)}
                        placeholder="Discount"
                        aria-label={`Discount on ${l.name}`}
                        className="tnum h-10 w-24 rounded-lg border border-slate-300 px-2 text-sm"
                      />

                      {l.quantity >= l.stock && <Badge tone="warn">Max</Badge>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* ---------- payment ---------- */}
          <div className="space-y-3 border-t border-slate-200 px-5 py-4">
            {error && <ErrorNote message={error} />}

            <div className="tnum space-y-1 text-sm">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal</span>
                <span>{money(totals.subtotal)}</span>
              </div>
              <div className="flex items-center justify-between gap-2 text-slate-600">
                <label htmlFor="order-discount">Discount</label>
                <div className="flex items-center gap-1.5">
                  <div className="flex overflow-hidden rounded-lg border border-slate-300">
                    {[
                      { key: 'amount', label: '$' },
                      { key: 'percent', label: '%' },
                    ].map((m) => (
                      <button
                        key={m.key}
                        type="button"
                        onClick={() => setDiscountMode(m.key)}
                        className={`h-9 w-9 text-sm font-medium ${
                          discountMode === m.key ? 'bg-ink text-white' : 'bg-white text-slate-500'
                        }`}
                        aria-pressed={discountMode === m.key}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                  <input
                    id="order-discount"
                    type="number"
                    step={discountMode === 'percent' ? '1' : '0.01'}
                    min="0"
                    max={discountMode === 'percent' ? '100' : undefined}
                    value={orderDiscount}
                    onChange={(e) => setOrderDiscount(e.target.value)}
                    placeholder={discountMode === 'percent' ? '0' : '0.00'}
                    className="tnum h-9 w-20 rounded-lg border border-slate-300 px-2 text-right text-sm"
                  />
                </div>
              </div>
              {totals.discount > 0 && (
                <div className="tnum flex justify-between text-brand-700">
                  <span>You saved</span>
                  <span>− {money(totals.discount)}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-slate-200 pt-2 text-xl font-semibold">
                <span>Total</span>
                <span>{money(totals.total)}</span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-1.5">
              {PAYMENT_METHODS.map((m) => (
                <button
                  key={m.value}
                  onClick={() => setPaymentMethod(m.value)}
                  className={`h-10 rounded-lg text-sm font-medium ${
                    paymentMethod === m.value ? 'bg-ink text-white' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>

            {paymentMethod === 'cash' && (
              <>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={amountPaid}
                    onChange={(e) => setAmountPaid(e.target.value)}
                    placeholder="Cash received"
                    aria-label="Cash received"
                    className="tnum h-12 flex-1 rounded-lg border border-slate-300 px-3 text-lg"
                  />
                  <button
                    onClick={() => setAmountPaid(String(totals.total))}
                    className="h-12 rounded-lg border border-slate-300 px-3 text-sm font-medium text-slate-600"
                  >
                    Exact
                  </button>
                </div>
                {amountPaid !== '' && (
                  <p className={`tnum flex justify-between text-sm font-medium ${shortPaid ? 'text-danger-fg' : 'text-brand-700'}`}>
                    <span>{shortPaid ? 'Still owing' : 'Change'}</span>
                    <span>{money(Math.abs(totals.change))}</span>
                  </p>
                )}
              </>
            )}

            {paymentMethod === 'qr' && totals.total > 0 && (
              <PaymentQr
                amount={totals.total}
                reference={`CART-${totals.itemCount}`}
                onReady={(data) => {
                  setQrForDisplay(data);
                  publishPayment(data);
                }}
              />
            )}

            {paymentMethod === 'card' && (
              <p className="rounded-lg bg-slate-50 px-4 py-3 text-xs text-slate-600">
                Take the card payment on your terminal, then record the sale here.
              </p>
            )}

            <Button size="lg" className="w-full" loading={submitting} disabled={!canPay} onClick={handleCheckout}>
              {cart.length === 0 ? 'Cart is empty' : `Take payment · ${money(totals.total)}`}
            </Button>
          </div>
        </aside>
      </div>

      {/* Cart trigger — tablet only */}
      {!cartOpen && (
        <button
          onClick={() => setCartOpen(true)}
          className="fixed bottom-20 left-1/2 z-30 flex -translate-x-1/2 items-center gap-3 rounded-full bg-ink px-6 py-3.5 text-sm font-semibold text-white shadow-lg lg:hidden"
        >
          <span>View cart</span>
          <span className="tnum rounded-full bg-white/20 px-2 py-0.5">{totals.itemCount}</span>
          <span className="tnum">{money(totals.total)}</span>
        </button>
      )}

      <Receipt
        open={Boolean(receipt)}
        sale={receipt}
        onClose={() => setReceipt(null)}
        onNewSale={() => setReceipt(null)}
      />
    </>
  );
}

function Stepper({ children, label, ...props }) {
  return (
    <button
      aria-label={label}
      className="h-10 w-10 text-lg font-medium text-slate-600 disabled:text-slate-300"
      {...props}
    >
      {children}
    </button>
  );
}
