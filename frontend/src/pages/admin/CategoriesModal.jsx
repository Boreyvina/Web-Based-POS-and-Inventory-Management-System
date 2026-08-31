import { useState } from 'react';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import { Input } from '../../components/ui/Field';
import { ErrorNote } from '../../components/ui/Feedback';
import { categoryApi } from '../../api/endpoints';
import { useToast } from '../../components/ui/Toast';

export default function CategoriesModal({ open, onClose, onChanged, categories }) {
  const { push } = useToast();
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function add(e) {
    e.preventDefault();
    if (name.trim().length < 2) return;
    setBusy(true);
    setError('');
    try {
      await categoryApi.create({ name: name.trim() });
      setName('');
      push('Category added');
      onChanged();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(cat) {
    setError('');
    try {
      await categoryApi.remove(cat.id);
      push(`${cat.name} deleted`);
      onChanged();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Categories">
      <div className="space-y-4">
        <ErrorNote message={error} />

        <form onSubmit={add} className="flex gap-2">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="New category name" />
          <Button type="submit" loading={busy} disabled={name.trim().length < 2}>Add</Button>
        </form>

        {categories.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-500">
            No categories yet. Add one above to start grouping products.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {categories.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 py-3">
                <div>
                  <p className="text-sm font-medium">{c.name}</p>
                  <p className="tnum text-xs text-slate-500">{c.product_count} product{c.product_count === 1 ? '' : 's'}</p>
                </div>
                <button
                  onClick={() => remove(c)}
                  disabled={c.product_count > 0}
                  title={c.product_count > 0 ? 'Move its products elsewhere first' : 'Delete category'}
                  className="rounded-md px-2.5 py-1.5 text-xs font-medium text-danger-fg hover:bg-danger-bg disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:bg-transparent"
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  );
}
