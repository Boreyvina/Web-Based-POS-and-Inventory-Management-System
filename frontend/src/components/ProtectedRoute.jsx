import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Spinner } from './ui/Feedback';

/**
 * Route guard. This is convenience, not security — the backend re-checks the
 * role on every request. Hiding a page never protects the data behind it.
 */
export default function ProtectedRoute({ allow, children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <Spinner label="Checking your session" />;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  if (allow && !allow.includes(user.role)) return <Navigate to="/" replace />;

  return children;
}
