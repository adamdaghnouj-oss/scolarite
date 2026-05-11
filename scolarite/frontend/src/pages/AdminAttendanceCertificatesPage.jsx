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

async function openPdfBlob(blob, filename = "certificate.pdf") {
  const url = URL.createObjectURL(blob);
  const win = window.open(url, "_blank", "noopener,noreferrer");
  if (!win) {
    // fallback: download
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
    return;
  }
  // give the tab time to load before revoking
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

export default function AdminAttendanceCertificatesPage() {
  const { t, language } = useLanguage();
  const tr = (en, fr, ar) => (language === "fr" ? fr : language === "ar" ? ar : en);

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [workingId, setWorkingId] = useState(null);

  async function loadAll() {
    setLoading(true);
    setError("");
    try {
      const res = await api.get("/admin/attendance-certificates");
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
  }, []);

  const acceptedRows = useMemo(() => rows.filter((r) => r.status === "accepted").length, [rows]);
  const pendingRows = useMemo(() => rows.filter((r) => r.status === "pending").length, [rows]);
  const rejectedRows = useMemo(() => rows.filter((r) => r.status === "rejected").length, [rows]);

  async function downloadPdf(requestId, lang) {
    setWorkingId(requestId);
    setError("");
    try {
      const res = await api.get(`/admin/attendance-certificates/${requestId}/pdf`, {
        responseType: "blob",
        params: lang ? { lang } : undefined,
      });
      await openPdfBlob(res.data, `attendance_certificate_${requestId}.pdf`);
    } catch (err) {
      setError(err?.response?.data?.message || tr("Failed to generate PDF.", "Echec de generation du PDF.", "فشل إنشاء ملف PDF."));
    } finally {
      setWorkingId(null);
    }
  }

  return (
    <div className="admin-wrap">
      <StaffSidebar variant="admin" />

      <main className="admin-main">
        <header className="admin-topbar">
          <div>
            <h1 className="admin-title">{t("menuAttendanceCert")}</h1>
            <p className="admin-subtitle">{tr("Generate PDFs for accepted requests.", "Generer des PDFs pour les demandes acceptees.", "إنشاء ملفات PDF للطلبات المقبولة.")}</p>
          </div>
          <button type="button" className="admin-primary-btn" onClick={loadAll}>
            {tr("Refresh", "Actualiser", "تحديث")}
          </button>
        </header>

        <div className="admin-stats">
          <div className="admin-stat-card">
            <div className="admin-stat-label">{t("acAccepted")}</div>
            <div className="admin-stat-value">{acceptedRows}</div>
          </div>
          <div className="admin-stat-card">
            <div className="admin-stat-label">{t("acPending")}</div>
            <div className="admin-stat-value">{pendingRows}</div>
          </div>
          <div className="admin-stat-card">
            <div className="admin-stat-label">{t("acRejected")}</div>
            <div className="admin-stat-value">{rejectedRows}</div>
          </div>
          <div className="admin-stat-card">
            <div className="admin-stat-label">Total</div>
            <div className="admin-stat-value">{rows.length}</div>
          </div>
        </div>

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
                  <th>{tr("Accepted by", "Acceptee par", "قُبلت من")}</th>
                  <th>{t("acCreatedAt")}</th>
                  <th style={{ textAlign: "right" }}>{t("acActions")}</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} className="admin-empty">{t("smLoading")}</td></tr>
                ) : rows.length === 0 ? (
                  <tr><td colSpan={7} className="admin-empty">{tr("No requests.", "Aucune demande.", "لا توجد طلبات.")}</td></tr>
                ) : rows.map((r) => (
                  <tr key={r.id}>
                    <td style={{ fontWeight: 900 }}>{r.student_name || `#${r.student_id}`}</td>
                    <td>{r.professeur1_name || `#${r.professeur1_id}`}</td>
                    <td>{r.professeur2_name || `#${r.professeur2_id}`}</td>
                    <td><StatusPill status={r.status} t={t} /></td>
                    <td style={{ color: "#334155", fontWeight: 800 }}>
                      {r.accepted_by_professeur_name || (r.status === "accepted" ? `#${r.accepted_by_professeur_id}` : "—")}
                    </td>
                    <td style={{ color: "#64748b", fontSize: 13 }}>{formatDate(r.created_at)}</td>
                    <td>
                      <div className="admin-actions">
                        <button
                          type="button"
                          className="admin-secondary-btn"
                          disabled={r.status !== "accepted" || workingId === r.id}
                          onClick={() => downloadPdf(r.id, r.language)}
                        >
                          {t("acDownloadPdf")}
                        </button>
                        <button
                          type="button"
                          className="admin-secondary-btn"
                          disabled={r.status !== "accepted" || workingId === r.id}
                          onClick={() => downloadPdf(r.id, r.language)}
                        >
                          {t("acPrint")}
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

