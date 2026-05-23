import { Navigate } from "react-router-dom";
import { isAdminUser } from "../utils/adminAccess";
import { useAuth } from "../context/AuthContext";

const ProtectedRoute = ({ children, adminOnly = false }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="min-h-screen bg-surface flex items-center justify-center text-primary-400">Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/login" />;
  }

  if (adminOnly && !isAdminUser(user)) {
    return <Navigate to="/" replace />;
  }

  return children;
};

export default ProtectedRoute;
