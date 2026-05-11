import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/axios";
import { useAuth } from "../auth/useAuth";
import { useLanguage } from "../i18n/LanguageContext";
import "./AdminPanel.css";

function jurySlotsExpected(internshipType) {
  if (internshipType === "observation") return 1;
  if (internshipType === "professionnel") return 2;
  return 4;
}

function normalizeJuryDraft(row) {
  const n = jurySlotsExpected(row.internship_type);
  const fromApi = Array.isArray(row.soutenance_jury)
    ? [...row.soutenance_jury].sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    : [];
  const ids = [];
  for (let i = 0; i < n; i += 1) {
    ids.push(fromApi[i]?.professeur_id != null ? String(fromApi[i].professeur_id) : "");
  }
  return ids;
}

export default function DirecteurStageSoutenancePage() {
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
  const [draft, setDraft] = useState({ soutenance_date: "", jury_professeur_ids: [] });

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
      const res = await api.get("/directeur-stage/internships/soutenance-board", { params });
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
      soutenance_date: row.soutenance_date || "",
      jury_professeur_ids: normalizeJuryDraft(row),
    });
  }

  function closeEdit() {
    setEditingId(null);
    setDraft({ soutenance_date: "", jury_professeur_ids: [] });
  }

  async function saveRow(rowId) {
    const row = rows.find((r) => r.id === rowId);
    if (!row) return;
    const expected = jurySlotsExpected(row.internship_type);
    const ids = draft.jury_professeur_ids.map((x) => String(x).trim()).filter(Boolean);
    const nums = ids.map((id) => Number(id));
    if (nums.length !== expected || nums.some((n) => Number.isNaN(n))) {
      setError(tr(`Pick exactly ${expected} professor(s).`, `Choisissez exactement ${expected} professeur(s).`, `اختر ${expected} أستاذًا بالضبط.`));
      return;
    }
    if (new Set(nums).size !== nums.length) {
      setError(tr("Professors must be distinct.", "Les professeurs doivent être distincts.", "يجب أن يكون الأساتذة مختلفين."));
      return;
    }

    setError("");
    try {
      const res = await api.patch(`/directeur-stage/internships/${rowId}/soutenance`, {
        soutenance_date: draft.soutenance_date || null,
        jury_professeur_ids: nums,
      });
      setRows((prev) => prev.map((r) => (r.id === rowId ? res.data : r)));
      closeEdit();
    } catch (e) {
      setError(e?.response?.data?.message || tr("Save failed.", "Enregistrement échoué.", "فشل الحفظ."));
    }
  }

  async function publishRow(rowId) {
    setError("");
    try {
      const res = await api.post(`/directeur-stage/internships/${rowId}/soutenance/publish`);
      setRows((prev) => prev.map((r) => (r.id === rowId ? res.data : r)));
      closeEdit();
    } catch (e) {
      setError(e?.response?.data?.message || tr("Publish failed.", "Publication échouée.", "فشل النشر."));
    }
  }

  async function unpublishRow(rowId) {
    setError("");
    try {
      const res = await api.post(`/directeur-stage/internships/${rowId}/soutenance/unpublish`);
      setRows((prev) => prev.map((r) => (r.id === rowId ? res.data : r)));
      closeEdit();
    } catch (e) {
      setError(e?.response?.data?.message || tr("Unpublish failed.", "Dépublication échouée.", "فشل إلغاء النشر."));
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
      const res = await api.get(`/directeur-stage/classes/${classId}/internships-soutenance-pdf`, {
        responseType: "blob",
      });
      const blob = new Blob([res.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `soutenance_classe_${classId}.pdf`;
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
          <Link className="admin-nav-item admin-nav-item--active" to="/directeur-stage/soutenance">{tr("Soutenance & jury", "Soutenance & jury", "المناقشة واللجنة")}</Link>
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
            <h1 className="admin-title">{tr("Defense planning & jury", "Soutenance et jury", "التخطيط للمناقشة ولجنة التحكيم")}</h1>
            <p className="admin-subtitle">
              {tr(
                "After report and attestation are accepted: assign professors (1 / 2 / 4 by internship type), set the defense date, save, then publish so students see it. Any jury professor may also publish.",
                "Après acceptation du rapport et de l'attestation : affectez les professeurs (1 / 2 / 4 selon le type), fixez la date de soutenance, enregistrez puis publiez pour les étudiants. Un membre du jury peut aussi publier.",
                "بعد قبول التقرير والشهادة: عيّن الأساتذة (١ / ٢ / ٤ حسب النوع)، ثم تاريخ المناقشة، واحفظ ثم انشر للطلاب. يمكن لعضو اللجنة النشر أيضًا."
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
              {tr("Pick a class to export the planning table to PDF.", "Choisissez une classe pour exporter le tableau en PDF.", "اختر قسمًا لتصدير الجدول إلى PDF.")}
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
                  <th>{tr("Type", "Type", "النوع")}</th>
                  <th>{tr("Company", "Société", "الشركة")}</th>
                  <th>{tr("Defense date", "Date soutenance", "تاريخ المناقشة")}</th>
                  <th>{tr("Jury", "Jury", "اللجنة")}</th>
                  <th>{tr("Published", "Publié", "منشور")}</th>
                  <th>{tr("Action", "Action", "إجراء")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const expected = jurySlotsExpected(r.internship_type);
                  const juryCount = Array.isArray(r.soutenance_jury) ? r.soutenance_jury.length : 0;
                  const isEditing = editingId === r.id;
                  return (
                    <tr key={r.id}>
                      <td>#{r.id}</td>
                      <td>{r.student_name}</td>
                      <td>{r.class_name || "—"}</td>
                      <td>{r.internship_type}</td>
                      <td>{r.company_name}</td>
                      <td>{r.soutenance_date || "—"}</td>
                      <td style={{ fontSize: 12 }}>
                        {juryCount}/{expected}
                        {Array.isArray(r.soutenance_jury) && r.soutenance_jury.length > 0 ? (
                          <div style={{ color: "#64748b", marginTop: 4 }}>
                            {r.soutenance_jury.map((j) => j.name).filter(Boolean).join(", ")}
                          </div>
                        ) : null}
                      </td>
                      <td>{r.soutenance_published_at ? tr("Yes", "Oui", "نعم") : tr("No", "Non", "لا")}</td>
                      <td style={{ minWidth: 280 }}>
                        {!isEditing ? (
                          <button type="button" className="admin-primary-btn" onClick={() => openEdit(r)}>
                            {tr("Modify", "Modifier", "تعديل")}
                          </button>
                        ) : (
                          <div style={{ display: "grid", gap: 8 }}>
                            <label className="admin-label" style={{ margin: 0 }}>{tr("Defense date", "Date soutenance", "تاريخ المناقشة")}</label>
                            <input
                              className="admin-input"
                              type="date"
                              value={draft.soutenance_date || ""}
                              onChange={(e) => setDraft((d) => ({ ...d, soutenance_date: e.target.value }))}
                            />
                            {draft.jury_professeur_ids.map((val, idx) => (
                              <div key={idx}>
                                <label className="admin-label" style={{ margin: "0 0 4px 0", display: "block" }}>
                                  {tr("Professor", "Professeur", "أستاذ")} {idx + 1}/{expected}
                                </label>
                                <select
                                  className="admin-input"
                                  value={val}
                                  onChange={(e) =>
                                    setDraft((d) => {
                                      const next = [...d.jury_professeur_ids];
                                      next[idx] = e.target.value;
                                      return { ...d, jury_professeur_ids: next };
                                    })
                                  }
                                >
                                  <option value="">{tr("— Choose —", "— Choisir —", "— اختر —")}</option>
                                  {sortedProfs.map((p) => (
                                    <option key={p.id} value={String(p.id)}>{p.name}{p.departement ? ` (${p.departement})` : ""}</option>
                                  ))}
                                </select>
                              </div>
                            ))}
                            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                              <button type="button" className="admin-primary-btn" onClick={() => saveRow(r.id)}>
                                {tr("Save", "Enregistrer", "حفظ")}
                              </button>
                              <button
                                type="button"
                                className="admin-secondary-btn"
                                onClick={() => publishRow(r.id)}
                                disabled={!!r.soutenance_published_at}
                              >
                                {tr("Publish for students", "Publier (étudiants)", "نشر للطلاب")}
                              </button>
                              <button
                                type="button"
                                className="admin-secondary-btn"
                                onClick={() => unpublishRow(r.id)}
                                disabled={!r.soutenance_published_at}
                              >
                                {tr("Unpublish", "Dépublier", "إلغاء النشر")}
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
                {tr("No eligible internships (approved + report & attestation accepted).", "Aucune demande éligible (validée + rapport et attestation acceptés).", "لا توجد طلبات مؤهلة.")}
              </p>
            ) : null}
          </div>
        </section>
      </main>
    </div>
  );
}
