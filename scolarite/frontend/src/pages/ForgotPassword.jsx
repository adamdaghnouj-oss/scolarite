import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/axios";
import "./AuthPage.css";
import authImg from "../assets/0ee83043fa17432d636e62339bf14c06.gif";
import { useLanguage } from "../i18n/LanguageContext";

function useLiveTime() {
  const [time, setTime] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return time.toLocaleTimeString("en-US", { hour12: true, hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export default function ForgotPassword() {
  const navigate = useNavigate();
  const liveTime = useLiveTime();
  const { t } = useLanguage();
  const [step, setStep] = useState(1); // 1=email, 2=code+new password
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function sendCode(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      await api.post("/forgot-password", { email });
      setSuccess("If the email exists, a reset code was sent.");
      setStep(2);
    } catch (err) {
      const d = err.response?.data;
      setError(d?.message || "Failed to send reset code.");
    } finally {
      setLoading(false);
    }
  }

  async function resetPassword(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      await api.post("/reset-password", {
        email,
        code,
        password,
        password_confirmation: passwordConfirmation,
      });
      setSuccess("Password reset successfully. Redirecting to login...");
      setTimeout(() => navigate("/login"), 900);
    } catch (err) {
      const d = err.response?.data;
      const msg = d?.message || (d?.errors ? Object.values(d.errors).flat().join(" ") : "Reset failed.");
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
            <span className="auth-logo-pill">University</span>
          </div>

          <h1 className="auth-title">{t("welcomeUniversity")}</h1>
          <p className="auth-subtitle">{t("resetPasswordSubtitle")}</p>

          {error && <p className="auth-error">{error}</p>}
          {success && <p className="auth-success">{success}</p>}

          {step === 1 ? (
            <form className="auth-form" onSubmit={sendCode}>
              <label className="auth-label">{t("email")}</label>
              <input className="auth-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@email.com" />

              <button type="submit" className="auth-btn" disabled={loading}>
                {loading ? t("sending") : t("sendCode")}
              </button>

              <div className="auth-footer">
                <p>
                  {t("backToLogin")} <Link to="/login">{t("login")}</Link>
                </p>
              </div>
            </form>
          ) : (
            <form className="auth-form" onSubmit={resetPassword}>
              <label className="auth-label">{t("code")}</label>
              <input
                className="auth-input"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="123456"
                maxLength={6}
                required
              />

              <label className="auth-label">{t("newPassword")}</label>
              <input className="auth-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />

              <label className="auth-label">{t("confirmNewPassword")}</label>
              <input className="auth-input" type="password" value={passwordConfirmation} onChange={(e) => setPasswordConfirmation(e.target.value)} required />

              <button type="submit" className="auth-btn" disabled={loading || code.length < 6}>
                {loading ? t("resetting") : t("resetPassword")}
              </button>

              <button type="button" className="auth-btn-link" onClick={() => setStep(1)} style={{ marginTop: 10 }}>
                ← {t("changeEmail")}
              </button>
            </form>
          )}
        </section>

        <section className="auth-right">
          <button type="button" className="auth-close" aria-label="Close" onClick={() => navigate("/")}>
            ✕
          </button>
          <div className="auth-hero">
            <img className="auth-hero-img" src={authImg} alt="Campus" />
            <div className="auth-hero-copy">
              <p className="auth-hero-quote">{t("quote")}</p>
            </div>
            <div className="float-card float-card--clock">
              <div className="float-title">{t("currentTime")}</div>
              <div className="float-clock-time">{liveTime}</div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

