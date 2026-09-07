import { useEffect, useState } from 'react';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import { Field, Input, Select } from '../../components/ui/Field';
import { ErrorNote } from '../../components/ui/Feedback';
import { authApi } from '../../api/endpoints';
import { useToast } from '../../components/ui/Toast';

const BLANK = { fullName: '', username: '', email: '', phone: '', role: 'cashier', password: '', confirm: '' };

export default function StaffFormModal({ open, onClose, onSaved }) {
  const { push } = useToast();
  const [form, setForm] = useState(BLANK);
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(BLANK);
    setErrors({});
    setServerError('');
  }, [open]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  function validate() {
    const next = {};
    if (form.fullName.trim().length < 2) next.fullName = 'Enter their name';
    if (!/^[a-zA-Z0-9._-]{3,50}$/.test(form.username.trim())) {
      next.username = '3–50 characters: letters, numbers, dot, dash or underscore';
    }
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) next.email = 'Enter a valid email';
    if (form.password.length < 6) next.password = 'At least 6 characters';
    if (form.password !== form.confirm) next.confirm = 'The two passwords do not match';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!validate()) return;
    setBusy(true);
    setServerError('');
    try {
      await authApi.register({
        fullName: form.fullName.trim(),
        username: form.username.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || undefined,
        role: form.role,
        password: form.password,
      });
      push(`${form.fullName.trim()} can now sign in`);
      onSaved();
      onClose();
    } catch (err) {
      setServerError(err.message);
      if (err.details) setErrors(Object.fromEntries(err.details.map((d) => [d.field, d.message])));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add staff member"
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} loading={busy}>Create account</Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <ErrorNote message={serverError} />

        <Field label="Full name" required error={errors.fullName}>
          <Input value={form.fullName} onChange={set('fullName')} error={errors.fullName} placeholder="Sokha Chan" autoFocus />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Username" required error={errors.username} hint="What they type to sign in">
            <Input value={form.username} onChange={set('username')} error={errors.username} placeholder="sokha" autoComplete="off" />
          </Field>

          <Field label="Role" required hint={form.role === 'admin' ? 'Full access, including reports' : 'Till and own sales only'}>
            <Select value={form.role} onChange={set('role')}>
              <option value="cashier">Cashier</option>
              <option value="admin">Admin</option>
            </Select>
          </Field>

          <Field label="Email" required error={errors.email}>
            <Input type="email" value={form.email} onChange={set('email')} error={errors.email} placeholder="sokha@store.local" autoComplete="off" />
          </Field>

          <Field label="Phone" error={errors.phone}>
            <Input value={form.phone} onChange={set('phone')} className="tnum" placeholder="012 345 678" />
          </Field>

          <Field label="Password" required error={errors.password} hint="At least 6 characters">
            <Input type="password" value={form.password} onChange={set('password')} error={errors.password} autoComplete="new-password" />
          </Field>

          <Field label="Repeat password" required error={errors.confirm}>
            <Input type="password" value={form.confirm} onChange={set('confirm')} error={errors.confirm} autoComplete="new-password" />
          </Field>
        </div>

        <p className="rounded-lg bg-slate-50 px-4 py-3 text-xs text-slate-600">
          Write the password down and hand it over in person. It is stored encrypted, so nobody —
          including you — can read it back afterwards. If they forget it, create a new one for them.
        </p>
      </form>
    </Modal>
  );
}
