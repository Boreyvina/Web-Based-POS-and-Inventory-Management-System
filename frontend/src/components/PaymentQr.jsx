import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { paymentApi } from '../api/endpoints';
import { imageSrc } from '../utils/image';
import { money } from '../utils/format';
import { Spinner, ErrorNote } from './ui/Feedback';

/**
 * Shows the bank QR the customer scans.
 *
 * Two modes, decided by the backend:
 *  - "payload": we generate a code that already carries the amount, so the
 *    customer scans and confirms.
 *  - "image": the shop's saved QR picture, with the amount printed beside it
 *    for the customer to type in.
 */
export default function PaymentQr({ amount, reference }) {
  const canvasRef = useRef(null);
  const [state, setState] = useState({ loading: true, error: '', data: null });

  useEffect(() => {
    let cancelled = false;
    setState({ loading: true, error: '', data: null });

    paymentApi
      .qr(amount, reference)
      .then((data) => {
        if (cancelled) return;
        setState({ loading: false, error: '', data });
      })
      .catch((err) => {
        if (!cancelled) setState({ loading: false, error: err.message, data: null });
      });

    return () => { cancelled = true; };
  }, [amount, reference]);

  // Draw once the canvas exists and we have a payload.
  useEffect(() => {
    if (state.data?.mode !== 'payload' || !canvasRef.current) return;
    QRCode.toCanvas(canvasRef.current, state.data.payload, {
      width: 220,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: { dark: '#0B1F24', light: '#FFFFFF' },
    }).catch(() => {
      setState((s) => ({ ...s, error: 'Could not draw the QR code' }));
    });
  }, [state.data]);

  if (state.loading) return <Spinner label="Preparing the QR code" />;
  if (state.error) return <ErrorNote message={state.error} />;

  const { data } = state;

  return (
    <div className="flex flex-col items-center gap-3 rounded-lg bg-slate-50 p-4">
      <p className="text-sm text-slate-600">Ask the customer to scan</p>

      {data.mode === 'payload' ? (
        <canvas ref={canvasRef} className="rounded-lg bg-white p-2" aria-label="Payment QR code" />
      ) : (
        <>
          <img
            src={imageSrc(data.imageUrl)}
            alt="Shop bank QR code"
            className="h-[220px] w-[220px] rounded-lg bg-white object-contain p-2"
          />
          <p className="text-center text-xs text-slate-500">
            This code has no amount in it — the customer types it in their app.
          </p>
        </>
      )}

      <div className="text-center">
        <p className="tnum text-2xl font-semibold">{money(amount)}</p>
        {data.merchantName && <p className="text-xs text-slate-500">{data.merchantName}</p>}
      </div>

      <p className="text-center text-xs text-slate-500">
        Only press Take payment once you have seen the money arrive in your banking app.
      </p>
    </div>
  );
}
