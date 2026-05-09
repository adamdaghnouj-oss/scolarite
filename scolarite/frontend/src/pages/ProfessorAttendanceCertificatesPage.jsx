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

function StatusPill({ status, t }) {
  const label = status === "accepted" ? t("acAccepted") : status === "rejected" ? t("acRejected") : t("acPending");
  const style = status === "accepted"
    ? { background: "#dcfce7", color: "#166534" }
    : status === "rejected"
      ? { background: "#fee2e2", color: "#991b1b" }
      : { background: "#fef9c3", color: "#854d0e" };
  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      padding: "2px 10px",
      borderRadius: 999,
      fontSize: 12,
      fontWeight: 800,
      ...style,
    }}
    >
      {label}
    </span>
  );
}

export default function ProfessorAttendanceCertificatesPage() {
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const tr = (en, fr, ar) => (language === "fr" ? fr : language === "ar" ? ar : en);

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [workingId, setWorkingId] = useState(null);
  const [profId, setProfId] = useState(null);

  async function loadAll() {
    setLoading(true);
    setError("");
    try {
      const res = await api.get("/professeur/attendance-certificates");
      setRows(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      setRows([]);
      setError(err?.response?.data?.message || tr("Failed to load requests.", "Echec du chargement des demandes.", "فشل تحميل الطلبات."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    (async () => {
      try {
        const res = await api.get("/student/profile");
        const id = res.data?.student?.id ?? null;
        if (id != null) setProfId(Number(id));
      } catch {
        // ignore
      }
    })();
  }, []);

  function myDecision(row) {
    const approvals = Array.isArray(row?.approvals) ? row.approvals : [];
    const match = profId != null
      ? approvals.find((a) => Number(a?.professeur_id) === Number(profId)) || null
      : null;
    return match?.decision || "pending";
  }

  async function decide(rowId, decision) {
    setWorkingId(rowId);
    setError("");
    try {
      const res = await api.post(`/professeur/attendance-certificates/${rowId}/decision`, { decision });
      const updated = res.data;
      setRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    } catch (err) {
      setError(err?.response?.data?.message || tr("Failed to save decision.", "Echec de l'enregistrement.", "فشل حفظ القرار."));
    } finally {
      setWorkingId(null);
    }
  }

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

  return (
    <div className="admin-wrap">
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <div className="admin-brand-mark" aria-hidden="true">S</div>
          <div className="admin-brand-text">
            <div className="admin-brand-title">Scolarite</div>
            <div className="admin-brand-subtitle">{tr("Professor", "Professeur", "أستاذ")}</div>
          </div>
        </div>
        <nav className="admin-nav">
          <p className="admin-nav-section-label">{tr("Menu", "Menu", "القائمة")}</p>
          <Link className="admin-nav-item" to="/">
            {tr("Home", "Accueil", "الرئيسية")}
          </Link>

          <p className="admin-nav-section-label">{tr("Teaching", "Enseignement", "التدريس")}</p>
          <Link className="admin-nav-item" to="/professeur">
            {tr("My classes", "Mes classes", "أقسامى")}
          </Link>
          <Link className="admin-nav-item" to="/professeur/notes">
            {tr("Grades", "Notes", "العلامات")}
          </Link>
          <Link className="admin-nav-item" to="/professeur/absences">
            {tr("Absences", "Absences", "الغيابات")}
          </Link>
          <Link className="admin-nav-item admin-nav-item--active" to="/professeur/attendance-certificates">
            {t("menuAttendanceCert")}
          </Link>
          <Link className="admin-nav-item" to="/professeur/timetable">
            {tr("Timetable", "Emploi du temps", "جدول التوقيت")}
          </Link>
          <Link className="admin-nav-item" to="/professeur/exam-surveillance">
            {tr("Exam surveillance", "Surveillance examens", "مراقبة الامتحانات")}
          </Link>

          <p className="admin-nav-section-label">{tr("Campus", "Campus", "الحرم")}</p>
          <Link className="admin-nav-item" to="/student/posts">
            {tr("Posts", "Publications", "منشورات")}
          </Link>
          <Link className="admin-nav-item" to="/student/friends">
            {tr("Friends", "Reseau", "الأصدقاء")}
          </Link>
          <Link className="admin-nav-item" to="/messages/panier">
            {t("menuPanierMessages")}
          </Link>

          <p className="admin-nav-section-label">{tr("Account", "Compte", "الحساب")}</p>
          <Link className="admin-nav-item" to="/profile">
            {tr("Profile", "Profil", "الملف الشخصي")}
          </Link>
          <Link className="admin-nav-item" to="/change-password">
            {tr("Change password", "Changer le mot de passe", "تغيير كلمة المرور")}
          </Link>
        </nav>
        <div className="admin-sidebar-footer">
          <button type="button" className="admin-secondary-btn" style={{ width: "100%" }} onClick={handleLogout}>
            {t("logout")}
          </button>
        </div>
      </aside>

      <main className="admin-main admin-main--professor">
        <header className="admin-topbar">
          <div>
            <h1 className="admin-title">{t("menuAttendanceCert")}</h1>
            <p className="admin-subtitle">{tr("Approve or reject student requests.", "Acceptez ou refusez les demandes des etudiants.", "وافق أو ارفض طلبات الطلاب.")}</p>
          </div>
          <button type="button" className="admin-primary-btn" onClick={loadAll}>
            {tr("Refresh", "Actualiser", "تحديث")}
          </button>
        </header>

        {error ? <p style={{ margin: "0 0 12px", color: "#b91c1c", fontWeight: 700 }}>{error}</p> : null}

        <section className="admin-card admin-card--padded">
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>{tr("Student", "Etudiant", "الطالب")}</th>
                  <th>{t("acProfessor1")}</th>
                  <th>{t("acProfessor2")}</th>
                  <th>{t("acStatus")}</th>
                  <th>{t("acCreatedAt")}</th>
                  <th style={{ textAlign: "right" }}>{t("acActions")}</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} className="admin-empty">{t("smLoading")}</td></tr>
                ) : rows.length === 0 ? (
                  <tr><td colSpan={6} className="admin-empty">{tr("No requests.", "Aucune demande.", "لا توجد طلبات.")}</td></tr>
                ) : rows.map((r) => {
                  const decision = myDecision(r);
                  const canDecide = r.status === "pending" && decision === "pending";
                  return (
                    <tr key={r.id}>
                      <td style={{ fontWeight: 900 }}>{r.student_name || `#${r.student_id}`}</td>
                      <td>{r.professeur1_name || `#${r.professeur1_id}`}</td>
                      <td>{r.professeur2_name || `#${r.professeur2_id}`}</td>
                      <td><StatusPill status={r.status} t={t} /></td>
                      <td style={{ color: "#64748b", fontSize: 13 }}>{formatDate(r.created_at)}</td>
                      <td>
                        <div className="admin-actions">
                          <button
                            type="button"
                            className="admin-secondary-btn"
                            disabled={!canDecide || workingId === r.id}
                            onClick={() => decide(r.id, "accepted")}
                          >
                            {t("acAccept")}
                          </button>
                          <button
                            type="button"
                            className="admin-secondary-btn"
                            style={{ borderColor: "#ef4444", color: "#ef4444" }}
                            disabled={!canDecide || workingId === r.id}
                            onClick={() => decide(r.id, "rejected")}
                          >
                            {t("acReject")}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}

