import { useCallback, useEffect, useState } from 'react';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import { Field, Input } from '../../components/ui/Field';
import { ErrorNote, Spinner } from '../../components/ui/Feedback';
import { useToast } from '../../components/ui/Toast';
import { supplierApi } from '../../api/endpoints';
import { dateOnly } from '../../utils/format';

const BLANK = { name: '', contactPerson: '', phone: '', email: '' };

export default function SuppliersModal({ open, onClose }) {
  const { push } = useToast();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState(BLANK);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    supplierApi.list()
      .then(setRows)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { if (open) { setForm(BLANK); setError(''); load(); } }, [open, load]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  async function add(e) {
    e.preventDefault();
    if (form.name.trim().length < 2) return;
    setBusy(true);
    setError('');
    try {
      await supplierApi.create({
        name: form.name.trim(),
        contactPerson: form.contactPerson.trim() || null,
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
      });
      push(`${form.name.trim()} added`);
      setForm(BLANK);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(supplier) {
    try {
      await supplierApi.remove(supplier.id);
      push(`${supplier.name} deactivated`);
      load();
    } catch (err) {
      push(err.message, 'error');
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Suppliers">
      <div className="space-y-4">
        <ErrorNote message={error} />

        <form onSubmit={add} className="grid gap-3 rounded-lg border border-slate-200 p-4 sm:grid-cols-2">
          <Field label="Name" required>
            <Input value={form.name} onChange={set('name')} placeholder="Local Dairy" />
          </Field>
          <Field label="Contact person">
            <Input value={form.contactPerson} onChange={set('contactPerson')} placeholder="Sokha" />
          </Field>
          <Field label="Phone">
            <Input value={form.phone} onChange={set('phone')} className="tnum" placeholder="012 345 678" />
          </Field>
          <Field label="Email">
            <Input type="email" value={form.email} onChange={set('email')} placeholder="orders@dairy.com" />
          </Field>
          <div className="sm:col-span-2">
            <Button type="submit" loading={busy} disabled={form.name.trim().length < 2}>Add supplier</Button>
          </div>
        </form>

        {loading && <Spinner label="Loading suppliers" />}

        {!loading && rows.length === 0 && (
          <p className="py-6 text-center text-sm text-slate-500">No suppliers yet. Add one above.</p>
        )}

        {rows.length > 0 && (
          <ul className="divide-y divide-slate-100">
            {rows.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{s.name}</p>
                  <p className="tnum text-xs text-slate-500">
                    {[s.contact_person, s.phone, s.email].filter(Boolean).join(' · ') || 'No contact details'}
                  </p>
                  <p className="tnum text-xs text-slate-400">
                    {s.order_count} order{s.order_count === 1 ? '' : 's'}
                    {s.last_order_date && ` · last ${dateOnly(s.last_order_date)}`}
                  </p>
                </div>
                <button onClick={() => remove(s)}
                        className="rounded-md px-2.5 py-1.5 text-xs font-medium text-danger-fg hover:bg-danger-bg">
                  Deactivate
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  );
}
