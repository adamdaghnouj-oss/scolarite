import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/axios";
import { useLanguage } from "../i18n/LanguageContext";
import StaffSidebar from "../components/StaffSidebar";
import "./AdminPanel.css";

export default function ProfessorInternshipSoutenancePage() {
  const { language } = useLanguage();
  const tr = (en, fr) => (language === "fr" ? fr : en);

  const [encRows, setEncRows] = useState([]);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [encRes, souRes] = await Promise.all([
        api.get("/professeur/internships/encadrement"),
        api.get("/professeur/internships/soutenance-pending"),
      ]);
      setEncRows(Array.isArray(encRes.data) ? encRes.data : []);
      setRows(Array.isArray(souRes.data) ? souRes.data : []);
    } catch (e) {
      setError(e?.response?.data?.message || tr("Could not load list.", "Impossible de charger la liste."));
      setEncRows([]);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [language]);

  useEffect(() => {
    load();
  }, [load]);

  async function publish(id) {
    setBusyId(id);
    setError("");
    try {
      await api.post(`/professeur/internships/${id}/soutenance-publish`);
      await load();
    } catch (e) {
      setError(e?.response?.data?.message || tr("Publish failed.", "Publication échouée."));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="admin-wrap">
      <StaffSidebar variant="professeur" />

      <main className="admin-main">
        <header className="admin-topbar">
          <div>
            <h1 className="admin-title">{tr("PFE — supervision & defenses", "PFE — encadrement et soutenances")}</h1>
            <p className="admin-subtitle">
              {tr(
                "Supervision periods assigned by the director, and defenses you can publish when you are on the jury.",
                "Périodes d’encadrement fixées par le directeur, et soutenances que vous pouvez publier si vous êtes dans le jury.",
              )}
            </p>
          </div>
          <button type="button" className="admin-primary-btn" onClick={load}>{tr("Refresh", "Rafraîchir")}</button>
        </header>

        {error ? <p className="auth-error">{error}</p> : null}
        {loading ? <p className="admin-subtitle">{tr("Loading…", "Chargement…")}</p> : null}

        <section className="admin-card admin-card--padded" style={{ marginBottom: 16 }}>
          <h2 className="admin-title" style={{ fontSize: "1.1rem", marginBottom: 8 }}>{tr("My PFE supervision", "Mon encadrement PFE")}</h2>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>{tr("Student", "Étudiant")}</th>
                  <th>{tr("Class", "Classe")}</th>
                  <th>{tr("Project", "Projet")}</th>
                  <th>{tr("Company", "Société")}</th>
                  <th>{tr("Supervision start", "Début encadrement")}</th>
                  <th>{tr("Supervision end", "Fin encadrement")}</th>
                  <th>{tr("Defense date", "Date soutenance")}</th>
                  <th>{tr("Jury", "Jury")}</th>
                </tr>
              </thead>
              <tbody>
                {encRows.map((r) => (
                  <tr key={`enc-${r.id}`}>
                    <td>#{r.id}</td>
                    <td>{r.student_name}</td>
                    <td>{r.class_name || "—"}</td>
                    <td>{r.project_name || "—"}</td>
                    <td>{r.company_name}</td>
                    <td>{r.encadrement_start_date || "—"}</td>
                    <td>{r.encadrement_end_date || "—"}</td>
                    <td>{r.soutenance_date || "—"}</td>
                    <td style={{ fontSize: 12 }}>
                      {(r.soutenance_jury || []).map((j) => j.name).filter(Boolean).join(", ") || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!loading && encRows.length === 0 ? (
            <p className="admin-subtitle" style={{ padding: 16 }}>
              {tr("No PFE projects assigned to you as encadrant.", "Aucun projet PFE où vous êtes encadrant.")}
            </p>
          ) : null}
        </section>

        <section className="admin-card admin-card--padded">
          <h2 className="admin-title" style={{ fontSize: "1.1rem", marginBottom: 8 }}>{tr("Publish defense for students", "Publier la soutenance (étudiants)")}</h2>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>{tr("Student", "Étudiant")}</th>
                  <th>{tr("Class", "Classe")}</th>
                  <th>{tr("Type", "Type")}</th>
                  <th>{tr("Date", "Date")}</th>
                  <th>{tr("Jury", "Jury")}</th>
                  <th>{tr("Action", "Action")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>#{r.id}</td>
                    <td>{r.student_name}</td>
                    <td>{r.class_name || "—"}</td>
                    <td>{r.internship_type}</td>
                    <td>{r.soutenance_date || "—"}</td>
                    <td style={{ fontSize: 12 }}>
                      {(r.soutenance_jury || []).map((j) => j.name).filter(Boolean).join(", ") || "—"}
                    </td>
                    <td>
                      <button
                        type="button"
                        className="admin-primary-btn"
                        disabled={busyId === r.id}
                        onClick={() => publish(r.id)}
                      >
                        {busyId === r.id ? tr("Publishing…", "Publication…") : tr("Publish for students", "Publier pour les étudiants")}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!loading && rows.length === 0 ? (
            <p className="admin-subtitle" style={{ padding: 16 }}>
              {tr("Nothing pending.", "Rien en attente.")}
            </p>
          ) : null}
        </section>

        <p className="admin-subtitle" style={{ marginTop: 16 }}>
          <Link to="/professeur">{tr("← Teaching home", "← Enseignement")}</Link>
        </p>
      </main>
    </div>
  );
}
