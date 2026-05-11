import { useEffect, useState } from "react";
import { api } from "../api/axios";
import { useLanguage } from "../i18n/LanguageContext";
import "./AdminPanel.css";
import StaffSidebar from "../components/StaffSidebar";

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

export default function ProfessorDocumentsTimetablePage() {
  const { language } = useLanguage();
  const tr = (en, fr) => (language === "fr" ? fr : en);

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadAll() {
    setLoading(true);
    setError("");
    try {
      const res = await api.get("/professeur/documents/timetable");
      setRows(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      setRows([]);
      setError(err?.response?.data?.message || tr("Could not load timetable.", "Impossible de charger l'emploi du temps."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  return (
    <div className="admin-wrap">
      <StaffSidebar variant="professeur" />

      <main className="admin-main admin-main--professor">
        <header className="admin-topbar">
          <div>
            <h1 className="admin-title">{tr("Timetable (professors)", "Emploi du temps (professeurs)")}</h1>
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
                <div style={{ fontWeight: 900 }}>{doc.title || tr("Timetable", "Emploi du temps")}</div>
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
                    alt={doc.title || "timetable"}
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
