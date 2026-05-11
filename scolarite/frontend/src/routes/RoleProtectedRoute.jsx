import { Navigate } from "react-router-dom";
import { useAuth } from "../auth/useAuth";

export default function RoleProtectedRoute({ children, allow = [] }) {
  const auth = useAuth();
  if (auth.loading) return null;
  if (!auth.isAuthed) return <Navigate to="/login" replace />;
  if (Array.isArray(allow) && allow.length > 0 && !allow.includes(auth.role)) return <Navigate to="/" replace />;
  return children;
}

