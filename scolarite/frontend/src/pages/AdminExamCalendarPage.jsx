import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/axios";
import { clearAuth } from "../auth/auth";
import { useLanguage } from "../i18n/LanguageContext";
import "./AdminPanel.css";

function formatDate(iso) {
  if (!iso) return "";
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
  } catch {
    return "";
  }
}

function classLevelLabel(value, tr) {
  if (value === "first") return tr("First year", "1ere annee", "السنة الاولى");
  if (value === "second") return tr("Second year", "2eme annee", "السنة الثانية");
  if (value === "third_pfe") return tr("Third year (PFE)", "3eme annee (PFE)", "السنة الثالثة (PFE)");
  return tr("Level not set", "Niveau non defini", "المستوى غير محدد");
}

export default function AdminExamCalendarPage() {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const tr = (en, fr, ar) => (language === "fr" ? fr : language === "ar" ? ar : en);

  const [classes, setClasses] = useState([]);
  const [semestres, setSemestres] = useState([]);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const [classId, setClassId] = useState("");
  const [semestreId, setSemestreId] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [title, setTitle] = useState("");
  const [file, setFile] = useState(null);

  async function loadAll() {
    setLoading(true);
    setError("");
    try {
      const [cRes, sRes, rRes] = await Promise.all([
        api.get("/classes"),
        api.get("/plan-etudes/semestres"),
        api.get("/admin/class-documents/exam_calendar"),
      ]);
      setClasses(Array.isArray(cRes.data) ? cRes.data : []);
      setSemestres(Array.isArray(sRes.data) ? sRes.data : []);
      setRows(Array.isArray(rRes.data) ? rRes.data : []);
    } catch (err) {
      setError(err?.response?.data?.message || tr("Failed to load.", "Echec du chargement.", "فشل التحميل."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    if (!classId && classes.length) setClassId(String(classes[0].id));
  }, [classes, classId]);

  useEffect(() => {
    if (!semestreId && semestres.length) setSemestreId(String(semestres[0].id));
  }, [semestres, semestreId]);

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

  async function submit(e) {
    e.preventDefault();
    if (!classId || !file) return;
    setSaving(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("class_id", classId);
      if (semestreId) fd.append("semestre_id", semestreId);
      if (title.trim()) fd.append("title", title.trim());
      if (startsAt) fd.append("starts_at", startsAt);
      if (endsAt) fd.append("ends_at", endsAt);
      fd.append("file", file);
      const res = await api.post("/admin/class-documents/exam_calendar", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setRows((prev) => [res.data, ...prev]);
      setTitle("");
      setStartsAt("");
      setEndsAt("");
      setFile(null);
      e.target.reset();
    } catch (err) {
      setError(err?.response?.data?.message || tr("Upload failed.", "Echec du televersement.", "فشل الرفع."));
    } finally {
      setSaving(false);
    }
  }

  async function remove(id) {
    if (!window.confirm(tr("Delete this document?", "Supprimer ce document ?", "حذف هذا الملف؟"))) return;
    try {
      await api.delete(`/admin/class-documents/${id}`);
      setRows((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      window.alert(err?.response?.data?.message || tr("Delete failed.", "Suppression impossible.", "فشل الحذف."));
    }
  }

  const classOptions = useMemo(
    () => classes.map((c) => ({ id: String(c.id), label: `${c.name} (${classLevelLabel(c.niveau, tr)})${c.annee_scolaire ? ` — ${c.annee_scolaire}` : ""}` })),
    [classes, tr]
  );
  const semestreOptions = useMemo(() => semestres.map((s) => ({ id: String(s.id), label: s.label || `S${s.number}` })), [semestres]);

  return (
    <div className="admin-wrap">
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <div className="admin-brand-mark" aria-hidden="true">S</div>
          <div className="admin-brand-text">
            <div className="admin-brand-title">Scolarité</div>
            <div className="admin-brand-subtitle">{tr("Director of Studies", "Directeur des Etudes", "مدير الدراسات")}</div>
          </div>
        </div>
        <nav className="admin-nav">
          <Link className="admin-nav-item" to="/">{tr("Home", "Accueil", "الرئيسية")}</Link>
          <Link className="admin-nav-item" to="/directeur/classes">{tr("Classes", "Classes", "الأقسام")}</Link>
          <Link className="admin-nav-item" to="/directeur/plans">{tr("Study plans", "Plans d'etude", "مخططات الدراسة")}</Link>
          <Link className="admin-nav-item" to="/directeur/prof-assignments">{tr("Profs / subjects (panier)", "Profs / matieres (panier)", "الأساتذة / المواد")}</Link>
          <Link className="admin-nav-item" to="/directeur/timetable">{tr("Timetable", "Emploi du temps", "جدول التوقيت")}</Link>
          <Link className="admin-nav-item admin-nav-item--active" to="/directeur/exam-calendar">{tr("Exam calendar", "Calendrier des examens", "رزنامة الامتحانات")}</Link>
          <Link className="admin-nav-item" to="/change-password">{tr("Change password", "Changer le mot de passe", "تغيير كلمة المرور")}</Link>
        </nav>
        <div className="admin-sidebar-footer">
          <button type="button" className="admin-secondary-btn" style={{ width: "100%" }} onClick={handleLogout}>
            {tr("Logout", "Deconnexion", "تسجيل الخروج")}
          </button>
        </div>
      </aside>

      <main className="admin-main">
        <header className="admin-topbar">
          <div>
            <h1 className="admin-title">{tr("Exam calendar", "Calendrier des examens", "رزنامة الامتحانات")}</h1>
            <p className="admin-subtitle">{tr("Set exam start/end dates; document disappears after end date.", "Definissez debut/fin des examens; le document disparait apres la date de fin.", "حدّد بداية/نهاية الامتحانات؛ يختفي الملف بعد تاريخ النهاية.")}</p>
          </div>
          <button type="button" className="admin-primary-btn" onClick={loadAll}>
            {tr("Refresh", "Actualiser", "تحديث")}
          </button>
        </header>

        {error ? <p style={{ margin: "0 0 12px", color: "#b91c1c", fontWeight: 700 }}>{error}</p> : null}

        <section className="admin-card admin-card--padded" style={{ marginBottom: 18 }}>
          <h2 className="admin-card-heading">{tr("New upload", "Nouveau televersement", "رفع جديد")}</h2>
          <form onSubmit={submit} className="admin-field-row" style={{ maxWidth: "none" }}>
            <div className="admin-field">
              <label className="admin-label">{tr("Class", "Classe", "القسم")}</label>
              <select className="admin-input" value={classId} onChange={(e) => setClassId(e.target.value)}>
                {classOptions.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </div>
            <div className="admin-field">
              <label className="admin-label">{tr("Semester", "Semestre", "السداسي")}</label>
              <select className="admin-input" value={semestreId} onChange={(e) => setSemestreId(e.target.value)}>
                <option value="">{tr("— optional —", "— optionnel —", "— اختياري —")}</option>
                {semestreOptions.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </div>
            <div className="admin-field">
              <label className="admin-label">{tr("Exam start", "Debut exams", "بداية الامتحانات")}</label>
              <input className="admin-input" type="date" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
            </div>
            <div className="admin-field">
              <label className="admin-label">{tr("Exam end", "Fin exams", "نهاية الامتحانات")}</label>
              <input className="admin-input" type="date" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
            </div>
            <div className="admin-field" style={{ maxWidth: "none" }}>
              <label className="admin-label">{tr("Title (optional)", "Titre (optionnel)", "العنوان (اختياري)")}</label>
              <input className="admin-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={tr("e.g. Exam calendar S1", "ex: Calendrier examens S1", "مثال: رزنامة امتحانات س1")} />
            </div>
            <div className="admin-field" style={{ maxWidth: "none" }}>
              <label className="admin-label">{tr("File", "Fichier", "الملف")}</label>
              <input className="admin-input" type="file" accept="application/pdf,image/*" onChange={(e) => setFile(e.target.files?.[0] || null)} />
            </div>
            <div className="admin-field--action">
              <button type="submit" className="admin-primary-btn" disabled={saving || !classId || !file}>
                {saving ? tr("Uploading…", "Televersement…", "جارٍ الرفع…") : tr("Upload", "Televerser", "رفع")}
              </button>
            </div>
          </form>
        </section>

        <section className="admin-card admin-card--padded">
          <h2 className="admin-card-heading">{tr("Published exam calendars", "Calendriers publies", "الرزنامات المنشورة")}</h2>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>{tr("Class", "Classe", "القسم")}</th>
                  <th>{tr("Year", "Annee", "السنة")}</th>
                  <th>{tr("Semester", "Semestre", "السداسي")}</th>
                  <th>{tr("Window", "Periode", "الفترة")}</th>
                  <th>{tr("File", "Fichier", "الملف")}</th>
                  <th style={{ textAlign: "right" }}>{tr("Actions", "Actions", "إجراءات")}</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} className="admin-empty">{tr("Loading…", "Chargement…", "جارٍ التحميل…")}</td></tr>
                ) : rows.length === 0 ? (
                  <tr><td colSpan={6} className="admin-empty">{tr("No uploads yet.", "Aucun televersement.", "لا توجد ملفات بعد.")}</td></tr>
                ) : rows.map((r) => (
                  <tr key={r.id}>
                    <td style={{ fontWeight: 900 }}>{r.class_name || `#${r.class_id}`}</td>
                    <td>{r.annee_scolaire || "—"}</td>
                    <td>{r.semestre_label || "—"}</td>
                    <td style={{ color: "#64748b" }}>
                      {(r.starts_at ? formatDate(r.starts_at) : "—")} → {(r.ends_at ? formatDate(r.ends_at) : "—")}
                    </td>
                    <td>
                      <a href={r.file_url} target="_blank" rel="noreferrer">{r.title || tr("Open", "Ouvrir", "فتح")}</a>
                    </td>
                    <td>
                      <div className="admin-actions">
                        <button type="button" className="admin-secondary-btn" style={{ borderColor: "#ef4444", color: "#ef4444" }} onClick={() => remove(r.id)}>
                          {tr("Delete", "Supprimer", "حذف")}
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

