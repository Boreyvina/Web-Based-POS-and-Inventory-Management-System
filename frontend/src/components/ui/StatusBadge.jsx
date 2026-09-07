import { Badge } from './Feedback';

const ORDER_STATUS = {
  draft:     { tone: 'neutral', label: 'Draft' },
  ordered:   { tone: 'warn',    label: 'On order' },
  partial:   { tone: 'warn',    label: 'Part delivered' },
  received:  { tone: 'ok',      label: 'Received' },
  cancelled: { tone: 'danger',  label: 'Cancelled' },
};

export default function StatusBadge({ status }) {
  const s = ORDER_STATUS[status] || { tone: 'neutral', label: status };
  return <Badge tone={s.tone}>{s.label}</Badge>;
}

export { ORDER_STATUS };
