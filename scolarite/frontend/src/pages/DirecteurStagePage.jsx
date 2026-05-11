import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/axios";
import { useAuth } from "../auth/useAuth";
import { useLanguage } from "../i18n/LanguageContext";
import "./AdminPanel.css";

function isInternshipDirectorPostApproval(status) {
  return ["approved", "documents_pending_review", "documents_accepted"].includes(status);
}

export default function DirecteurStagePage() {
  const navigate = useNavigate();
  const auth = useAuth();
  const { language, t } = useLanguage();
  const tr = (en, fr, ar) => (language === "fr" ? fr : language === "ar" ? ar : en);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [decision, setDecision] = useState({});
  /** When expanded, holds draft fields for approved internships (PATCH approved-meta). */
  const [approvedEditDraft, setApprovedEditDraft] = useState({});

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await api.get("/directeur-stage/internships");
      setRows(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to load internship requests.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleLogout() {
    await auth.logout();
    navigate("/login");
  }

  async function decide(rowId, status) {
    setError("");
    const d = decision[rowId] || {};
    try {
      const res = await api.post(`/directeur-stage/internships/${rowId}/decision`, {
        decision: status,
        director_comment: d.director_comment || "",
        deadline_rapport: d.deadline_rapport || null,
        deadline_attestation: d.deadline_attestation || null,
      });
      setRows((prev) => prev.map((r) => (r.id === rowId ? res.data : r)));
    } catch (e) {
      setError(e?.response?.data?.message || "Decision failed.");
    }
  }

  async function remove(rowId) {
    if (!window.confirm("Supprimer cette demande de stage ?")) return;
    setError("");
    try {
      await api.delete(`/directeur-stage/internships/${rowId}`);
      setRows((prev) => prev.filter((r) => r.id !== rowId));
    } catch (e) {
      setError(e?.response?.data?.message || "Delete failed.");
    }
  }

  async function decideDocument(rowId, kind, decisionValue) {
    let comment = "";
    if (decisionValue === "rejected") {
      comment = window.prompt(tr("Reason / comment for the student (optional)", "Motif / commentaire pour l'étudiant (optionnel)", "سبب أو تعليق للطالب (اختياري)")) ?? "";
    }
    setError("");
    try {
      const res = await api.post(`/directeur-stage/internships/${rowId}/document-decision`, {
        kind,
        decision: decisionValue,
        comment: comment.trim() || undefined,
      });
      setRows((prev) => prev.map((r) => (r.id === rowId ? res.data : r)));
    } catch (e) {
      setError(e?.response?.data?.message || "Document decision failed.");
    }
  }

  function openApprovedEdit(row) {
    setApprovedEditDraft((prev) => ({
      ...prev,
      [row.id]: {
        director_comment: row.director_comment || "",
        deadline_rapport: row.deadline_rapport || "",
        deadline_attestation: row.deadline_attestation || "",
      },
    }));
  }

  function closeApprovedEdit(rowId) {
    setApprovedEditDraft((prev) => {
      const next = { ...prev };
      delete next[rowId];
      return next;
    });
  }

  async function saveApprovedMeta(rowId) {
    const d = approvedEditDraft[rowId];
    if (!d) return;
    setError("");
    try {
      const res = await api.patch(`/directeur-stage/internships/${rowId}/approved-meta`, {
        director_comment: d.director_comment || null,
        deadline_rapport: d.deadline_rapport || null,
        deadline_attestation: d.deadline_attestation || null,
      });
      setRows((prev) => prev.map((r) => (r.id === rowId ? res.data : r)));
      closeApprovedEdit(rowId);
    } catch (e) {
      setError(e?.response?.data?.message || tr("Save failed.", "Enregistrement échoué.", "فشل الحفظ."));
    }
  }

  async function viewFile(rowId, kind) {
    setError("");
    try {
      const res = await api.get(`/directeur-stage/internships/${rowId}/files/${kind}/view`, { responseType: "blob" });
      const mime = res.headers?.["content-type"] || "application/pdf";
      const blob = new Blob([res.data], { type: mime });
      const url = window.URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener,noreferrer");
      setTimeout(() => window.URL.revokeObjectURL(url), 60_000);
    } catch (e) {
      setError(e?.response?.data?.message || tr("File view failed.", "Affichage du fichier échoué.", "فشل عرض الملف."));
    }
  }

  return (
    <div className="admin-wrap">
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <div className="admin-brand-mark" aria-hidden="true">S</div>
          <div className="admin-brand-text">
            <div className="admin-brand-title">Scolarité</div>
            <div className="admin-brand-subtitle">{tr("Internship Director", "Directeur des Stages", "مدير التربصات")}</div>
          </div>
        </div>
        <nav className="admin-nav">
          <Link className="admin-nav-item" to="/">{t("navHome")}</Link>
          <Link className="admin-nav-item admin-nav-item--active" to="/directeur-stage/internships">{t("menuInternships")}</Link>
          <Link className="admin-nav-item" to="/directeur-stage/soutenance">{tr("Soutenance & jury", "Soutenance & jury", "المناقشة واللجنة")}</Link>
          <Link className="admin-nav-item" to="/directeur-stage/encadrement-pfe">{tr("PFE supervision", "Encadrement PFE", "إشراف PFE")}</Link>
          <Link className="admin-nav-item" to="/change-password">{t("changePassword")}</Link>
        </nav>
        <div className="admin-sidebar-footer">
          <button type="button" className="admin-secondary-btn" style={{ width: "100%" }} onClick={handleLogout}>
            {t("logout")}
          </button>
        </div>
      </aside>

      <main className="admin-main">
        <header className="admin-topbar">
          <div>
            <h1 className="admin-title">{tr("Internship Director", "Directeur des Stages", "مدير التربصات")}</h1>
            <p className="admin-subtitle">{tr("Validate internship requests and set report/attestation deadlines. Use “Soutenance & jury” once documents are accepted.", "Valider les demandes et fixer les deadlines (rapport/attestation). Utilisez « Soutenance & jury » une fois les documents acceptés.", "التحقق من الطلبات وآجال التقرير/الشهادة. استخدم « المناقشة واللجنة » بعد قبول الوثائق.")}</p>
          </div>
          <button className="admin-primary-btn" onClick={load}>{tr("Refresh", "Rafraîchir", "تحديث")}</button>
        </header>

        {error ? <p className="auth-error">{error}</p> : null}
        {loading ? <p className="admin-subtitle">{tr("Loading...", "Chargement...", "جار التحميل...")}</p> : null}

        <section className="admin-card admin-card--padded">
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>{tr("Student", "Étudiant", "الطالب")}</th>
                  <th>{tr("Class", "Classe", "القسم")}</th>
                  <th>{tr("Type", "Type", "النوع")}</th>
                  <th>{tr("Company", "Société", "الشركة")}</th>
                  <th>{tr("Period", "Période", "الفترة")}</th>
                  <th>{tr("Status", "Statut", "الحالة")}</th>
                  <th>{tr("Documents", "Documents", "الوثائق")}</th>
                  <th>{tr("Action", "Action", "الإجراء")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>#{r.id}</td>
                    <td>{r.student_name}</td>
                    <td>{r.class_name || "—"}</td>
                    <td>{r.internship_type}</td>
                    <td>{r.company_name}</td>
                    <td>{r.start_date} → {r.end_date}</td>
                    <td>{r.status}</td>
                    <td style={{ minWidth: 260 }}>
                      <div style={{ display: "grid", gap: 6 }}>
                        <div>
                          <strong>Demande signée:</strong>{" "}
                          {r.signed_demande_url ? (
                            <button type="button" className="admin-secondary-btn" onClick={() => viewFile(r.id, "signed_demande")}>{t("view")}</button>
                          ) : (
                            <span style={{ color: "#64748b" }}>—</span>
                          )}
                        </div>
                        <div>
                          <strong>Rapport:</strong>{" "}
                          {r.rapport_url ? (
                            <div style={{ display: "inline-flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                              <button type="button" className="admin-secondary-btn" onClick={() => viewFile(r.id, "rapport")}>{t("view")}</button>
                              <span style={{ color: "#475569", fontSize: 12 }}>{r.rapport_name || "rapport"}</span>
                              <span style={{ color: "#0f766e", fontSize: 12 }}>{r.rapport_status || "pending_review"}</span>
                              {isInternshipDirectorPostApproval(r.status) && r.rapport_status === "pending_review" ? (
                                <>
                                  <button type="button" className="admin-secondary-btn" onClick={() => decideDocument(r.id, "rapport", "accepted")}>Accept</button>
                                  <button type="button" className="admin-secondary-btn" onClick={() => decideDocument(r.id, "rapport", "rejected")}>Reject</button>
                                </>
                              ) : null}
                            </div>
                          ) : (
                            <span style={{ color: "#64748b" }}>—</span>
                          )}
                        </div>
                        <div>
                          <strong>Attestation:</strong>{" "}
                          {r.attestation_url ? (
                            <div style={{ display: "inline-flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                              <button type="button" className="admin-secondary-btn" onClick={() => viewFile(r.id, "attestation")}>{t("view")}</button>
                              <span style={{ color: "#475569", fontSize: 12 }}>{r.attestation_name || "attestation"}</span>
                              <span style={{ color: "#0f766e", fontSize: 12 }}>{r.attestation_status || "pending_review"}</span>
                              {isInternshipDirectorPostApproval(r.status) && r.attestation_status === "pending_review" ? (
                                <>
                                  <button type="button" className="admin-secondary-btn" onClick={() => decideDocument(r.id, "attestation", "accepted")}>Accept</button>
                                  <button type="button" className="admin-secondary-btn" onClick={() => decideDocument(r.id, "attestation", "rejected")}>Reject</button>
                                </>
                              ) : null}
                            </div>
                          ) : (
                            <span style={{ color: "#64748b" }}>—</span>
                          )}
                        </div>
                        <div style={{ color: "#64748b", fontSize: 12 }}>
                          DL rapport: {r.deadline_rapport || "—"} · DL attestation: {r.deadline_attestation || "—"}
                        </div>
                      </div>
                    </td>
                    <td style={{ minWidth: 320 }}>
                      {isInternshipDirectorPostApproval(r.status) && !approvedEditDraft[r.id] ? (
                        <button type="button" className="admin-primary-btn" onClick={() => openApprovedEdit(r)}>
                          {tr("Modify", "Modifier", "تعديل")}
                        </button>
                      ) : null}

                      {isInternshipDirectorPostApproval(r.status) && approvedEditDraft[r.id] ? (
                        <div style={{ display: "grid", gap: 6 }}>
                          <textarea
                            className="admin-input"
                            placeholder={tr("Comment", "Commentaire", "تعليق")}
                            value={approvedEditDraft[r.id].director_comment}
                            onChange={(e) =>
                              setApprovedEditDraft((p) => ({
                                ...p,
                                [r.id]: { ...p[r.id], director_comment: e.target.value },
                              }))
                            }
                          />
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                            <input
                              className="admin-input"
                              type="date"
                              title={tr("Report deadline", "Deadline rapport", "آخر أجل للتقرير")}
                              value={approvedEditDraft[r.id].deadline_rapport}
                              onChange={(e) =>
                                setApprovedEditDraft((p) => ({
                                  ...p,
                                  [r.id]: { ...p[r.id], deadline_rapport: e.target.value },
                                }))
                              }
                            />
                            <input
                              className="admin-input"
                              type="date"
                              title={tr("Attestation deadline", "Deadline attestation", "آخر أجل للشهادة")}
                              value={approvedEditDraft[r.id].deadline_attestation}
                              onChange={(e) =>
                                setApprovedEditDraft((p) => ({
                                  ...p,
                                  [r.id]: { ...p[r.id], deadline_attestation: e.target.value },
                                }))
                              }
                            />
                          </div>
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                            <button type="button" className="admin-primary-btn" onClick={() => saveApprovedMeta(r.id)}>
                              {tr("Save", "Enregistrer", "حفظ")}
                            </button>
                            <button type="button" className="admin-secondary-btn" onClick={() => closeApprovedEdit(r.id)}>
                              {tr("Cancel", "Annuler", "إلغاء")}
                            </button>
                            <button
                              type="button"
                              className="admin-secondary-btn"
                              style={{ borderColor: "#ef4444", color: "#ef4444" }}
                              onClick={() => remove(r.id)}
                            >
                              {tr("Delete", "Supprimer", "حذف")}
                            </button>
                          </div>
                        </div>
                      ) : null}

                      {!isInternshipDirectorPostApproval(r.status) ? (
                        <div style={{ display: "grid", gap: 6 }}>
                          <textarea
                            className="admin-input"
                            placeholder={tr("Comment", "Commentaire", "تعليق")}
                            value={decision[r.id]?.director_comment || ""}
                            onChange={(e) => setDecision((p) => ({ ...p, [r.id]: { ...(p[r.id] || {}), director_comment: e.target.value } }))}
                          />
                          <div style={{ display: "flex", gap: 6 }}>
                            <input
                              className="admin-input"
                              type="date"
                              value={decision[r.id]?.deadline_rapport || ""}
                              onChange={(e) => setDecision((p) => ({ ...p, [r.id]: { ...(p[r.id] || {}), deadline_rapport: e.target.value } }))}
                            />
                            <input
                              className="admin-input"
                              type="date"
                              value={decision[r.id]?.deadline_attestation || ""}
                              onChange={(e) => setDecision((p) => ({ ...p, [r.id]: { ...(p[r.id] || {}), deadline_attestation: e.target.value } }))}
                            />
                          </div>
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                            <button
                              className="admin-primary-btn"
                              onClick={() => decide(r.id, "approved")}
                              disabled={!r.signed_demande_url}
                              title={!r.signed_demande_url ? "Demande signée requise" : ""}
                            >
                              {tr("Approve", "Approuver", "قبول")}
                            </button>
                            <button className="admin-secondary-btn" onClick={() => decide(r.id, "rejected")}>{tr("Reject", "Rejeter", "رفض")}</button>
                            <button
                              className="admin-secondary-btn"
                              style={{ borderColor: "#ef4444", color: "#ef4444" }}
                              onClick={() => remove(r.id)}
                              title={tr("Delete", "Supprimer", "حذف")}
                            >
                              {tr("Delete", "Supprimer", "حذف")}
                            </button>
                          </div>
                        </div>
                      ) : null}
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
