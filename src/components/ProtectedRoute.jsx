import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

const ProtectedRoute = ({ children, adminOnly = false }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="min-h-screen bg-surface flex items-center justify-center text-primary-400">Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/login" />;
  }

  if (adminOnly && !(user?.role?.toLowerCase() === 'admin' || user?.isAdmin)) {
    toast.error("Access Denied: Administrator privileges required.");
    return <Navigate to="/dashboard" />;
  }

  return children;
};

export default ProtectedRoute;