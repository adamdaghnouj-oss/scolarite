import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/axios";
import { useAuth } from "../auth/useAuth";
import { useLanguage } from "../i18n/LanguageContext";
import "./AdminPanel.css";

export default function DirecteurStageEncadrementPage() {
  const navigate = useNavigate();
  const auth = useAuth();
  const { language, t } = useLanguage();
  const tr = (en, fr, ar) => (language === "fr" ? fr : language === "ar" ? ar : en);

  const [classes, setClasses] = useState([]);
  const [profs, setProfs] = useState([]);
  const [classId, setClassId] = useState("");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pdfBusy, setPdfBusy] = useState(false);

  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState({
    encadrant_professeur_id: "",
    encadrement_start_date: "",
    encadrement_end_date: "",
  });

  const loadRefs = useCallback(async () => {
    try {
      const [cRes, pRes] = await Promise.all([api.get("/classes"), api.get("/professeurs")]);
      setClasses(Array.isArray(cRes.data) ? cRes.data : []);
      setProfs(Array.isArray(pRes.data) ? pRes.data : []);
    } catch {
      setClasses([]);
      setProfs([]);
    }
  }, []);

  const loadBoard = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = classId ? { class_id: classId } : {};
      const res = await api.get("/directeur-stage/internships/encadrement-board", { params });
      setRows(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      setError(e?.response?.data?.message || tr("Failed to load.", "Échec du chargement.", "فشل التحميل."));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [classId]);

  useEffect(() => {
    loadRefs();
  }, [loadRefs]);

  useEffect(() => {
    loadBoard();
  }, [loadBoard]);

  async function handleLogout() {
    await auth.logout();
    navigate("/login");
  }

  function openEdit(row) {
    setEditingId(row.id);
    setDraft({
      encadrant_professeur_id: row.encadrant_professeur_id != null ? String(row.encadrant_professeur_id) : "",
      encadrement_start_date: row.encadrement_start_date || "",
      encadrement_end_date: row.encadrement_end_date || "",
    });
  }

  function closeEdit() {
    setEditingId(null);
    setDraft({ encadrant_professeur_id: "", encadrement_start_date: "", encadrement_end_date: "" });
  }

  async function saveRow(rowId) {
    const pid = Number(draft.encadrant_professeur_id);
    if (!draft.encadrant_professeur_id || Number.isNaN(pid)) {
      setError(tr("Choose an encadrant professor.", "Choisissez un professeur encadrant.", "اختر الأستاذ المشرف."));
      return;
    }
    if (!draft.encadrement_start_date || !draft.encadrement_end_date) {
      setError(tr("Start and end dates are required.", "Les dates début et fin sont obligatoires.", "تواريخ البداية والنهاية مطلوبة."));
      return;
    }

    setError("");
    try {
      const res = await api.patch(`/directeur-stage/internships/${rowId}/encadrement`, {
        encadrant_professeur_id: pid,
        encadrement_start_date: draft.encadrement_start_date,
        encadrement_end_date: draft.encadrement_end_date,
      });
      setRows((prev) => prev.map((r) => (r.id === rowId ? res.data : r)));
      closeEdit();
    } catch (e) {
      setError(e?.response?.data?.message || tr("Save failed.", "Enregistrement échoué.", "فشل الحفظ."));
    }
  }

  async function downloadPdf() {
    if (!classId) {
      setError(tr("Select a class first.", "Choisissez une classe d'abord.", "اختر قسمًا أولًا."));
      return;
    }
    setPdfBusy(true);
    setError("");
    try {
      const res = await api.get(`/directeur-stage/classes/${classId}/internships-encadrement-pdf`, {
        responseType: "blob",
      });
      const blob = new Blob([res.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `encadrement_pfe_classe_${classId}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      setError(e?.response?.data?.message || tr("PDF download failed.", "Échec du téléchargement PDF.", "فشل تنزيل PDF."));
    } finally {
      setPdfBusy(false);
    }
  }

  const sortedClasses = useMemo(() => {
    const list = [...classes];
    list.sort((a, b) => String(a.name ?? "").localeCompare(String(b.name ?? "")));
    return list;
  }, [classes]);

  const sortedProfs = useMemo(() => {
    const list = [...profs];
    list.sort((a, b) => String(a.name ?? "").localeCompare(String(b.name ?? "")));
    return list;
  }, [profs]);

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
          <Link className="admin-nav-item" to="/directeur-stage/internships">{t("menuInternships")}</Link>
          <Link className="admin-nav-item" to="/directeur-stage/soutenance">{tr("Soutenance & jury", "Soutenance & jury", "المناقشة واللجنة")}</Link>
          <Link className="admin-nav-item admin-nav-item--active" to="/directeur-stage/encadrement-pfe">{tr("PFE supervision", "Encadrement PFE", "إشراف PFE")}</Link>
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
            <h1 className="admin-title">{tr("PFE project supervision", "Encadrement des projets PFE", "إشراف مشاريع PFE")}</h1>
            <p className="admin-subtitle">
              {tr(
                "After you accept the student’s report: assign one encadrant (professor) per PFE and set supervision start/end dates. Students and professors see it once saved.",
                "Après acceptation du rapport : affectez un encadrant par projet PFE et les dates début/fin d’encadrement. Visible pour étudiants et professeur après enregistrement.",
                "بعد قبول التقرير: عيّن مشرفًا لكل مشروع PFE مع تواريخ بداية ونهاية الإشراف.",
              )}
            </p>
          </div>
          <button type="button" className="admin-primary-btn" onClick={loadBoard}>{tr("Refresh", "Rafraîchir", "تحديث")}</button>
        </header>

        <section className="admin-card admin-card--padded" style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end" }}>
            <div>
              <label className="admin-label" style={{ display: "block", marginBottom: 4 }}>{tr("Class filter", "Classe", "القسم")}</label>
              <select className="admin-input" value={classId} onChange={(e) => setClassId(e.target.value)}>
                <option value="">{tr("All classes", "Toutes les classes", "كل الأقسام")}</option>
                {sortedClasses.map((c) => (
                  <option key={c.id} value={String(c.id)}>{c.name}{c.departement ? ` — ${c.departement}` : ""}</option>
                ))}
              </select>
            </div>
            <button type="button" className="admin-secondary-btn" disabled={pdfBusy || !classId} onClick={downloadPdf}>
              {pdfBusy ? tr("Downloading…", "Téléchargement…", "جارٍ التنزيل…") : tr("Download class PDF", "PDF classe", "PDF القسم")}
            </button>
          </div>
          {!classId ? (
            <p className="admin-subtitle" style={{ marginTop: 10 }}>
              {tr("Pick a class to export the encadrement table to PDF.", "Choisissez une classe pour exporter le tableau en PDF.", "اختر قسمًا لتصدير الجدول.")}
            </p>
          ) : null}
        </section>

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
                  <th>{tr("Project", "Projet", "المشروع")}</th>
                  <th>{tr("Company", "Société", "الشركة")}</th>
                  <th>{tr("Encadrant", "Encadrant", "المشرف")}</th>
                  <th>{tr("Start", "Début", "البداية")}</th>
                  <th>{tr("End", "Fin", "النهاية")}</th>
                  <th>{tr("Action", "Action", "إجراء")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const isEditing = editingId === r.id;
                  return (
                    <tr key={r.id}>
                      <td>#{r.id}</td>
                      <td>{r.student_name}</td>
                      <td>{r.class_name || "—"}</td>
                      <td>{r.project_name || "—"}</td>
                      <td>{r.company_name}</td>
                      <td>{r.encadrant_name || "—"}</td>
                      <td>{r.encadrement_start_date || "—"}</td>
                      <td>{r.encadrement_end_date || "—"}</td>
                      <td style={{ minWidth: 260 }}>
                        {!isEditing ? (
                          <button type="button" className="admin-primary-btn" onClick={() => openEdit(r)}>
                            {tr("Modify", "Modifier", "تعديل")}
                          </button>
                        ) : (
                          <div style={{ display: "grid", gap: 8 }}>
                            <select
                              className="admin-input"
                              value={draft.encadrant_professeur_id}
                              onChange={(e) => setDraft((d) => ({ ...d, encadrant_professeur_id: e.target.value }))}
                            >
                              <option value="">{tr("— Encadrant —", "— Encadrant —", "— المشرف —")}</option>
                              {sortedProfs.map((p) => (
                                <option key={p.id} value={String(p.id)}>{p.name}{p.departement ? ` (${p.departement})` : ""}</option>
                              ))}
                            </select>
                            <input
                              className="admin-input"
                              type="date"
                              value={draft.encadrement_start_date}
                              onChange={(e) => setDraft((d) => ({ ...d, encadrement_start_date: e.target.value }))}
                            />
                            <input
                              className="admin-input"
                              type="date"
                              value={draft.encadrement_end_date}
                              onChange={(e) => setDraft((d) => ({ ...d, encadrement_end_date: e.target.value }))}
                            />
                            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                              <button type="button" className="admin-primary-btn" onClick={() => saveRow(r.id)}>
                                {tr("Save", "Enregistrer", "حفظ")}
                              </button>
                              <button type="button" className="admin-secondary-btn" onClick={closeEdit}>
                                {tr("Cancel", "Annuler", "إلغاء")}
                              </button>
                            </div>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!loading && rows.length === 0 ? (
              <p className="admin-subtitle" style={{ padding: 16 }}>
                {tr("No PFE internships with accepted report.", "Aucun PFE avec rapport accepté.", "لا توجد طلبات PFE بتقرير مقبول.")}
              </p>
            ) : null}
          </div>
        </section>
      </main>
    </div>
  );
}
