import { Navigate } from "react-router-dom";
import { useAuth } from "../auth/useAuth";

export default function ProtectedRoute({ children }) {
  const auth = useAuth();
  if (auth.loading) return null;
  if (!auth.isAuthed) return <Navigate to="/login" replace />;
  return children;
}