import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/axios";
import { clearAuth } from "../auth/auth";
import { useLanguage } from "../i18n/LanguageContext";
import "./AuthPage.css";

export default function ChangePassword() {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const tr = (en, fr, ar) => (language === "fr" ? fr : language === "ar" ? ar : en);
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
      setSuccess(tr("Password changed. Please login again.", "Mot de passe modifié. Veuillez vous reconnecter.", "تم تغيير كلمة المرور. يرجى تسجيل الدخول من جديد."));
      clearAuth();
      setTimeout(() => navigate("/login"), 800);
    } catch (err) {
      const d = err.response?.data;
      const msg = d?.message || (d?.errors ? Object.values(d.errors).flat().join(" ") : tr("Failed to change password.", "Échec du changement de mot de passe.", "فشل تغيير كلمة المرور."));
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
          <h1 className="auth-title">{tr("Change password", "Changer le mot de passe", "تغيير كلمة المرور")}</h1>
          <p className="auth-subtitle">{tr("Update your account password", "Mettez à jour le mot de passe de votre compte", "قم بتحديث كلمة مرور حسابك")}</p>

          <form className="auth-form" onSubmit={handleSubmit}>
            {error && <p className="auth-error">{error}</p>}
            {success && <p className="auth-success">{success}</p>}

            <label className="auth-label">{tr("Current password", "Mot de passe actuel", "كلمة المرور الحالية")}</label>
            <input className="auth-input" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />

            <label className="auth-label">{tr("New password", "Nouveau mot de passe", "كلمة المرور الجديدة")}</label>
            <input className="auth-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />

            <label className="auth-label">{tr("Confirm new password", "Confirmer le nouveau mot de passe", "تأكيد كلمة المرور الجديدة")}</label>
            <input className="auth-input" type="password" value={passwordConfirmation} onChange={(e) => setPasswordConfirmation(e.target.value)} required />

            <button type="submit" className="auth-btn" disabled={loading}>
              {loading ? tr("Saving...", "Enregistrement...", "جارٍ الحفظ...") : tr("Save", "Enregistrer", "حفظ")}
            </button>

            <button type="button" className="auth-btn-link" onClick={() => navigate(-1)} style={{ marginTop: 10 }}>
              ← {tr("Back", "Retour", "رجوع")}
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

