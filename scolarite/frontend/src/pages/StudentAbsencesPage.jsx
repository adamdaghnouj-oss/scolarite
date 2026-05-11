import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/axios";
import { useAuth } from "../auth/useAuth";
import { useLanguage } from "../i18n/LanguageContext";
import "./StudentPlansPage.css";
import "./StudentAbsencesPage.css";

export default function StudentAbsencesPage() {
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const auth = useAuth();
  const tr = useCallback((en, fr) => (language === "fr" ? fr : en), [language]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const res = await api.get("/student/absences-by-panier");
        if (!cancelled) setData(res.data);
      } catch (err) {
        if (!cancelled) {
          setData(null);
          setError(err.response?.data?.message || tr("Could not load absences.", "Impossible de charger les absences."));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tr]);

  async function handleLogout() {
    await auth.logout();
    navigate("/login");
  }

  const paniers = data?.paniers ?? [];
  const classe = data?.classe;

  return (
    <div className="spn-wrap">
      <header className="spn-topnav">
        <div className="spn-topnav-inner">
          <Link to="/" className="spn-brand">
            <span className="spn-brand-mark" aria-hidden="true">
              S
            </span>
            <span>Scolarité</span>
          </Link>
          <nav className="spn-links">
            <Link to="/">{t("navHome")}</Link>
            <Link to="/student/plans">{t("navPrograms")}</Link>
            <Link className="is-active" to="/student/absences">
              {t("menuAbsenceNotices")}
            </Link>
          </nav>
          <div className="spn-actions">
            <Link className="spn-btn spn-btn-ghost" to="/profile">
              {t("profile")}
            </Link>
            <button type="button" className="spn-btn spn-btn-primary" onClick={handleLogout}>
              {t("logout")}
            </button>
          </div>
        </div>
      </header>

      <div className="spn-header">
        <div>
          <h1>{t("absTitle")}</h1>
          <p>
            {classe
              ? `${t("absClassLabel")}: ${classe.name} (${classe.annee_scolaire})`
              : t("absClassFallback")}
          </p>
        </div>
        <Link to="/" className="spn-back">
          ← {t("navHome")}
        </Link>
      </div>

      {loading && <p className="spn-empty">{tr("Loading…", "Chargement…")}</p>}
      {error && <p className="spn-error">{error}</p>}

      {!loading && !error && paniers.length === 0 && (
        <p className="spn-empty">{tr("No subjects found for your class.", "Aucune matière trouvée pour votre classe.")}</p>
      )}

      {!loading && paniers.length > 0 && (
          <div className="spn-list spn-card" style={{ marginTop: "12px" }}>
            <div className="spn-table-wrap">
              <table className="spn-table">
                <thead>
                  <tr>
                    <th>{tr("Subject", "Matière")}</th>
                    <th>{tr("Absences", "Absences")}</th>
                    <th>{tr("Eliminated", "Éliminé")}</th>
                  </tr>
                </thead>
                <tbody>
                  {paniers.map((m) => (
                    <tr key={m.panier_id}>
                      <td className="spn-cell-title">{m.name}</td>
                      <td>{m.absence_count}</td>
                      <td>
                        <span className={`spn-pill ${m.eliminated ? "is-bad" : "is-ok"}`}>
                          {m.eliminated ? tr("Yes", "Oui") : tr("No", "Non")}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
    </div>
  );
}
