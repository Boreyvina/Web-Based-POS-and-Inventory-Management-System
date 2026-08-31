import { useCallback, useEffect, useState } from 'react';
import { PageHeader } from '../../components/Layout';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import { Badge, EmptyState, ErrorNote, Spinner } from '../../components/ui/Feedback';
import { useToast } from '../../components/ui/Toast';
import { useAuth } from '../../context/AuthContext';
import StaffFormModal from './StaffFormModal';
import { authApi } from '../../api/endpoints';
import { dateTime } from '../../utils/format';

export default function Staff() {
  const { user } = useAuth();
  const { push } = useToast();

  const [state, setState] = useState({ loading: true, error: '', rows: [] });
  const [formOpen, setFormOpen] = useState(false);
  const [confirming, setConfirming] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setState((s) => ({ ...s, loading: true, error: '' }));
    authApi
      .listUsers()
      .then((rows) => setState({ loading: false, error: '', rows }))
      .catch((err) => setState({ loading: false, error: err.message, rows: [] }));
  }, []);

  useEffect(load, [load]);

  async function confirmToggle() {
    setBusy(true);
    try {
      await authApi.setStatus(confirming.id, !confirming.is_active);
      push(confirming.is_active ? `${confirming.full_name} can no longer sign in` : `${confirming.full_name} can sign in again`);
      setConfirming(null);
      load();
    } catch (err) {
      push(err.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  const { loading, error, rows } = state;

  return (
    <>
      <PageHeader
        title="Staff"
        description="Who can sign in, and what they are allowed to do"
        action={<Button onClick={() => setFormOpen(true)}>Add staff member</Button>}
      />

      <div className="p-4 sm:p-6">
        {error && <ErrorNote message={error} onRetry={load} />}
        {loading && <Spinner label="Loading staff" />}

        {!loading && !error && rows.length === 0 && (
          <div className="rounded-xl bg-white shadow-card">
            <EmptyState
              title="No staff accounts yet"
              description="Add a cashier so they can open the till without using your admin login."
              action={<Button onClick={() => setFormOpen(true)}>Add staff member</Button>}
            />
          </div>
        )}

        {!loading && rows.length > 0 && (
          <>
            <div className="hidden overflow-hidden rounded-xl bg-white shadow-card lg:block">
              <table className="w-full text-sm">
                <thead className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">Name</th>
                    <th className="px-4 py-3 font-medium">Role</th>
                    <th className="px-4 py-3 font-medium">Contact</th>
                    <th className="px-4 py-3 font-medium">Last signed in</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50/60">
                      <td className="px-4 py-3">
                        <p className="font-medium">
                          {u.full_name}
                          {u.id === user.id && <span className="ml-2 text-xs font-normal text-slate-500">(you)</span>}
                        </p>
                        <p className="tnum text-xs text-slate-500">{u.username}</p>
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone={u.role === 'admin' ? 'ok' : 'neutral'}>{u.role}</Badge>
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        <p>{u.email}</p>
                        {u.phone && <p className="tnum text-xs text-slate-500">{u.phone}</p>}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{u.last_login_at ? dateTime(u.last_login_at) : 'Never'}</td>
                      <td className="px-4 py-3">
                        {u.is_active ? <Badge tone="ok">Active</Badge> : <Badge tone="danger">Blocked</Badge>}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {u.id !== user.id && (
                          <button
                            onClick={() => setConfirming(u)}
                            className={`rounded-md px-2.5 py-1.5 text-xs font-medium ${
                              u.is_active ? 'text-danger-fg hover:bg-danger-bg' : 'text-brand-600 hover:bg-brand-50'
                            }`}
                          >
                            {u.is_active ? 'Block' : 'Unblock'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="space-y-3 lg:hidden">
              {rows.map((u) => (
                <div key={u.id} className="rounded-xl bg-white p-4 shadow-card">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium">
                        {u.full_name}
                        {u.id === user.id && <span className="ml-2 text-xs font-normal text-slate-500">(you)</span>}
                      </p>
                      <p className="tnum text-xs text-slate-500">{u.username} · {u.email}</p>
                    </div>
                    <Badge tone={u.role === 'admin' ? 'ok' : 'neutral'}>{u.role}</Badge>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    {u.is_active ? <Badge tone="ok">Active</Badge> : <Badge tone="danger">Blocked</Badge>}
                    {u.id !== user.id && (
                      <button
                        onClick={() => setConfirming(u)}
                        className={`rounded-md px-2.5 py-1.5 text-xs font-medium ${
                          u.is_active ? 'text-danger-fg hover:bg-danger-bg' : 'text-brand-600'
                        }`}
                      >
                        {u.is_active ? 'Block' : 'Unblock'}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <StaffFormModal open={formOpen} onClose={() => setFormOpen(false)} onSaved={load} />

      <Modal
        open={Boolean(confirming)}
        onClose={() => setConfirming(null)}
        title={confirming?.is_active ? 'Block this account' : 'Unblock this account'}
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setConfirming(null)}>Cancel</Button>
            <Button variant={confirming?.is_active ? 'danger' : 'primary'} loading={busy} onClick={confirmToggle}>
              {confirming?.is_active ? 'Block account' : 'Unblock account'}
            </Button>
          </div>
        }
      >
        <p className="text-sm text-slate-600">
          {confirming?.is_active ? (
            <>
              <span className="font-medium text-ink">{confirming?.full_name}</span> will be signed out and cannot
              log in again until you unblock them. Their past sales stay in the records, exactly as they are.
              Block rather than delete when someone leaves — deleting would break the link between them and the
              sales they rang up.
            </>
          ) : (
            <><span className="font-medium text-ink">{confirming?.full_name}</span> will be able to sign in again with their existing password.</>
          )}
        </p>
      </Modal>
    </>
  );
}
