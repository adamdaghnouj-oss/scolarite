import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/axios";
import { clearAuth } from "../auth/auth";
import { useLanguage } from "../i18n/LanguageContext";
import "./AdminPanel.css";

function isImageMime(m) {
  return typeof m === "string" && m.startsWith("image/");
}

function formatDateOnly(iso) {
  if (!iso) return "";
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(iso));
  } catch {
    return "";
  }
}

export default function ProfessorDocumentsExamSurveillancePage() {
  const navigate = useNavigate();
  const { language, t } = useLanguage();
  const tr = (en, fr) => (language === "fr" ? fr : en);

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadAll() {
    setLoading(true);
    setError("");
    try {
      const res = await api.get("/professeur/documents/exam_surveillance");
      setRows(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      setRows([]);
      setError(err?.response?.data?.message || tr("Could not load document.", "Impossible de charger le document."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  async function handleLogout() {
    try {
      await api.post("/logout");
    } catch {
      // ignore
    } finally {
      clearAuth();
      navigate("/login");
    }
  }

  return (
    <div className="admin-wrap">
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <div className="admin-brand-mark" aria-hidden="true">P</div>
          <div className="admin-brand-text">
            <div className="admin-brand-title">Scolarité</div>
            <div className="admin-brand-subtitle">{tr("Professor", "Professeur")}</div>
          </div>
        </div>

        <nav className="admin-nav">
          <p className="admin-nav-section-label">{tr("Menu", "Menu")}</p>
          <Link className="admin-nav-item" to="/">{tr("Home", "Accueil")}</Link>
          <p className="admin-nav-section-label">{tr("Teaching", "Enseignement")}</p>
          <Link className="admin-nav-item" to="/professeur">{tr("My classes", "Mes classes")}</Link>
          <Link className="admin-nav-item" to="/professeur/notes">{tr("Grades", "Notes")}</Link>
          <Link className="admin-nav-item" to="/professeur/absences">{tr("Absences", "Absences")}</Link>
          <Link className="admin-nav-item" to="/professeur/attendance-certificates">{t("menuAttendanceCert")}</Link>
          <Link className="admin-nav-item" to="/professeur/timetable">
            {tr("Timetable", "Emploi du temps")}
          </Link>
          <Link className="admin-nav-item admin-nav-item--active" to="/professeur/exam-surveillance">
            {tr("Exam surveillance", "Surveillance examens")}
          </Link>
          <p className="admin-nav-section-label">{tr("Campus", "Campus")}</p>
          <Link className="admin-nav-item" to="/student/posts">{tr("Posts", "Publications")}</Link>
          <Link className="admin-nav-item" to="/student/friends">{tr("Friends", "Reseau")}</Link>
          <Link className="admin-nav-item" to="/messages/panier">{t("menuPanierMessages")}</Link>
          <p className="admin-nav-section-label">{tr("Account", "Compte")}</p>
          <Link className="admin-nav-item" to="/profile">{tr("Profile", "Profil")}</Link>
          <Link className="admin-nav-item" to="/change-password">{tr("Change password", "Changer le mot de passe")}</Link>
        </nav>

        <div className="admin-sidebar-footer">
          <button type="button" className="admin-secondary-btn" style={{ width: "100%" }} onClick={handleLogout}>
            {tr("Logout", "Déconnexion")}
          </button>
        </div>
      </aside>

      <main className="admin-main admin-main--professor">
        <header className="admin-topbar">
          <div>
            <h1 className="admin-title">{tr("Exam surveillance", "Surveillance des examens")}</h1>
            <p className="admin-subtitle">{tr("Visible only during the active dates.", "Visible uniquement pendant la période active.")}</p>
          </div>
          <button type="button" className="admin-primary-btn" onClick={loadAll}>
            {tr("Refresh", "Actualiser")}
          </button>
        </header>

        {loading && <p className="admin-subtitle">{tr("Loading…", "Chargement…")}</p>}
        {error && <p className="auth-error">{error}</p>}

        {!loading && !error && rows.length === 0 && (
          <p className="admin-subtitle">{tr("No document published yet.", "Aucun document publié pour le moment.")}</p>
        )}

        {!loading && !error && rows.map((doc) => (
          <section key={doc.id} className="admin-card admin-card--padded" style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontWeight: 900 }}>{doc.title || tr("Exam surveillance", "Surveillance examens")}</div>
                <div style={{ fontSize: 12, color: "#64748b", marginTop: 6 }}>
                  {doc.starts_at || doc.ends_at ? (
                    <>
                      {doc.starts_at ? formatDateOnly(doc.starts_at) : "—"} → {doc.ends_at ? formatDateOnly(doc.ends_at) : "—"}
                    </>
                  ) : null}
                </div>
              </div>
              <a className="admin-secondary-btn" href={doc.file_url} target="_blank" rel="noreferrer">
                {tr("Open", "Ouvrir")}
              </a>
            </div>

            <div style={{ marginTop: 12 }}>
              {isImageMime(doc.file_mime) ? (
                <a href={doc.file_url} target="_blank" rel="noreferrer">
                  <img
                    src={doc.file_url}
                    alt={doc.title || "exam surveillance"}
                    style={{ width: "100%", borderRadius: 12, border: "1px solid rgba(15, 23, 42, 0.08)" }}
                  />
                </a>
              ) : null}
            </div>
          </section>
        ))}
      </main>
    </div>
  );
}

