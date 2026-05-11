import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/axios";
import { useAuth } from "../auth/useAuth";
import { useLanguage } from "../i18n/LanguageContext";
import "./StudentPlansPage.css";
import "./StudentAbsencesPage.css";
import "./StudentAttendanceCertificatesPage.css";

function formatDate(iso) {
  if (!iso) return "";
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
  } catch {
    return "";
  }
}

function StatusPill({ status, t }) {
  const label = status === "accepted" ? t("acAccepted") : status === "rejected" ? t("acRejected") : t("acPending");
  const style = status === "accepted"
    ? { background: "#dcfce7", color: "#166534" }
    : status === "rejected"
      ? { background: "#fee2e2", color: "#991b1b" }
      : { background: "#fef9c3", color: "#854d0e" };
  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      padding: "2px 10px",
      borderRadius: 999,
      fontSize: 12,
      fontWeight: 800,
      ...style,
    }}
    >
      {label}
    </span>
  );
}

export default function StudentAttendanceCertificatesPage() {
  const navigate = useNavigate();
  const auth = useAuth();
  const { t, language } = useLanguage();
  const tr = useCallback((en, fr, ar) => (language === "fr" ? fr : language === "ar" ? ar : en), [language]);

  const [rows, setRows] = useState([]);
  const [profs, setProfs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [openModal, setOpenModal] = useState(false);
  const [saving, setSaving] = useState(false);

  const [prof1, setProf1] = useState("");
  const [prof2, setProf2] = useState("");
  const [copies, setCopies] = useState(1);
  const [reqLang, setReqLang] = useState(language === "ar" ? "ar" : language === "en" ? "en" : "fr");

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [reqRes, profRes] = await Promise.all([
        api.get("/student/attendance-certificates"),
        api.get("/professeurs"),
      ]);
      setRows(Array.isArray(reqRes.data) ? reqRes.data : []);
      setProfs(Array.isArray(profRes.data) ? profRes.data : []);
    } catch (err) {
      setRows([]);
      setError(err?.response?.data?.message || tr("Failed to load requests.", "Echec du chargement des demandes.", "فشل تحميل الطلبات."));
    } finally {
      setLoading(false);
    }
  }, [tr]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const profOptions = useMemo(() => profs.map((p) => ({ id: String(p.id), name: p.name || `#${p.id}` })), [profs]);

  async function handleLogout() {
    await auth.logout();
    navigate("/login");
  }

  async function submitRequest(e) {
    e.preventDefault();
    if (!prof1 || !prof2 || prof1 === prof2) {
      setError(tr("Please select 2 different professors.", "Veuillez choisir 2 enseignants differents.", "يرجى اختيار أستاذين مختلفين."));
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await api.post("/student/attendance-certificates", {
        professeur1_id: Number(prof1),
        professeur2_id: Number(prof2),
        copies: Number(copies || 1),
        language: reqLang,
      });
      setRows((prev) => [res.data, ...prev]);
      setOpenModal(false);
      setProf1("");
      setProf2("");
      setCopies(1);
      setReqLang(language === "ar" ? "ar" : language === "en" ? "en" : "fr");
    } catch (err) {
      setError(err?.response?.data?.message || tr("Failed to submit request.", "Echec de l'envoi de la demande.", "فشل إرسال الطلب."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="spn-wrap sac-wrap">
      <header className="spn-topnav">
        <div className="spn-topnav-inner">
          <Link to="/" className="spn-brand">
            <span className="spn-brand-mark" aria-hidden="true">S</span>
            <span>Scolarité</span>
          </Link>
          <nav className="spn-links">
            <Link to="/">{t("navHome")}</Link>
            <Link to="/student/plans">{t("navPrograms")}</Link>
            <Link className="is-active" to="/student/attendance-certificates">{t("menuAttendanceCert")}</Link>
            <Link to="/student/absences">{tr("Absences", "Absences", "الغيابات")}</Link>
          </nav>
          <div className="spn-actions">
            <Link className="spn-btn spn-btn-ghost" to="/profile">{t("profile")}</Link>
            <button type="button" className="spn-btn spn-btn-primary" onClick={handleLogout}>{t("logout")}</button>
          </div>
        </div>
      </header>

      <div className="spn-header">
        <div>
          <h1>{t("acTitleStudent")}</h1>
        </div>
        <div className="sac-header-actions">
          <button type="button" className="spn-btn spn-btn-primary" onClick={() => setOpenModal(true)}>
            {t("acAddRequest")}
          </button>
        </div>
      </div>

      {loading && <p className="spn-empty">{tr("Loading…", "Chargement…", "جارٍ التحميل…")}</p>}
      {error && <p className="spn-error">{error}</p>}

      {!loading && !error && (
        <div className="spn-list spn-card" style={{ marginTop: 12 }}>
          <div className="spn-table-wrap">
            <table className="spn-table">
              <thead>
                <tr>
                  <th>{t("acProfessor1")}</th>
                  <th>{t("acProfessor2")}</th>
                  <th>{t("acLanguage")}</th>
                  <th>{t("acCopies")}</th>
                  <th>{t("acStatus")}</th>
                  <th>{t("acCreatedAt")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr><td colSpan={6} className="spn-empty">{tr("No requests yet.", "Aucune demande pour le moment.", "لا توجد طلبات بعد.")}</td></tr>
                ) : rows.map((r) => (
                  <tr key={r.id}>
                    <td className="spn-cell-title">{r.professeur1_name || `#${r.professeur1_id}`}</td>
                    <td className="spn-cell-title">{r.professeur2_name || `#${r.professeur2_id}`}</td>
                    <td style={{ fontWeight: 800, textTransform: "uppercase" }}>{String(r.language || "fr")}</td>
                    <td>{Number(r.copies || 1)}</td>
                    <td><StatusPill status={r.status} t={t} /></td>
                    <td style={{ color: "#64748b", fontSize: 13 }}>{formatDate(r.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {openModal ? (
        <div className="sac-modal-overlay" onClick={() => setOpenModal(false)}>
          <div className="sac-modal" onClick={(e) => e.stopPropagation()}>
            <div className="sac-modal-header">
              <div className="sac-modal-title">{t("acAddRequest")}</div>
              <button type="button" className="sac-modal-close" onClick={() => setOpenModal(false)}>✕</button>
            </div>

            <form className="sac-form" onSubmit={submitRequest}>
              <label className="sac-label" htmlFor="prof1">{t("acProfessor1")}</label>
              <select id="prof1" className="sac-input" value={prof1} onChange={(e) => setProf1(e.target.value)}>
                <option value="">{tr("Select...", "Selectionner...", "اختر...")}</option>
                {profOptions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>

              <label className="sac-label" htmlFor="prof2">{t("acProfessor2")}</label>
              <select id="prof2" className="sac-input" value={prof2} onChange={(e) => setProf2(e.target.value)}>
                <option value="">{tr("Select...", "Selectionner...", "اختر...")}</option>
                {profOptions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>

              <div className="sac-grid">
                <div>
                  <label className="sac-label" htmlFor="lang">{t("acLanguage")}</label>
                  <select id="lang" className="sac-input" value={reqLang} onChange={(e) => setReqLang(e.target.value)}>
                    <option value="fr">FR</option>
                    <option value="en">EN</option>
                    <option value="ar">AR</option>
                  </select>
                </div>
                <div>
                  <label className="sac-label" htmlFor="copies">{t("acCopies")}</label>
                  <input
                    id="copies"
                    className="sac-input"
                    type="number"
                    min={1}
                    max={20}
                    value={copies}
                    onChange={(e) => setCopies(e.target.value)}
                  />
                </div>
              </div>

              <div className="sac-actions">
                <button type="button" className="spn-btn spn-btn-ghost" onClick={() => setOpenModal(false)}>
                  {tr("Cancel", "Annuler", "إلغاء")}
                </button>
                <button type="submit" className="spn-btn spn-btn-primary" disabled={saving}>
                  {saving ? t("sending") : tr("Submit", "Soumettre", "إرسال")}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}

