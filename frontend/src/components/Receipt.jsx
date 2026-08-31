import Modal from './ui/Modal';
import Button from './ui/Button';
import { money, dateTime } from '../utils/format';

/**
 * The printable receipt. Everything outside #receipt is hidden by the
 * @media print rules in index.css, so window.print() produces just this,
 * sized for an 80mm thermal roll.
 */
export default function Receipt({ open, onClose, sale, onNewSale }) {
  if (!sale) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Receipt"
      footer={
        <div className="no-print flex justify-end gap-3">
          <Button variant="secondary" onClick={() => window.print()}>Print</Button>
          {onNewSale ? (
            <Button onClick={onNewSale}>Start next sale</Button>
          ) : (
            <Button onClick={onClose}>Done</Button>
          )}
        </div>
      }
    >
      <div id="receipt" className="mx-auto max-w-[320px] bg-white p-4 font-mono text-[13px] leading-relaxed text-ink">
        <div className="text-center">
          <p className="text-base font-semibold">{sale.store?.name}</p>
          {sale.store?.address && <p className="text-[11px]">{sale.store.address}</p>}
          {sale.store?.phone && <p className="text-[11px]">{sale.store.phone}</p>}
        </div>

        <Rule />

        <Row label="Receipt" value={sale.invoice_no} />
        <Row label="Date" value={dateTime(sale.created_at)} />
        <Row label="Served by" value={sale.cashier_name} />
        {sale.status !== 'completed' && (
          <p className="mt-2 text-center font-semibold uppercase tracking-wide">*** {sale.status} ***</p>
        )}

        <Rule />

        {sale.items?.map((item) => (
          <div key={item.id} className="mb-1.5">
            <p className="font-sans text-[12px] font-medium">{item.product_name}</p>
            <div className="flex justify-between tabular-nums">
              <span>
                {item.quantity} × {money(item.unit_price)}
                {Number(item.line_discount) > 0 && ` − ${money(item.line_discount)}`}
              </span>
              <span>{money(item.line_total)}</span>
            </div>
          </div>
        ))}

        <Rule />

        <Row label="Subtotal" value={money(sale.subtotal)} tabular />
        {Number(sale.discount_amount) > 0 && (
          <Row label="Discount" value={`− ${money(sale.discount_amount)}`} tabular />
        )}
        {Number(sale.tax_amount) > 0 && <Row label="Tax" value={money(sale.tax_amount)} tabular />}

        <div className="mt-1 flex justify-between border-t border-dashed border-ink pt-1 text-[15px] font-semibold tabular-nums">
          <span>TOTAL</span>
          <span>{money(sale.total_amount)}</span>
        </div>

        <div className="mt-2">
          <Row label={`Paid (${sale.payment_method})`} value={money(sale.amount_paid)} tabular />
          {Number(sale.change_due) > 0 && <Row label="Change" value={money(sale.change_due)} tabular />}
        </div>

        <Rule />

        <p className="text-center text-[11px]">Thank you — please keep this receipt</p>
      </div>
    </Modal>
  );
}

function Rule() {
  return <div className="my-2 border-t border-dashed border-slate-400" />;
}

function Row({ label, value, tabular }) {
  return (
    <div className={`flex justify-between gap-3 ${tabular ? 'tabular-nums' : ''}`}>
      <span className="text-slate-600">{label}</span>
      <span className="text-right">{value}</span>
    </div>
  );
}
