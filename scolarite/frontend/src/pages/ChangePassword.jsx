import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/axios";
import { clearAuth } from "../auth/auth";
import "./AuthPage.css";

export default function ChangePassword() {
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);
    try {
      await api.post("/change-password", {
        current_password: currentPassword,
        password,
        password_confirmation: passwordConfirmation,
      });
      setSuccess("Password changed. Please login again.");
      clearAuth();
      setTimeout(() => navigate("/login"), 800);
    } catch (err) {
      const d = err.response?.data;
      const msg = d?.message || (d?.errors ? Object.values(d.errors).flat().join(" ") : "Failed to change password.");
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <section className="auth-left">
          <div className="auth-logo">
            <span className="auth-logo-pill">Scolarité</span>
          </div>
          <h1 className="auth-title">Change password</h1>
          <p className="auth-subtitle">Update your account password</p>

          <form className="auth-form" onSubmit={handleSubmit}>
            {error && <p className="auth-error">{error}</p>}
            {success && <p className="auth-success">{success}</p>}

            <label className="auth-label">Current password</label>
            <input className="auth-input" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />

            <label className="auth-label">New password</label>
            <input className="auth-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />

            <label className="auth-label">Confirm new password</label>
            <input className="auth-input" type="password" value={passwordConfirmation} onChange={(e) => setPasswordConfirmation(e.target.value)} required />

            <button type="submit" className="auth-btn" disabled={loading}>
              {loading ? "Saving..." : "Save"}
            </button>

            <button type="button" className="auth-btn-link" onClick={() => navigate(-1)} style={{ marginTop: 10 }}>
              ← Back
            </button>
          </form>
        </section>

        <section className="auth-right">
          <button type="button" className="auth-close" aria-label="Close" onClick={() => navigate(-1)}>
            ✕
          </button>
          <div className="auth-hero" />
        </section>
      </div>
    </div>
  );
}

