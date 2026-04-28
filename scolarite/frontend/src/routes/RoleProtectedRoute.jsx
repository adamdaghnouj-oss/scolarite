import { Navigate } from "react-router-dom";
import { isAuthed } from "../auth/auth";

function getUserRole() {
  try {
    const raw = localStorage.getItem("user");
    const user = raw ? JSON.parse(raw) : null;
    return user?.role || null;
  } catch {
    return null;
  }
}

export default function RoleProtectedRoute({ children, allow = [] }) {
  if (!isAuthed()) return <Navigate to="/login" replace />;
  const role = getUserRole();
  if (Array.isArray(allow) && allow.length > 0 && !allow.includes(role)) return <Navigate to="/" replace />;
  return children;
}

