import { useEffect, useMemo, useState } from "react";
import { api } from "../api/axios";
import { useLanguage } from "../i18n/LanguageContext";
import "./AdminPanel.css";
import StaffSidebar from "../components/StaffSidebar";

function formatDate(iso) {
  if (!iso) return "";
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
  } catch {
    return "";
  }
}

export default function DirecteurProfessorExamSurveillancePage() {
  const { language } = useLanguage();
  const tr = (en, fr) => (language === "fr" ? fr : en);

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [title, setTitle] = useState("");
  const [file, setFile] = useState(null);

  async function loadAll() {
    setLoading(true);
    setError("");
    try {
      const rRes = await api.get("/directeur/professeur-documents/exam_surveillance");
      setRows(Array.isArray(rRes.data) ? rRes.data : []);
    } catch (err) {
      setError(err?.response?.data?.message || tr("Failed to load.", "Echec du chargement."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  async function submit(e) {
    e.preventDefault();
    if (!file) return;
    setSaving(true);
    setError("");
    try {
      const fd = new FormData();
      if (title.trim()) fd.append("title", title.trim());
      if (startsAt) fd.append("starts_at", startsAt);
      if (endsAt) fd.append("ends_at", endsAt);
      fd.append("file", file);
      const res = await api.post("/directeur/professeur-documents/exam_surveillance", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setRows((prev) => [res.data, ...prev]);
      setTitle("");
      setStartsAt("");
      setEndsAt("");
      setFile(null);
      e.target.reset();
    } catch (err) {
      setError(err?.response?.data?.message || tr("Upload failed.", "Echec du televersement."));
    } finally {
      setSaving(false);
    }
  }

  async function remove(id) {
    if (!window.confirm(tr("Delete this document?", "Supprimer ce document ?"))) return;
    try {
      await api.delete(`/directeur/professeur-documents/${id}`);
      setRows((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      window.alert(err?.response?.data?.message || tr("Delete failed.", "Suppression impossible."));
    }
  }

  const hasActive = useMemo(() => rows.length > 0, [rows]);

  return (
    <div className="admin-wrap">
      <StaffSidebar variant="directeur" />

      <main className="admin-main">
        <header className="admin-topbar">
          <div>
            <h1 className="admin-title">{tr("Exam surveillance plan (professors)", "Planning de surveillance (professeurs)")}</h1>
            <p className="admin-subtitle">
              {tr(
                "Upload a PDF/image. Professors will see it only during the active date window.",
                "Téléversez un PDF/image. Les professeurs le verront uniquement pendant la période active.",
              )}
            </p>
          </div>
          <button type="button" className="admin-primary-btn" onClick={loadAll}>
            {tr("Refresh", "Actualiser")}
          </button>
        </header>

        {error ? <p style={{ margin: "0 0 12px", color: "#b91c1c", fontWeight: 700 }}>{error}</p> : null}

        <section className="admin-card admin-card--padded" style={{ marginBottom: 18 }}>
          <h2 className="admin-card-heading">{tr("New upload", "Nouveau televersement")}</h2>
          <form onSubmit={submit} className="admin-field-row" style={{ maxWidth: "none" }}>
            <div className="admin-field">
              <label className="admin-label">{tr("Start", "Debut")}</label>
              <input className="admin-input" type="date" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
            </div>
            <div className="admin-field">
              <label className="admin-label">{tr("End", "Fin")}</label>
              <input className="admin-input" type="date" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
            </div>
            <div className="admin-field" style={{ maxWidth: "none" }}>
              <label className="admin-label">{tr("Title (optional)", "Titre (optionnel)")}</label>
              <input className="admin-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={tr("e.g. Surveillance schedule", "ex: Planning surveillance")} />
            </div>
            <div className="admin-field" style={{ maxWidth: "none" }}>
              <label className="admin-label">{tr("File", "Fichier")}</label>
              <input className="admin-input" type="file" accept="application/pdf,image/*" onChange={(e) => setFile(e.target.files?.[0] || null)} />
            </div>
            <div className="admin-field--action">
              <button type="submit" className="admin-primary-btn" disabled={saving || !file}>
                {saving ? tr("Uploading…", "Televersement…") : tr("Upload", "Televerser")}
              </button>
            </div>
          </form>
        </section>

        <section className="admin-card admin-card--padded">
          <h2 className="admin-card-heading">{tr("Published documents", "Documents publiés")}</h2>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>{tr("Title", "Titre")}</th>
                  <th>{tr("Window", "Periode")}</th>
                  <th>{tr("File", "Fichier")}</th>
                  <th style={{ textAlign: "right" }}>{tr("Actions", "Actions")}</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={4} className="admin-empty">{tr("Loading…", "Chargement…")}</td></tr>
                ) : !hasActive ? (
                  <tr><td colSpan={4} className="admin-empty">{tr("No uploads yet.", "Aucun televersement.")}</td></tr>
                ) : rows.map((r) => (
                  <tr key={r.id}>
                    <td style={{ fontWeight: 900 }}>{r.title || "—"}</td>
                    <td style={{ color: "#64748b" }}>
                      {(r.starts_at ? formatDate(r.starts_at) : "—")} → {(r.ends_at ? formatDate(r.ends_at) : "—")}
                    </td>
                    <td>
                      <a href={r.file_url} target="_blank" rel="noreferrer">{r.title || tr("Open", "Ouvrir")}</a>
                    </td>
                    <td>
                      <div className="admin-actions" style={{ justifyContent: "flex-end" }}>
                        <button type="button" className="admin-secondary-btn" style={{ borderColor: "#ef4444", color: "#ef4444" }} onClick={() => remove(r.id)}>
                          {tr("Delete", "Supprimer")}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}

