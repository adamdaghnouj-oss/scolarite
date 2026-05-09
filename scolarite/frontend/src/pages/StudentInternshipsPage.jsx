import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/axios";
import { clearAuth } from "../auth/auth";
import { useLanguage } from "../i18n/LanguageContext";
import "./StudentPlansPage.css";
import "./StudentInternshipsPage.css";

export default function StudentInternshipsPage() {
  const navigate = useNavigate();
  const { language, t } = useLanguage();
  const tr = (en, fr) => (language === "fr" ? fr : en);

  const [ctx, setCtx] = useState({ departements: [], classes: [], students: [], recommended_type: "pfe" });
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [selectedDept, setSelectedDept] = useState("");
  const [selectedClassId, setSelectedClassId] = useState("");
  const [teammateId, setTeammateId] = useState("");
  const [form, setForm] = useState({
    company_name: "",
    internship_type: "pfe",
    project_name: "",
    project_description: "",
    start_date: "",
    end_date: "",
  });
  const [signedFile, setSignedFile] = useState(null);
  const [editId, setEditId] = useState(null);
  const [pendingDocs, setPendingDocs] = useState({});
  const [docsLockedRows, setDocsLockedRows] = useState({});

  async function loadAll() {
    setLoading(true);
    setError("");
    try {
      const [c, r] = await Promise.all([
        api.get("/student/internships/context"),
        api.get("/student/internships"),
      ]);
      setCtx(c.data || {});
      setRows(Array.isArray(r.data) ? r.data : []);
      setForm((prev) => ({ ...prev, internship_type: c.data?.recommended_type || "pfe" }));
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to load internships.");
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

  const classesByDept = useMemo(
    () => (ctx.classes || []).filter((c) => !selectedDept || c.departement === selectedDept),
    [ctx.classes, selectedDept]
  );
  const teammates = useMemo(
    () => (ctx.students || []).filter((s) => String(s.class_id) === String(selectedClassId)),
    [ctx.students, selectedClassId]
  );

  async function createRequest(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const payload = { ...form };
      if (teammateId) payload.teammate_student_id = Number(teammateId);
      const res = await api.post("/student/internships", payload);
      setRows((prev) => [res.data, ...prev]);
      setForm((prev) => ({
        ...prev,
        company_name: "",
        project_name: "",
        project_description: "",
        start_date: "",
        end_date: "",
      }));
      setTeammateId("");
    } catch (e2) {
      setError(e2?.response?.data?.message || "Failed to create request.");
    } finally {
      setSaving(false);
    }
  }

  async function downloadPreviewPdf() {
    setError("");
    try {
      const payload = { ...form };
      if (teammateId) payload.teammate_student_id = Number(teammateId);
      const res = await api.post("/student/internships/demande-pdf-preview", payload, { responseType: "blob" });
      const blob = new Blob([res.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `demande_stage_preview.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      const msg = e?.response?.data?.message || tr("Preview failed.", "Échec du téléchargement.");
      setError(msg);
    }
  }

  async function submitSignedFromForm() {
    if (!signedFile) {
      setError(tr("Please select the signed request file.", "Veuillez choisir le fichier de la demande signée."));
      return;
    }
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const fd = new FormData();
      fd.append("company_name", form.company_name);
      fd.append("internship_type", form.internship_type);
      if (form.project_name) fd.append("project_name", form.project_name);
      if (form.project_description) fd.append("project_description", form.project_description);
      fd.append("start_date", form.start_date);
      fd.append("end_date", form.end_date);
      if (teammateId) fd.append("teammate_student_id", teammateId);
      fd.append("file", signedFile);

      const res = await api.post("/student/internships/submit-signed", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setRows((prev) => [res.data, ...prev]);
      setSignedFile(null);
      setForm((prev) => ({
        ...prev,
        company_name: "",
        project_name: "",
        project_description: "",
        start_date: "",
        end_date: "",
      }));
      setTeammateId("");
    } catch (e) {
      setError(e?.response?.data?.message || tr("Submit failed.", "Échec de l'envoi."));
    } finally {
      setSaving(false);
    }
  }

  async function saveEdit(row) {
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const payload = {
        company_name: row.company_name,
        internship_type: row.internship_type,
        project_name: row.project_name || null,
        project_description: row.project_description || null,
        start_date: row.start_date,
        end_date: row.end_date,
        teammate_student_id: row.teammate_student_id || null,
      };
      const res = await api.put(`/student/internships/${row.id}`, payload);
      setRows((prev) => prev.map((r) => (r.id === row.id ? res.data : r)));
      setEditId(null);
    } catch (e) {
      setError(e?.response?.data?.message || tr("Update failed.", "Échec de la modification."));
    } finally {
      setSaving(false);
    }
  }

  async function uploadFile(id, endpoint, file) {
    const fd = new FormData();
    fd.append("file", file);
    const res = await api.post(`/student/internships/${id}/${endpoint}`, fd, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    setRows((prev) => prev.map((r) => (r.id === id ? res.data : r)));
    return res.data;
  }

  function setPendingDoc(rowId, kind, file) {
    setPendingDocs((prev) => ({
      ...prev,
      [rowId]: {
        ...(prev[rowId] || {}),
        [kind]: file || null,
      },
    }));
  }

  async function savePendingDocs(rowId) {
    const docs = pendingDocs[rowId] || {};
    if (!docs.rapport && !docs.attestation) {
      setError(tr("Please choose report or attestation file first.", "Veuillez d'abord choisir le rapport ou l'attestation."));
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");
    try {
      let lastUpdated = null;
      if (docs.rapport) {
        lastUpdated = await uploadFile(rowId, "upload-rapport", docs.rapport);
      }
      if (docs.attestation) {
        lastUpdated = await uploadFile(rowId, "upload-attestation", docs.attestation);
      }
      if (lastUpdated) {
        setRows((prev) => prev.map((r) => (r.id === rowId ? lastUpdated : r)));
      }
      setPendingDocs((prev) => ({
        ...prev,
        [rowId]: { rapport: null, attestation: null },
      }));
      setDocsLockedRows((prev) => ({ ...prev, [rowId]: true }));
      setSuccess(tr("Documents saved successfully.", "Documents enregistrés avec succès."));
    } catch (e) {
      setError(e?.response?.data?.message || tr("Upload failed.", "Le téléversement a échoué."));
    } finally {
      setSaving(false);
    }
  }

  async function downloadPdf(id, type) {
    const res = await api.get(`/student/internships/${id}/${type}`, { responseType: "blob" });
    const blob = new Blob([res.data], { type: "application/pdf" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${type}_${id}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  }

  async function downloadStoredFile(id, kind) {
    const res = await api.get(`/student/internships/${id}/files/${kind}`, { responseType: "blob" });
    const blob = new Blob([res.data]);
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${kind}_${id}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  }

  async function viewStoredFile(id, kind) {
    const res = await api.get(`/student/internships/${id}/files/${kind}/view`, { responseType: "blob" });
    const mime = res.headers?.["content-type"] || "application/pdf";
    const blob = new Blob([res.data], { type: mime });
    const url = window.URL.createObjectURL(blob);
    window.open(url, "_blank", "noopener,noreferrer");
    setTimeout(() => window.URL.revokeObjectURL(url), 60_000);
  }

  return (
    <div className="spn-wrap si-wrap">
      <header className="spn-topnav">
        <div className="spn-topnav-inner">
          <Link to="/" className="spn-brand">
            <span className="spn-brand-mark" aria-hidden="true">S</span>
            <span>Scolarité</span>
          </Link>
          <nav className="spn-links">
            <Link to="/">{t("navHome")}</Link>
            <Link to="/student/plans">{t("navPrograms")}</Link>
            <Link className="is-active" to="/student/internships">{t("menuInternships")}</Link>
            <Link to="/student/absences">{t("menuAbsenceNotices")}</Link>
          </nav>
          <div className="spn-actions">
            <Link className="spn-btn spn-btn-ghost" to="/profile">{t("profile")}</Link>
            <button type="button" className="spn-btn spn-btn-primary" onClick={handleLogout}>
              {t("logout")}
            </button>
          </div>
        </div>
      </header>

      <div className="spn-header">
        <div>
          <h1>{t("menuInternships")}</h1>
          <p>
            {tr(
              "Create your internship request, download the unsigned request PDF, upload the signed request, then upload your report and attestation after approval.",
              "Créez votre demande, téléchargez la demande (sans signature), téléversez la demande signée, puis le rapport et l'attestation après validation."
            )}
          </p>
        </div>
        <Link to="/" className="spn-back">← {t("navHome")}</Link>
      </div>

      {loading && <p className="spn-empty">{tr("Loading…", "Chargement…")}</p>}
      {error && <p className="spn-error">{error}</p>}
      {success ? <p style={{ color: "#15803d", margin: "8px 0" }}>{success}</p> : null}

      <section className="spn-details spn-card si-card" style={{ marginTop: 12 }}>
        <div className="si-card-head">
          <h2 className="si-h2">{tr("New internship request", "Nouvelle demande de stage")}</h2>
          <p className="si-sub">{tr("Fields marked * are required.", "Les champs marqués * sont obligatoires.")}</p>
        </div>

        <form className="si-form" onSubmit={createRequest}>
          <div className="si-grid">
            <div className="si-field">
              <label className="si-label">{tr("Internship type", "Type de stage")}</label>
              <select className="si-input" value={form.internship_type} onChange={(e) => setForm({ ...form, internship_type: e.target.value })}>
                <option value="observation">{tr("Observation (1st year)", "Observation (1ère année)")}</option>
                <option value="professionnel">{tr("Professional (2nd year)", "Professionnel (2ème année)")}</option>
                <option value="pfe">{tr("PFE (3rd year)", "PFE (3ème année)")}</option>
              </select>
            </div>
            <div className="si-field">
              <label className="si-label">{tr("Company *", "Société *")}</label>
              <input className="si-input" value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} required />
            </div>
            <div className="si-field">
              <label className="si-label">{tr("Project name", "Nom du projet")}</label>
              <input className="si-input" value={form.project_name} onChange={(e) => setForm({ ...form, project_name: e.target.value })} />
            </div>
            <div className="si-field si-field--full">
              <label className="si-label">{tr("Description", "Description")}</label>
              <textarea className="si-input si-textarea" rows={4} value={form.project_description} onChange={(e) => setForm({ ...form, project_description: e.target.value })} />
            </div>
            <div className="si-field">
              <label className="si-label">{tr("Start date *", "Date début *")}</label>
              <input className="si-input" type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} required />
            </div>
            <div className="si-field">
              <label className="si-label">{tr("End date *", "Date fin *")}</label>
              <input className="si-input" type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} required />
            </div>
          </div>

          <div className="si-divider" />

          <div className="si-card-head" style={{ marginTop: 6 }}>
            <h3 className="si-h3">{tr("Teammate (optional)", "Binôme (optionnel)")}</h3>
            <p className="si-sub">{tr("Pick department → class → student.", "Choisissez département → classe → étudiant.")}</p>
          </div>

          <div className="si-grid">
            <div className="si-field">
              <label className="si-label">{tr("Department", "Département")}</label>
              <select className="si-input" value={selectedDept} onChange={(e) => { setSelectedDept(e.target.value); setSelectedClassId(""); setTeammateId(""); }}>
                <option value="">{tr("Choose…", "Choisir…")}</option>
                {(ctx.departements || []).map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div className="si-field">
              <label className="si-label">{tr("Class", "Classe")}</label>
              <select className="si-input" value={selectedClassId} onChange={(e) => { setSelectedClassId(e.target.value); setTeammateId(""); }} disabled={!selectedDept}>
                <option value="">{tr("Choose…", "Choisir…")}</option>
                {classesByDept.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="si-field">
              <label className="si-label">{tr("Student", "Étudiant")}</label>
              <select className="si-input" value={teammateId} onChange={(e) => setTeammateId(e.target.value)} disabled={!selectedClassId}>
                <option value="">{tr("None", "Aucun")}</option>
                {teammates.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>

          <div className="si-actions">
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
              <button type="button" className="spn-btn spn-btn-ghost" onClick={downloadPreviewPdf} disabled={saving}>
                {tr("Download request (unsigned)", "Télécharger demande (sans signature)")}
              </button>
              <label className="spn-btn spn-btn-ghost">
                {tr("Choose signed request file", "Choisir demande signée")}
                <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" style={{ display: "none" }} onChange={(e) => setSignedFile(e.target.files?.[0] || null)} />
              </label>
              <span className="si-sub" style={{ alignSelf: "center", maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {signedFile ? signedFile.name : tr("No file selected", "Aucun fichier choisi")}
              </span>
              <button type="button" className="spn-btn spn-btn-primary" onClick={submitSignedFromForm} disabled={saving || !signedFile}>
                {saving ? tr("Submitting…", "Envoi…") : tr("Submit signed request", "Envoyer demande signée")}
              </button>
            </div>
          </div>
        </form>
      </section>

      <section className="spn-details spn-card si-card" style={{ marginTop: 12 }}>
        <div className="si-card-head">
          <h2 className="si-h2">{tr("My requests", "Mes demandes")}</h2>
          <p className="si-sub">{tr("Use actions to download/upload documents.", "Utilisez les actions pour télécharger/téléverser les documents.")}</p>
        </div>

        {!loading && rows.length === 0 ? (
          <p className="spn-empty">{tr("No requests yet.", "Aucune demande pour le moment.")}</p>
        ) : (
          <div className="spn-table-wrap">
            <table className="spn-table si-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>{tr("Type", "Type")}</th>
                  <th>{tr("Company", "Société")}</th>
                  <th>{tr("Status", "Statut")}</th>
                  <th>{tr("Deadlines", "Deadlines")}</th>
                  <th>{tr("Actions", "Actions")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="spn-cell-title">#{r.id}</td>
                    <td>{r.internship_type}</td>
                    <td>{r.company_name}</td>
                    <td>
                      <span className={`spn-pill ${r.status === "approved" ? "is-ok" : r.status === "rejected" ? "is-bad" : ""}`}>
                        {r.status}
                      </span>
                    </td>
                    <td>
                      <div className="si-deadlines">
                        <div>{tr("Report", "Rapport")}: <strong>{r.deadline_rapport || "—"}</strong></div>
                        <div>{tr("Attestation", "Attestation")}: <strong>{r.deadline_attestation || "—"}</strong></div>
                      </div>
                    </td>
                    <td>
                      <div className="si-actions-row">
                        {r.status === "draft" ? (
                          <>
                            <button type="button" className="spn-btn spn-btn-ghost" onClick={() => setEditId(r.id)}>
                              {tr("Modify", "Modifier")}
                            </button>
                          </>
                        ) : null}

                        {r.status === "signed_submitted" ? (
                          <>
                            {r.signed_demande_url ? (
                              <button type="button" className="spn-btn spn-btn-ghost" onClick={() => viewStoredFile(r.id, "signed_demande")}>
                                {tr("View signed request", "Voir demande signée")}
                              </button>
                            ) : null}
                            <span className="si-wait">
                              {tr("Waiting for director approval…", "En attente de validation du directeur…")}
                            </span>
                          </>
                        ) : null}

                        {r.status === "approved" ? (
                          <>
                            {docsLockedRows[r.id] ? (
                              <button
                                type="button"
                                className="spn-btn spn-btn-ghost"
                                onClick={() => setDocsLockedRows((prev) => ({ ...prev, [r.id]: false }))}
                              >
                                {tr("Modify", "Modifier")}
                              </button>
                            ) : (
                              <>
                                {r.signed_demande_url ? (
                                  <button type="button" className="spn-btn spn-btn-ghost" onClick={() => viewStoredFile(r.id, "signed_demande")}>
                                    {tr("Signed request (PDF)", "Demande signée (PDF)")}
                                  </button>
                                ) : null}
                                <button type="button" className="spn-btn spn-btn-ghost" onClick={() => downloadPdf(r.id, "affectation-pdf")}>
                                  {tr("Assignment letter PDF", "Lettre d'affectation (PDF)")}
                                </button>
                                <label className="spn-btn spn-btn-ghost">
                                  {r.rapport_url ? tr("Replace report", "Remplacer rapport") : tr("Upload report", "Téléverser rapport")}
                                  <input
                                    type="file"
                                    style={{ display: "none" }}
                                    onChange={(e) => setPendingDoc(r.id, "rapport", e.target.files?.[0] || null)}
                                  />
                                </label>
                                <label className="spn-btn spn-btn-ghost">
                                  {r.attestation_url ? tr("Replace attestation", "Remplacer attestation") : tr("Upload attestation", "Téléverser attestation")}
                                  <input
                                    type="file"
                                    style={{ display: "none" }}
                                    onChange={(e) => setPendingDoc(r.id, "attestation", e.target.files?.[0] || null)}
                                  />
                                </label>
                                {pendingDocs[r.id]?.rapport ? (
                                  <span className="si-sub">{tr("Selected report", "Rapport sélectionné")}: <strong>{pendingDocs[r.id].rapport.name}</strong></span>
                                ) : null}
                                {pendingDocs[r.id]?.attestation ? (
                                  <span className="si-sub">{tr("Selected attestation", "Attestation sélectionnée")}: <strong>{pendingDocs[r.id].attestation.name}</strong></span>
                                ) : null}
                                {r.rapport_name ? (
                                  <span className="si-sub" style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                                    {tr("Report file", "Fichier rapport")}: <strong>{r.rapport_name}</strong> ({r.rapport_status || "pending_review"})
                                    <button type="button" className="spn-btn spn-btn-ghost" onClick={() => viewStoredFile(r.id, "rapport")}>
                                      {tr("View report", "Voir rapport")}
                                    </button>
                                  </span>
                                ) : null}
                                {r.attestation_name ? (
                                  <span className="si-sub" style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                                    {tr("Attestation file", "Fichier attestation")}: <strong>{r.attestation_name}</strong> ({r.attestation_status || "pending_review"})
                                    <button type="button" className="spn-btn spn-btn-ghost" onClick={() => viewStoredFile(r.id, "attestation")}>
                                      {tr("View attestation", "Voir attestation")}
                                    </button>
                                  </span>
                                ) : null}
                                <button
                                  type="button"
                                  className="spn-btn spn-btn-primary"
                                  onClick={() => savePendingDocs(r.id)}
                                  disabled={saving || (!pendingDocs[r.id]?.rapport && !pendingDocs[r.id]?.attestation)}
                                >
                                  {saving ? tr("Saving…", "Enregistrement…") : tr("Save documents", "Enregistrer les documents")}
                                </button>
                              </>
                            )}
                          </>
                        ) : null}

                        {r.status === "rejected" ? (
                          <>
                            <button type="button" className="spn-btn spn-btn-ghost" onClick={() => downloadPdf(r.id, "demande-pdf")}>
                              {tr("Download request (unsigned)", "Télécharger demande (sans signature)")}
                            </button>
                            <button type="button" className="spn-btn spn-btn-ghost" onClick={() => setEditId(r.id)}>
                              {tr("Modify", "Modifier")}
                            </button>
                            <label className="spn-btn spn-btn-ghost">
                              {tr("Re-upload signed request", "Re-téléverser demande signée")}
                              <input
                                type="file"
                                style={{ display: "none" }}
                                onChange={(e) => e.target.files?.[0] && uploadFile(r.id, "upload-signed-demande", e.target.files[0])}
                              />
                            </label>
                          </>
                        ) : null}
                      </div>

                      {editId === r.id ? (
                        <div className="si-edit">
                          <div className="si-grid" style={{ marginTop: 10 }}>
                            <div className="si-field">
                              <label className="si-label">{tr("Company *", "Société *")}</label>
                              <input className="si-input" value={r.company_name} onChange={(e) => setRows((p) => p.map((x) => x.id === r.id ? { ...x, company_name: e.target.value } : x))} />
                            </div>
                            <div className="si-field">
                              <label className="si-label">{tr("Start date *", "Date début *")}</label>
                              <input className="si-input" type="date" value={r.start_date || ""} onChange={(e) => setRows((p) => p.map((x) => x.id === r.id ? { ...x, start_date: e.target.value } : x))} />
                            </div>
                            <div className="si-field">
                              <label className="si-label">{tr("End date *", "Date fin *")}</label>
                              <input className="si-input" type="date" value={r.end_date || ""} onChange={(e) => setRows((p) => p.map((x) => x.id === r.id ? { ...x, end_date: e.target.value } : x))} />
                            </div>
                            <div className="si-field si-field--full">
                              <label className="si-label">{tr("Project name", "Nom du projet")}</label>
                              <input className="si-input" value={r.project_name || ""} onChange={(e) => setRows((p) => p.map((x) => x.id === r.id ? { ...x, project_name: e.target.value } : x))} />
                            </div>
                            <div className="si-field si-field--full">
                              <label className="si-label">{tr("Description", "Description")}</label>
                              <textarea className="si-input si-textarea" rows={3} value={r.project_description || ""} onChange={(e) => setRows((p) => p.map((x) => x.id === r.id ? { ...x, project_description: e.target.value } : x))} />
                            </div>
                          </div>
                          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 10 }}>
                            <button type="button" className="spn-btn spn-btn-ghost" onClick={() => setEditId(null)}>{tr("Cancel", "Annuler")}</button>
                            <button type="button" className="spn-btn spn-btn-primary" disabled={saving} onClick={() => saveEdit(r)}>{tr("Save", "Enregistrer")}</button>
                          </div>
                        </div>
                      ) : null}

                      {r.director_comment ? <div className="si-comment">{tr("Director comment", "Commentaire")} : {r.director_comment}</div> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
