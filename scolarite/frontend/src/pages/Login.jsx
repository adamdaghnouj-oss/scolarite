import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/axios";
import { getStoredRole, isAuthed, setAuth } from "../auth/auth";
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

export default function Login() {
  const navigate = useNavigate();
  const liveTime = useLiveTime();
  const { t } = useLanguage();

  useEffect(() => {
    if (!isAuthed()) return;
    const role = getStoredRole();
    if (role === "administrateur") navigate("/admin", { replace: true });
    else if (role === "directeur_etudes") navigate("/directeur/classes", { replace: true });
    else if (role === "directeur_stage") navigate("/directeur-stage/internships", { replace: true });
    else if (role === "professeur") navigate("/professeur", { replace: true });
  }, [navigate]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [requiresVerification, setRequiresVerification] = useState(false);
  const [resending, setResending] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [verifying, setVerifying] = useState(false);

  async function routeAfterStudentLogin() {
    // Students should only be forced to /profile when their profile is incomplete
    // or not yet approved by the administrator.
    try {
      const profileRes = await api.get("/student/profile");
      const { profile, status } = profileRes.data || {};
      if (status === "approved" && profile) {
        navigate("/", { replace: true });
      } else {
        navigate("/profile", { replace: true });
      }
    } catch {
      // Fail-safe: if we can't verify profile status, send to /profile.
      navigate("/profile", { replace: true });
    }
  }

  async function handleResendOtp() {
    setResending(true);
    try {
      await api.post("/resend-otp", { email });
      setError("");
      alert("Code de vérification renvoyé !");
    } catch (err) {
      const msg = err.response?.data?.message || "Échec de l'envoi du code.";
      setError(msg);
    } finally {
      setResending(false);
    }
  }

  async function handleVerifyOtp(e) {
    e.preventDefault();
    setVerifying(true);
    setError("");
    try {
      const res = await api.post("/verify-otp", { email, code: otpCode });
      setAuth(res.data.token, res.data.user);
      const role = res.data.user?.role;
      if (role === "administrateur" || role === "directeur_etudes" || role === "directeur_stage") {
        navigate(
          role === "directeur_etudes"
            ? "/directeur/classes"
            : role === "directeur_stage"
              ? "/directeur-stage/internships"
              : "/admin"
        );
      } else if (role === "professeur") {
        navigate("/professeur");
      } else if (role === "student") {
        await routeAfterStudentLogin();
      } else {
        navigate("/");
      }
    } catch (err) {
      const data = err.response?.data;
      const msg = data?.message || "Code invalide ou expiré. Réessayez.";
      setError(msg);
      setOtpCode("");
    } finally {
      setVerifying(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await api.post("/login", {
        email,
        password,
      });

      setAuth(res.data.token, res.data.user);
      const role = res.data.user?.role;
      if (role === "administrateur" || role === "directeur_etudes" || role === "directeur_stage") {
        navigate(
          role === "directeur_etudes"
            ? "/directeur/classes"
            : role === "directeur_stage"
              ? "/directeur-stage/internships"
              : "/admin"
        );
      } else if (role === "professeur") {
        navigate("/professeur");
      } else if (role === "student") {
        await routeAfterStudentLogin();
      } else {
        navigate("/");
      }
    } catch (err) {
      const data = err.response?.data;
      
      // OTP required for login (code sent to email)
      if (err.response?.status === 403 && data?.requires_verification) {
        setRequiresVerification(true);
        setError(data?.message || "Un code de vérification a été envoyé à votre email.");
        setLoading(false);
        return;
      }
      
      const msg = data?.message
        || (data?.errors ? Object.values(data.errors).flat().join(" ") : null)
        || (err.message === "Network Error" ? "Cannot reach server. Is Laravel running? Try: php artisan serve" : "Login failed");
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        {/* LEFT SIDE */}
        <section className="auth-left">
          <div className="auth-logo">
            <span className="auth-logo-pill">University</span>
          </div>

          <h1 className="auth-title">{t("welcomeUniversity")}</h1>
          <p className="auth-subtitle">{t("loginAcademic")}</p>

          <form className="auth-form" onSubmit={requiresVerification ? handleVerifyOtp : handleSubmit}>
            {error && <p className="auth-error">{error}</p>}
            <label className="auth-label">{t("email")}</label>
            <input
              className="auth-input"
              type="email"
              placeholder="you@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={requiresVerification}
            />

            <label className="auth-label">{t("password")}</label>
            <input
              className="auth-input"
              type="password"
              placeholder="********"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={requiresVerification}
            />

            {requiresVerification && (
              <div className="auth-verification-notice">
                <p>📧 Un code de vérification a été envoyé à votre email.</p>
                <label className="auth-label" style={{ marginTop: 10 }}>Code</label>
                <input
                  className="auth-input"
                  type="text"
                  placeholder="123456"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  maxLength={6}
                  required
                />
                <button 
                  type="button" 
                  className="auth-btn-link" 
                  onClick={handleResendOtp}
                  disabled={resending}
                >
                  {resending ? "Envoi en cours..." : "Renvoyer le code de vérification"}
                </button>
              </div>
            )}

            <button type="submit" className="auth-btn" disabled={loading || verifying || (requiresVerification && otpCode.length < 6)}>
              {requiresVerification ? (verifying ? "Vérification..." : "Vérifier & se connecter") : (loading ? "Connexion..." : t("connect"))}
            </button>

            {!requiresVerification && (
              <div style={{ marginTop: 10, display: "flex", justifyContent: "space-between", gap: 10 }}>
                <Link to="/forgot-password" className="auth-btn-link">{t("forgotPassword")}</Link>
                <Link to="/register" className="auth-btn-link">{t("createAccount")}</Link>
              </div>
            )}

            <div className="auth-or">
              <span />
              <p>or</p>
              <span />
            </div>

            <div className="auth-social">
              <button type="button" className="auth-social-btn">
                <span className="auth-icon"></span>
                Apple
              </button>
              <button type="button" className="auth-social-btn">
                <span className="auth-icon">G</span>
                Google
              </button>
            </div>
          </form>

          <div className="auth-footer">
            <p>
              Don’t have an account? <Link to="/register">Sign up</Link>
            </p>
          </div>
        </section>

        {/* RIGHT SIDE */}
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