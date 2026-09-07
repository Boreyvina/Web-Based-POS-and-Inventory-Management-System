import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './components/ui/Toast';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import { Spinner } from './components/ui/Feedback';

import Login from './pages/Login';
import SalesHistory from './pages/SalesHistory';
import Dashboard from './pages/admin/Dashboard';
import Products from './pages/admin/Products';
import Reports from './pages/admin/Reports';
import Staff from './pages/admin/Staff';
import PurchaseOrders from './pages/admin/PurchaseOrders';
import Sell from './pages/cashier/Sell';
import CashierProducts from './pages/cashier/CashierProducts';
import Shop from './pages/customer/Shop';
import CustomerDisplay from './pages/CustomerDisplay';

/** Sends a signed-in user to the right home screen for their role. */
function RoleHome() {
  const { user, loading } = useAuth();
  if (loading) return <Spinner label="Loading" />;
  if (!user) return <Navigate to="/shop" replace />;
  return <Navigate to={user.role === 'admin' ? '/admin' : '/cashier'} replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            <Route path="/" element={<RoleHome />} />
            <Route path="/login" element={<Login />} />
            <Route path="/shop" element={<Shop />} />
            <Route path="/display" element={<CustomerDisplay />} />

            {/* Admin */}
            <Route element={<ProtectedRoute allow={['admin']}><Layout /></ProtectedRoute>}>
              <Route path="/admin" element={<Dashboard />} />
              <Route path="/admin/products" element={<Products />} />
              <Route path="/admin/orders" element={<PurchaseOrders />} />
              <Route path="/admin/sales" element={<SalesHistory />} />
              <Route path="/admin/reports" element={<Reports />} />
              <Route path="/admin/staff" element={<Staff />} />
            </Route>

            {/* Cashier only. An owner who also serves customers needs a
                cashier account of their own — the admin login does not ring
                up sales, so every transaction is attributable to a person. */}
            <Route element={<ProtectedRoute allow={['cashier']}><Layout /></ProtectedRoute>}>
              <Route path="/cashier" element={<Sell />} />
              <Route path="/cashier/sales" element={<SalesHistory />} />
              <Route path="/cashier/products" element={<CashierProducts />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

function NotFound() {
  return (
    <div className="grid min-h-screen place-items-center px-6 text-center">
      <div>
        <p className="tnum text-5xl font-semibold tracking-tight text-slate-300">404</p>
        <h1 className="mt-3 text-lg font-semibold">This page does not exist</h1>
        <p className="mt-1 text-sm text-slate-500">Check the address, or go back to the start.</p>
        <a href="/" className="mt-5 inline-block rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white">
          Back to start
        </a>
      </div>
    </div>
  );
}
