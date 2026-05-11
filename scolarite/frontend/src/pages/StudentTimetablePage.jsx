import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/axios";
import { useAuth } from "../auth/useAuth";
import { useLanguage } from "../i18n/LanguageContext";
import "./StudentPlansPage.css";
import "./StudentAbsencesPage.css";

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

export default function StudentTimetablePage() {
  const navigate = useNavigate();
  const auth = useAuth();
  const { t, language } = useLanguage();
  const tr = useCallback((en, fr, ar) => (language === "fr" ? fr : language === "ar" ? ar : en), [language]);

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.get("/student/class-documents/timetable");
      setRows(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      setRows([]);
      setError(err?.response?.data?.message || tr("Could not load timetable.", "Impossible de charger l'emploi du temps.", "تعذر تحميل جدول التوقيت."));
    } finally {
      setLoading(false);
    }
  }, [tr]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  async function handleLogout() {
    await auth.logout();
    navigate("/login");
  }

  const grouped = useMemo(() => {
    const map = new Map();
    for (const r of rows) {
      const key = `${r.annee_scolaire || ""}|${r.semestre_label || ""}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(r);
    }
    return [...map.entries()].map(([key, items]) => ({ key, items }));
  }, [rows]);

  return (
    <div className="spn-wrap">
      <header className="spn-topnav">
        <div className="spn-topnav-inner">
          <Link to="/" className="spn-brand">
            <span className="spn-brand-mark" aria-hidden="true">S</span>
            <span>Scolarité</span>
          </Link>
          <nav className="spn-links">
            <Link to="/">{t("navHome")}</Link>
            <Link to="/student/plans">{t("navPrograms")}</Link>
            <Link className="is-active" to="/student/timetable">{t("menuSchedule")}</Link>
            <Link to="/student/exam-calendar">{t("menuExamCalendar")}</Link>
          </nav>
          <div className="spn-actions">
            <Link className="spn-btn spn-btn-ghost" to="/profile">{t("profile")}</Link>
            <button type="button" className="spn-btn spn-btn-primary" onClick={handleLogout}>{t("logout")}</button>
          </div>
        </div>
      </header>

      <div className="spn-header">
        <div>
          <h1>{t("menuSchedule")}</h1>
          <p>{tr("Your timetable is shown only during the active semester dates.", "Votre emploi du temps s'affiche uniquement pendant la période du semestre.", "يظهر جدول التوقيت فقط خلال فترة السداسي.")}</p>
        </div>
        <Link to="/" className="spn-back">← {t("navHome")}</Link>
      </div>

      {loading && <p className="spn-empty">{tr("Loading…", "Chargement…", "جارٍ التحميل…")}</p>}
      {error && <p className="spn-error">{error}</p>}

      {!loading && !error && rows.length === 0 && (
        <p className="spn-empty">{t("ttNoDoc")}</p>
      )}

      {!loading && !error && grouped.map((g) => (
        <section key={g.key} className="spn-details spn-card" style={{ marginTop: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div>
              <h2 style={{ margin: 0 }}>
                {(g.items[0]?.semestre_label ? `${g.items[0].semestre_label}` : tr("Semester", "Semestre", "سداسي"))}
              </h2>
              <p className="spn-meta">
                {g.items[0]?.annee_scolaire ? `${g.items[0].annee_scolaire}` : ""}
                {g.items[0]?.starts_at || g.items[0]?.ends_at ? (
                  <>
                    {" · "}
                    {g.items[0]?.starts_at ? formatDateOnly(g.items[0].starts_at) : "—"} → {g.items[0]?.ends_at ? formatDateOnly(g.items[0].ends_at) : "—"}
                  </>
                ) : null}
              </p>
            </div>
          </div>

          {g.items.map((doc) => (
            <div key={doc.id} style={{ marginTop: 12 }}>
              {isImageMime(doc.file_mime) ? (
                <a href={doc.file_url} target="_blank" rel="noreferrer">
                  <img
                    src={doc.file_url}
                    alt={doc.title || "timetable"}
                    style={{ width: "100%", borderRadius: 12, border: "1px solid rgba(15, 23, 42, 0.08)" }}
                  />
                </a>
              ) : (
                <a className="spn-back" href={doc.file_url} target="_blank" rel="noreferrer">
                  {doc.title || tr("Open PDF", "Ouvrir le PDF", "فتح PDF")}
                </a>
              )}
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}

