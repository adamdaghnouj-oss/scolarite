import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/axios";
import { useAuth } from "../auth/useAuth";
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

const STEPS = [
  { id: 1, label: "Compte" },
  { id: 2, label: "Profil" },
  { id: 3, label: "Confirmation" },
];

const ROLES = [
  { id: "student", label: "Étudiant", icon: "📚" },
  { id: "professeur", label: "Professeur", icon: "🎓" },
  { id: "directeur_etudes", label: "Directeur des Etudes", icon: "🧑‍💼" },
  { id: "directeur_stage", label: "Directeur des Stage", icon: "🏢" },
  { id: "administrateur", label: "Administrateur", icon: "🛡️" },
];

export default function Register() {
  const navigate = useNavigate();
  const liveTime = useLiveTime();
  const { t } = useLanguage();
  const auth = useAuth();

  useEffect(() => {
    if (auth.loading || !auth.isAuthed) return;
    const role = auth.role;
    if (role === "administrateur") navigate("/admin", { replace: true });
    else if (role === "directeur_etudes") navigate("/directeur/classes", { replace: true });
    else if (role === "directeur_stage") navigate("/directeur-stage/internships", { replace: true });
    else if (role === "professeur") navigate("/professeur", { replace: true });
  }, [auth.loading, auth.isAuthed, auth.role, navigate]);

  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [role, setRole] = useState("");
  const [matricule, setMatricule] = useState("");
  const [departement, setDepartement] = useState("");
  const [departementOptions, setDepartementOptions] = useState([]);
  const [departementsLoading, setDepartementsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  
  // OTP verification states
  const [otpCode, setOtpCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    if (role !== "professeur") {
      setDepartementOptions([]);
      setDepartement("");
      return;
    }
    let cancelled = false;
    setDepartementsLoading(true);
    (async () => {
      try {
        const res = await api.get("/departements");
        const list = Array.isArray(res.data) ? res.data : [];
        if (!cancelled) setDepartementOptions(list);
      } catch {
        if (!cancelled) setDepartementOptions([]);
      } finally {
        if (!cancelled) setDepartementsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [role]);

  function validateStep1() {
    if (!name.trim()) {
      setError("Nom complet requis.");
      return false;
    }
    if (!email.trim()) {
      setError("Adresse e-mail requise.");
      return false;
    }
    if (password.length < 8) {
      setError("Le mot de passe doit contenir au moins 8 caractères.");
      return false;
    }
    if (password !== passwordConfirmation) {
      setError("Les mots de passe ne correspondent pas.");
      return false;
    }
    setError("");
    return true;
  }

  function validateStep2() {
    if (!role) {
      setError("Veuillez sélectionner un rôle.");
      return false;
    }
    if (role === "student") {
      if (!matricule.trim()) {
        setError("Matricule requis pour les étudiants.");
        return false;
      }
    }
    setError("");
    return true;
  }

  function handleNext() {
    setError("");
    if (step === 1 && !validateStep1()) return;
    if (step === 2 && !validateStep2()) return;
    if (step < 3) setStep(step + 1);
  }

  function handleBack() {
    setError("");
    if (step > 1) setStep(step - 1);
  }

  function handleModify() {
    setStep(1);
    setError("");
  }

  async function handleResendOtp() {
    setResending(true);
    setError("");
    try {
      await api.post("/resend-otp", { email });
      setSuccess("Code de vérification renvoyé !");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      const data = err.response?.data;
      const msg = data?.message || "Échec de l'envoi du code. Réessayez.";
      setError(msg);
    } finally {
      setResending(false);
    }
  }

  async function handleVerifyOtp(e) {
    e.preventDefault();
    setVerifying(true);
    setError("");
    setSuccess("");
    try {
      const res = await auth.verifyOtp({ email, code: otpCode });
      setSuccess("Email vérifié avec succès !");
      const userRole = res.user?.role;
      setTimeout(() => {
        if (userRole === "administrateur" || userRole === "directeur_etudes" || userRole === "directeur_stage") {
          navigate(
            userRole === "directeur_etudes"
              ? "/directeur/classes"
              : userRole === "directeur_stage"
                ? "/directeur-stage/internships"
                : "/admin"
          );
        } else if (userRole === "professeur") {
          navigate("/professeur");
        } else if (userRole === "student") {
          navigate("/profile");
        } else {
          navigate("/");
        }
      }, 1500);
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
    setSuccess("");
    setLoading(true);
    try {
      const payload = {
        name,
        email,
        password,
        password_confirmation: passwordConfirmation,
        role,
      };
      if (role === "student") {
        payload.matricule = matricule;
      } else if (role === "professeur") {
        payload.matricule = matricule || null;
        payload.departement = departement || null;
      } else if (role === "directeur_etudes") {
        payload.matricule = matricule || null;
        payload.departement = departement || null;
      } else if (role === "directeur_stage") {
        payload.matricule = matricule || null;
        payload.departement = departement || null;
      } else if (role === "administrateur") {
        payload.departement = departement || null;
      }
      // Make API call - response doesn't contain token since user needs to verify email first
      await api.post("/register", payload);
      
      // After registration, show OTP verification step
      setOtpSent(true);
      setStep(3);
      setSuccess("Compte créé ! Veuillez vérifier votre email pour le code de confirmation.");
      setLoading(false);
    } catch (err) {
      const data = err.response?.data;
      const msg = data?.message
        || (data?.errors ? Object.values(data.errors).flat().join(" ") : null)
        || (err.message === "Network Error" ? "Impossible de joindre le serveur." : "Échec de l'inscription. Réessayez.");
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  const roleLabel = ROLES.find((r) => r.id === role)?.label || role;

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <section className="auth-left">
          <div className="auth-logo auth-logo--university">
            <span className="auth-logo-icon">🎓</span>
            <span className="auth-logo-pill">University</span>
          </div>

          <h1 className="auth-title">{t("welcomeUniversity")}</h1>
          <p className="auth-subtitle">{t("createUniversityAccount")}</p>

          {/* Step indicator */}
          <div className="auth-steps">
            {STEPS.map((s) => (
              <div
                key={s.id}
                className={`auth-step ${step === s.id ? "auth-step--active" : ""} ${step > s.id ? "auth-step--done" : ""}`}
              >
                <span className="auth-step-num">
                  {step > s.id ? "✓" : s.id}
                </span>
                <span className="auth-step-label">{s.label}</span>
              </div>
            ))}
          </div>

          <form className="auth-form" onSubmit={step === 3 ? handleSubmit : (e) => { e.preventDefault(); handleNext(); }}>
            {error && <p className="auth-error">{error}</p>}
            {success && <p className="auth-success">{success}</p>}

            {/* Step 1: Compte */}
            {step === 1 && (
              <>
                <label className="auth-label">Nom complet</label>
                <div className="auth-input-wrap">
                  <span className="auth-input-icon">👤</span>
                  <input
                    className="auth-input"
                    type="text"
                    placeholder="Votre nom"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>

                <label className="auth-label">Adresse e-mail</label>
                <div className="auth-input-wrap">
                  <span className="auth-input-icon">✉</span>
                  <input
                    className="auth-input"
                    type="email"
                    placeholder="vous@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>

                <label className="auth-label">Mot de passe</label>
                <div className="auth-input-wrap auth-password">
                  <span className="auth-input-icon">🔒</span>
                  <input
                    className="auth-input auth-input--password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    className="auth-eye"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label="Toggle password visibility"
                  >
                    👁
                  </button>
                </div>

                <label className="auth-label">Confirmer mot de passe</label>
                <div className="auth-input-wrap">
                  <span className="auth-input-icon">🔒</span>
                  <input
                    className="auth-input"
                    type="password"
                    placeholder="••••••••••"
                    value={passwordConfirmation}
                    onChange={(e) => setPasswordConfirmation(e.target.value)}
                  />
                </div>
              </>
            )}

            {/* Step 2: Profil */}
            {step === 2 && (
              <>
                <label className="auth-label">Rôle</label>
                <div className="auth-role-cards">
                  {ROLES.filter((r) => r.id === "student").map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      className={`auth-role-card ${role === r.id ? "auth-role-card--selected" : ""}`}
                      onClick={() => setRole(r.id)}
                    >
                      <span className="auth-role-icon">{r.icon}</span>
                      <span className="auth-role-label">{r.label}</span>
                    </button>
                  ))}
                </div>

                {role === "student" && (
                  <>
                    <label className="auth-label">Matricule</label>
                    <div className="auth-input-wrap">
                      <span className="auth-input-icon">🪪</span>
                      <input
                        className="auth-input"
                        type="text"
                        placeholder="2025-0001"
                        value={matricule}
                        onChange={(e) => setMatricule(e.target.value)}
                      />
                    </div>
                  </>
                )}

                {role === "professeur" && (
                  <>
                    <label className="auth-label">Matricule (optionnel)</label>
                    <div className="auth-input-wrap">
                      <span className="auth-input-icon">🪪</span>
                      <input
                        className="auth-input"
                        type="text"
                        placeholder="Matricule"
                        value={matricule}
                        onChange={(e) => setMatricule(e.target.value)}
                      />
                    </div>
                    <label className="auth-label">Département (optionnel)</label>
                    <div className="auth-input-wrap">
                      <span className="auth-input-icon">🏢</span>
                      <select
                        className="auth-input"
                        value={departement}
                        onChange={(e) => setDepartement(e.target.value)}
                        disabled={departementsLoading}
                      >
                        <option value="">— Choisir un département —</option>
                        {departementOptions.map((d) => (
                          <option key={d} value={d}>
                            {d}
                          </option>
                        ))}
                      </select>
                    </div>
                    {departementsLoading && (
                      <p className="auth-subtitle" style={{ marginTop: "6px" }}>
                        Chargement des départements…
                      </p>
                    )}
                    {!departementsLoading && departementOptions.length === 0 && (
                      <p className="auth-subtitle" style={{ marginTop: "6px" }}>
                        Aucun département n’est encore configuré (classes / années). Vous pouvez laisser vide ou demander à l’administration d’ajouter des départements.
                      </p>
                    )}
                  </>
                )}

                {role === "directeur_etudes" && (
                  <>
                    <label className="auth-label">Matricule (optionnel)</label>
                    <div className="auth-input-wrap">
                      <span className="auth-input-icon">🪪</span>
                      <input
                        className="auth-input"
                        type="text"
                        placeholder="Matricule"
                        value={matricule}
                        onChange={(e) => setMatricule(e.target.value)}
                      />
                    </div>
                    <label className="auth-label">Département (optionnel)</label>
                    <div className="auth-input-wrap">
                      <span className="auth-input-icon">🏢</span>
                      <input
                        className="auth-input"
                        type="text"
                        placeholder="Département"
                        value={departement}
                        onChange={(e) => setDepartement(e.target.value)}
                      />
                    </div>
                  </>
                )}

                {role === "directeur_stage" && (
                  <>
                    <label className="auth-label">Matricule (optionnel)</label>
                    <div className="auth-input-wrap">
                      <span className="auth-input-icon">🪪</span>
                      <input
                        className="auth-input"
                        type="text"
                        placeholder="Matricule"
                        value={matricule}
                        onChange={(e) => setMatricule(e.target.value)}
                      />
                    </div>
                    <label className="auth-label">Département (optionnel)</label>
                    <div className="auth-input-wrap">
                      <span className="auth-input-icon">🏢</span>
                      <input
                        className="auth-input"
                        type="text"
                        placeholder="Département"
                        value={departement}
                        onChange={(e) => setDepartement(e.target.value)}
                      />
                    </div>
                  </>
                )}

                {role === "administrateur" && (
                  <>
                    <label className="auth-label">Département (optionnel)</label>
                    <div className="auth-input-wrap">
                      <span className="auth-input-icon">🏢</span>
                      <input
                        className="auth-input"
                        type="text"
                        placeholder="Département"
                        value={departement}
                        onChange={(e) => setDepartement(e.target.value)}
                      />
                    </div>
                  </>
                )}
              </>
            )}

            {/* Step 3: Vérification OTP */}
            {step === 3 && (
              <div className="auth-otp-section">
                <div className="auth-otp-icon">📧</div>
                <h3 className="auth-otp-title">Vérification de votre email</h3>
                <p className="auth-otp-subtitle">
                  Nous avons envoyé un code à <strong>{email}</strong>
                </p>
                
                <form onSubmit={handleVerifyOtp}>
                  <label className="auth-label">Code de vérification</label>
                  <div className="auth-input-wrap">
                    <span className="auth-input-icon">🔢</span>
                    <input
                      className="auth-input auth-input--otp"
                      type="text"
                      placeholder="123456"
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      maxLength={6}
                      required
                    />
                  </div>
                  
                  {error && <p className="auth-error">{error}</p>}
                  {success && <p className="auth-success">{success}</p>}
                  
                  <button 
                    type="submit" 
                    className="auth-btn auth-btn--primary" 
                    disabled={verifying || otpCode.length < 6}
                  >
                    {verifying ? "Vérification..." : "Vérifier mon email"}
                  </button>
                  
                  <div className="auth-resend-section">
                    <p>Vous n'avez pas reçu le code ?</p>
                    <button 
                      type="button" 
                      className="auth-btn-link" 
                      onClick={handleResendOtp}
                      disabled={resending}
                    >
                      {resending ? "Envoi en cours..." : "Renvoyer le code"}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Step 4: Confirmation (legacy, shown after successful verification) */}
            {step === 4 && (
              <div className="auth-summary">
                <div className="auth-summary-row">
                  <span className="auth-summary-label">Nom</span>
                  <span className="auth-summary-value">{name}</span>
                </div>
                <div className="auth-summary-row">
                  <span className="auth-summary-label">Email</span>
                  <span className="auth-summary-value">{email}</span>
                </div>
                <div className="auth-summary-row">
                  <span className="auth-summary-label">Rôle</span>
                  <span className="auth-summary-value">
                    {roleLabel} {ROLES.find((r) => r.id === role)?.icon}
                  </span>
                </div>
              </div>
            )}

            {/* Buttons */}
            <div className="auth-form-actions">
              {step > 1 && step < 3 && (
                <button type="button" className="auth-btn auth-btn--secondary" onClick={handleBack}>
                  ← Retour
                </button>
              )}
              {step === 3 && otpSent && (
                <button type="button" className="auth-btn auth-btn--secondary" onClick={() => setStep(1)}>
                  ← Modifier
                </button>
              )}
              {step === 3 && !otpSent && (
                <button type="button" className="auth-btn auth-btn--secondary" onClick={handleModify}>
                  ← Modifier
                </button>
              )}
              {step === 4 && (
                <button type="button" className="auth-btn auth-btn--secondary" onClick={() => setStep(1)}>
                  ← Modifier
                </button>
              )}
              {step < 3 ? (
                <button type="button" className="auth-btn auth-btn--primary" onClick={handleNext}>
                  Suivant →
                </button>
              ) : step === 3 && !otpSent ? (
                <button className="auth-btn auth-btn--primary" type="submit" disabled={loading}>
                  {loading ? "Création..." : "✨ Créer mon compte"}
                </button>
              ) : null}
            </div>
          </form>

          <div className="auth-footer">
            <p>
              Déjà inscrit ? <Link to="/login">Se connecter</Link>
            </p>
          </div>
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
