import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/axios";
import { useAuth } from "../auth/useAuth";
import { useLanguage } from "../i18n/LanguageContext";
import "./StudentPlansPage.css";
import "./StudentGradesPage.css";

export default function StudentGradesPage() {
  const navigate = useNavigate();
  const auth = useAuth();
  const { language, t } = useLanguage();
  const tr = useCallback((en, fr) => (language === "fr" ? fr : en), [language]);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [dcRows, setDcRows] = useState([]);
  const [dcLoading, setDcLoading] = useState(false);
  const [dcErr, setDcErr] = useState("");
  const [dcModal, setDcModal] = useState(null); // { panierId, panierName } | null
  const [dcReason, setDcReason] = useState("");
  const [dcSaving, setDcSaving] = useState(false);
  const [dcSaveErr, setDcSaveErr] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      const res = await api.get("/student/my-grades");
      setData(res.data);
    } catch (e) {
      setErr(e.response?.data?.message || tr("Could not load grades.", "Impossible de charger les notes."));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [tr]);

  const loadDoubleCorrections = useCallback(async () => {
    setDcLoading(true);
    setDcErr("");
    try {
      const res = await api.get("/student/double-corrections");
      setDcRows(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      setDcRows([]);
      setDcErr(e.response?.data?.message || tr("Could not load requests.", "Impossible de charger les demandes."));
    } finally {
      setDcLoading(false);
    }
  }, [tr]);

  useEffect(() => {
    load();
    loadDoubleCorrections();
  }, [load, loadDoubleCorrections]);

  async function handleLogout() {
    await auth.logout();
    navigate("/login");
  }

  const published = data?.published === true;
  const dcByPanierId = useMemo(() => {
    const map = new Map();
    for (const r of dcRows) {
      if (r?.panier_id != null) map.set(String(r.panier_id), r);
    }
    return map;
  }, [dcRows]);

  function openDc(panierId, panierName) {
    setDcSaveErr("");
    setDcReason("");
    setDcModal({ panierId, panierName });
  }

  async function submitDc(e) {
    e.preventDefault();
    if (!dcModal?.panierId) return;
    setDcSaving(true);
    setDcSaveErr("");
    try {
      await api.post("/student/double-corrections", {
        panier_id: dcModal.panierId,
        reason: dcReason.trim() ? dcReason.trim() : null,
      });
      setDcModal(null);
      setDcReason("");
      await loadDoubleCorrections();
    } catch (er) {
      setDcSaveErr(er.response?.data?.message || tr("Request failed.", "Échec de la demande."));
    } finally {
      setDcSaving(false);
    }
  }

  return (
    <div className="spn-wrap sg-wrap">
      <header className="spn-topnav">
        <div className="spn-topnav-inner">
          <Link to="/" className="spn-brand">
            <span className="spn-brand-mark" aria-hidden="true">
              S
            </span>
            <span>Scolarité</span>
          </Link>
          <nav className="spn-links">
            <Link to="/">{tr("Home", "Accueil")}</Link>
            <Link to="/student/plans">{tr("Programs", "Programmes")}</Link>
            <Link className="is-active" to="/student/grades">
              {tr("Grades", "Notes")}
            </Link>
            <Link to="/student/absences">{tr("Absences", "Absences")}</Link>
          </nav>
          <div className="spn-actions">
            <Link className="spn-btn spn-btn-ghost" to="/profile">
              {tr("Profile", "Profil")}
            </Link>
            <button type="button" className="spn-btn spn-btn-primary" onClick={handleLogout}>
              {tr("Logout", "Se déconnecter")}
            </button>
          </div>
        </div>
      </header>

      <div className="spn-header">
        <div>
          <h1>{t("gradesTitle")}</h1>
          <p>
            {tr(
              "Grades appear here once the administrator publishes them. Averages follow the study plan weights (LMD /20).",
              "Les notes apparaissent ici lorsque l'administrateur les a publiées. Les moyennes suivent les coefficients du plan (LMD /20).",
            )}
          </p>
        </div>
        <Link to="/" className="spn-back">
          ← {tr("Home", "Accueil")}
        </Link>
      </div>

      {loading && <p className="spn-empty">{tr("Loading…", "Chargement…")}</p>}
      {err && <p className="spn-error">{err}</p>}

      {!loading && data && !published && (
        <section className="spn-details sg-card">
          <p className="sg-muted">
            {language === "fr"
              ? "Les notes ne sont pas encore publiées par l'administration."
              : data.message || "Grades are not published yet."}
          </p>
        </section>
      )}

      {!loading && published && (
        <>
          {data.lmd?.hint && (
            <section className="spn-details sg-card">
              <p className="sg-hint">
                {tr(
                  data.lmd.hint,
                  "Les évaluations (contrôle continu, examen final, TP…) sont pondérées selon le plan d'études. Exemple fréquent : moyenne matière = note_CC×0,3 + note_EF×0,7 lorsque ces pondérations sont saisies sur le plan.",
                )}
              </p>
            </section>
          )}

          <section className="spn-details sg-card">
            <div className="sg-summary">
              <div>
                <h2 className="sg-h2">{tr("Semester summary", "Synthèse semestre")}</h2>
                <p className="sg-sub">
                  {data.classe?.name ? (
                    <>
                      <strong>{data.classe.name}</strong>
                      {data.classe.annee_scolaire ? ` — ${data.classe.annee_scolaire}` : ""}
                    </>
                  ) : null}
                </p>
              </div>
              <div className="sg-kpi">
                <div className="sg-kpi-label">{tr("Semester average", "Moyenne semestrielle")}</div>
                <div className="sg-kpi-value">
                  {data.moyenne_semestrielle != null ? `${data.moyenne_semestrielle} /20` : "—"}
                </div>
                {data.published_at && (
                  <div className="sg-kpi-sub">
                    {tr("Published", "Publié")}: {new Date(data.published_at).toLocaleString()}
                  </div>
                )}
              </div>
            </div>
          </section>

          {(data.paniers ?? []).map((row) => {
            const showWeight = (row.slots ?? []).some((s) => s.weight != null);
            const dc = dcByPanierId.get(String(row.panier.id)) || null;
            return (
              <section key={row.panier.id} className="spn-details sg-card">
                <div className="sg-row-head">
                  <div>
                    <h2 className="sg-h2">{row.panier.name}</h2>
                    <p className="sg-sub">
                      {row.coefficient_ue != null ? (
                        <>
                          <strong>{tr("UE coeff.", "Coef. UE")}:</strong> {row.coefficient_ue}
                        </>
                      ) : null}
                    </p>
                  </div>
                  <div className="sg-pill">
                    <span className="sg-pill-label">{tr("Subject avg.", "Moy. matière")}</span>
                    <span className="sg-pill-value">
                      {row.moyenne_matiere != null ? `${row.moyenne_matiere} /20` : "—"}
                    </span>
                  </div>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
                  <div style={{ color: "#64748b", fontSize: 13 }}>
                    {dc ? (
                      <>
                        <strong>{tr("Double correction", "Double correction")}:</strong>{" "}
                        {dc.status === "pending"
                          ? tr("Pending", "En attente")
                          : dc.status === "accepted"
                            ? tr("Accepted", "Acceptée")
                            : tr("Rejected", "Refusée")}
                      </>
                    ) : (
                      <>
                        <strong>{tr("Double correction", "Double correction")}:</strong> {tr("Not requested", "Non demandée")}
                      </>
                    )}
                    {dc?.decision_note ? <span> — {dc.decision_note}</span> : null}
                  </div>
                  <button
                    type="button"
                    className="spn-btn spn-btn-ghost"
                    onClick={() => openDc(row.panier.id, row.panier.name)}
                    disabled={dc?.status === "pending"}
                    title={dc?.status === "pending" ? tr("Already requested", "Déjà demandée") : ""}
                  >
                    {tr("Request double correction", "Demander une double correction")}
                  </button>
                </div>

                <div className="sg-table-wrap">
                  <table className="sg-table">
                    <thead>
                      <tr>
                        <th>{tr("Evaluation", "Évaluation")}</th>
                        <th>{tr("Grade /20", "Note /20")}</th>
                        {showWeight ? <th>{tr("Weight", "Coef.")}</th> : null}
                      </tr>
                    </thead>
                    <tbody>
                      {(row.slots ?? []).map((slot) => (
                        <tr key={slot.key}>
                          <td className="sg-cell-title">{slot.label}</td>
                          <td>{row.grades?.[slot.key] != null ? row.grades[slot.key] : "—"}</td>
                          {showWeight ? <td>{slot.weight != null ? slot.weight : "—"}</td> : null}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {row.moyenne_detail && (
                  <p className="sg-foot">
                    {tr(
                      row.moyenne_detail,
                      row.moyenne_method === "weighted"
                        ? "Moyenne pondérée Σ(note × coefficient) / Σ(coefficients) sur les évaluations saisies (/20, style LMD)."
                        : "Moyenne arithmétique des notes saisies (aucun coefficient renseigné sur le plan pour ces évaluations).",
                    )}
                  </p>
                )}
              </section>
            );
          })}
        </>
      )}

      {dcModal && (
        <div className="admin-modal-overlay" onClick={() => setDcModal(null)}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560 }}>
            <div className="admin-modal-header">
              <h2 className="admin-modal-title">
                {tr("Double correction request", "Demande de double correction")}
              </h2>
              <button type="button" className="admin-modal-close" onClick={() => setDcModal(null)}>✕</button>
            </div>
            {dcSaveErr ? <p className="auth-error">{dcSaveErr}</p> : null}
            {dcErr ? <p className="auth-error">{dcErr}</p> : null}
            <p className="admin-subtitle" style={{ marginTop: 0 }}>
              {tr("Subject", "Matière")}: <strong>{dcModal.panierName}</strong>
            </p>
            <form className="admin-modal-form" onSubmit={submitDc}>
              <label className="admin-label">{tr("Reason (optional)", "Motif (optionnel)")}</label>
              <textarea
                className="admin-input"
                value={dcReason}
                onChange={(e) => setDcReason(e.target.value)}
                rows={4}
                placeholder={tr("Explain why you request a double correction…", "Expliquez pourquoi vous demandez une double correction…")}
              />
              <div className="admin-modal-actions">
                <button type="button" className="admin-secondary-btn" onClick={() => setDcModal(null)}>
                  {tr("Cancel", "Annuler")}
                </button>
                <button type="submit" className="admin-primary-btn" disabled={dcSaving || dcLoading}>
                  {dcSaving ? tr("Sending…", "Envoi…") : tr("Send request", "Envoyer la demande")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
