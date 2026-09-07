import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { subscribe } from '../utils/customerDisplay';
import { money, number } from '../utils/format';
import { imageSrc } from '../utils/image';
import Thumb from '../components/ui/Thumb';

/**
 * The screen the customer watches while their shopping is scanned. Big type,
 * high contrast, no controls — nobody should be able to change a sale from
 * this side of the counter.
 */
export default function CustomerDisplay() {
  const [cart, setCart] = useState({ lines: [], subtotal: 0, discount: 0, total: 0, itemCount: 0 });
  const [finished, setFinished] = useState(null);
  const [payment, setPayment] = useState(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    const unsubscribe = subscribe((message) => {
      if (message.type === 'cart') {
        setFinished(null);
        setCart(message.payload);
      }
      if (message.type === 'payment') {
        setPayment(message.payload);
      }
      if (message.type === 'sale') {
        setPayment(null);
        setFinished(message.payload);
        // Clear the thank-you after a moment so the screen is ready for the
        // next customer without anyone touching it.
        setTimeout(() => setFinished(null), 12000);
      }
    });
    return unsubscribe;
  }, []);

  // Draw the code once the canvas is on screen. Large, because the customer is
  // holding a phone at arm's length on the other side of a counter.
  useEffect(() => {
    if (payment?.mode !== 'payload' || !canvasRef.current) return;
    QRCode.toCanvas(canvasRef.current, payment.payload, {
      width: 320,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: { dark: '#0B1F24', light: '#FFFFFF' },
    }).catch(() => {});
  }, [payment]);

  // Paying by QR takes over the whole screen: at that moment the only thing
  // the customer needs is the code and the amount.
  if (payment && !finished) {
    return (
      <div className="grid min-h-screen place-items-center bg-ink px-6 py-10 text-center text-white">
        <div className="flex flex-col items-center">
          <p className="text-2xl font-medium text-white/70">Scan to pay</p>

          <div className="my-8 rounded-2xl bg-white p-5">
            {payment.mode === 'payload' ? (
              <canvas ref={canvasRef} aria-label="Payment QR code" />
            ) : (
              <img
                src={imageSrc(payment.imageUrl)}
                alt="Shop payment QR code"
                className="h-[320px] w-[320px] object-contain"
              />
            )}
          </div>

          <p className="tnum text-6xl font-semibold tracking-tight">{money(payment.amount)}</p>

          {payment.merchantName && (
            <p className="mt-3 text-lg text-white/60">{payment.merchantName}</p>
          )}

          {payment.mode === 'image' && (
            <p className="mt-4 max-w-sm text-white/50">
              Please enter the amount above in your banking app.
            </p>
          )}
        </div>
      </div>
    );
  }

  if (finished) {
    return (
      <div className="grid min-h-screen place-items-center bg-ink px-6 text-center text-white">
        <div>
          <p className="text-5xl font-semibold tracking-tight">Thank you</p>
          <p className="tnum mt-6 text-7xl font-semibold">{money(finished.total_amount)}</p>
          {Number(finished.change_due) > 0 && (
            <p className="tnum mt-6 text-3xl text-white/70">
              Your change: {money(finished.change_due)}
            </p>
          )}
          <p className="tnum mt-8 text-sm text-white/50">{finished.invoice_no}</p>
        </div>
      </div>
    );
  }

  const empty = cart.lines.length === 0;

  return (
    <div className="flex min-h-screen flex-col bg-ink text-white">
      <header className="flex items-baseline justify-between px-8 py-6">
        <h1 className="text-2xl font-semibold tracking-tight">Your items</h1>
        {!empty && (
          <span className="tnum text-lg text-white/60">
            {number(cart.itemCount)} item{cart.itemCount === 1 ? '' : 's'}
          </span>
        )}
      </header>

      {empty ? (
        <div className="grid flex-1 place-items-center px-8 text-center">
          <div>
            <p className="text-3xl font-medium text-white/80">Welcome</p>
            <p className="mt-2 text-lg text-white/50">Your items will appear here as they are scanned</p>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-8">
          <ul className="divide-y divide-white/10">
            {cart.lines.map((l) => (
              <li key={l.id} className="flex items-center gap-4 py-4">
                <Thumb src={l.image} size="md" className="!bg-white/10" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xl font-medium">{l.name}</p>
                  <p className="tnum text-sm text-white/50">
                    {number(l.quantity)} × {money(l.price)}
                    {l.discount > 0 && ` − ${money(l.discount)} off`}
                  </p>
                </div>
                <p className="tnum text-xl font-semibold">{money(l.price * l.quantity - l.discount)}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      <footer className="border-t border-white/15 px-8 py-6">
        {cart.discount > 0 && (
          <div className="tnum mb-2 flex justify-between text-lg text-white/60">
            <span>Discount</span>
            <span>− {money(cart.discount)}</span>
          </div>
        )}
        <div className="tnum flex items-baseline justify-between">
          <span className="text-2xl font-medium text-white/70">Total</span>
          <span className="text-6xl font-semibold tracking-tight">{money(cart.total)}</span>
        </div>
      </footer>
    </div>
  );
}
