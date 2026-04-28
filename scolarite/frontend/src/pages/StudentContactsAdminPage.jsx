import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/axios";
import { clearAuth } from "../auth/auth";
import { useLanguage } from "../i18n/LanguageContext";
import "./AdminPanel.css";

function formatDate(isoValue) {
  if (!isoValue) return "N/A";
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(isoValue));
  } catch {
    return "N/A";
  }
}

export default function StudentContactsAdminPage() {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const tr = (en, fr) => (language === "fr" ? fr : en);

  const [contacts, setContacts] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [replyText, setReplyText] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function loadContacts() {
    setLoading(true);
    setError("");
    try {
      const res = await api.get("/admin/student-contacts");
      const list = Array.isArray(res.data) ? res.data : [];
      setContacts(list);
      if (list.length > 0 && selectedId == null) setSelectedId(list[0].id);
    } catch {
      setContacts([]);
      setError(tr("Failed to load student contacts.", "Echec du chargement des contacts etudiants."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadContacts();
  }, []);

  const sortedContacts = useMemo(
    () => [...contacts].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [contacts]
  );
  const selectedContact = sortedContacts.find((item) => item.id === selectedId) || null;

  useEffect(() => {
    setReplyText(selectedContact?.admin_reply || "");
  }, [selectedId, selectedContact?.admin_reply]);

  async function handleReplySubmit(e) {
    e.preventDefault();
    if (!selectedContact) return;
    const reply = replyText.trim();
    if (!reply) {
      setError(tr("Please enter a reply.", "Veuillez saisir une reponse."));
      return;
    }

    setSaving(true);
    setError("");
    try {
      const res = await api.post(`/admin/student-contacts/${selectedContact.id}/reply`, { reply });
      const updated = res.data;
      setContacts((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      setReplyText(updated.admin_reply || "");
    } catch (err) {
      setError(err?.response?.data?.message || tr("Failed to save reply.", "Echec de l'enregistrement de la reponse."));
    } finally {
      setSaving(false);
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
            <div className="admin-brand-subtitle">Administration</div>
          </div>
        </div>
        <nav className="admin-nav">
          <Link className="admin-nav-item" to="/">{tr("Home", "Accueil")}</Link>
          <Link className="admin-nav-item" to="/admin">{tr("User management", "Gestion des utilisateurs")}</Link>
          <Link className="admin-nav-item" to="/classes">{tr("Classes", "Classes")}</Link>
          <Link className="admin-nav-item" to="/admin/prof-assignments">{tr("Prof. - modules", "Profs / modules")}</Link>
          <Link className="admin-nav-item" to="/accounts">{tr("Accounts", "Comptes")}</Link>
          <Link className="admin-nav-item admin-nav-item--active" to="/admin/student-contacts">{tr("Student contacts", "Contacts etudiants")}</Link>
          <Link className="admin-nav-item" to="/change-password">{tr("Change password", "Changer le mot de passe")}</Link>
        </nav>
        <div className="admin-sidebar-footer">
          <button type="button" className="admin-secondary-btn" style={{ width: "100%" }} onClick={handleLogout}>
            {tr("Logout", "Deconnexion")}
          </button>
        </div>
      </aside>

      <main className="admin-main">
        <header className="admin-topbar">
          <div>
            <h1 className="admin-title">{tr("Student Contacts", "Contacts etudiants")}</h1>
            <p className="admin-subtitle">{tr("Read and reply to student messages", "Lire et repondre aux messages des etudiants")}</p>
          </div>
          <button type="button" className="admin-primary-btn" onClick={loadContacts}>
            {tr("Refresh", "Actualiser")}
          </button>
        </header>

        <div className="sca-layout">
          <section className="admin-card sca-list-card">
            {loading ? (
              <p className="sca-empty-text">{tr("Loading...", "Chargement...")}</p>
            ) : sortedContacts.length === 0 ? (
              <p className="sca-empty-text">{tr("No contact messages yet.", "Aucun message de contact pour le moment.")}</p>
            ) : (
              sortedContacts.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedId(item.id)}
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    textAlign: "left",
                    border: "1px solid #e5e7eb",
                    borderRadius: 10,
                    marginBottom: 10,
                    padding: 10,
                    background: selectedId === item.id ? "#eff6ff" : "#fff",
                    cursor: "pointer",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                    <strong style={{ color: "#0f172a" }}>{item.student?.name || "Student"}</strong>
                    <span style={{
                      fontSize: 11,
                      fontWeight: 700,
                      borderRadius: 999,
                      padding: "2px 8px",
                      background: item.status === "replied" ? "#dcfce7" : "#ffedd5",
                      color: item.status === "replied" ? "#166534" : "#9a3412",
                    }}
                    >
                      {item.status === "replied" ? tr("Replied", "Repondu") : tr("Pending", "En attente")}
                    </span>
                  </div>
                  <p style={{ margin: "6px 0 0", color: "#1e293b", fontWeight: 600, overflowWrap: "anywhere", wordBreak: "break-word" }}>
                    {item.subject}
                  </p>
                  <p style={{ margin: "4px 0 0", color: "#64748b", fontSize: 12 }}>{formatDate(item.created_at)}</p>
                </button>
              ))
            )}
          </section>

          <section className="admin-card sca-detail-card">
            {!selectedContact ? (
              <p className="sca-empty-text">{tr("Select a student message to view details.", "Selectionnez un message etudiant pour voir les details.")}</p>
            ) : (
              <>
                <h2 style={{ marginTop: 0, color: "#0f172a", overflowWrap: "anywhere", wordBreak: "break-word" }}>{selectedContact.subject}</h2>
                <p style={{ margin: "8px 0", color: "#334155", overflowWrap: "anywhere", wordBreak: "break-word" }}>
                  <strong>{tr("Student", "Etudiant")}:</strong> {selectedContact.student?.name || "Student"} ({selectedContact.student?.email || "N/A"})
                </p>
                <p style={{ margin: "8px 0", color: "#64748b" }}>
                  <strong>{tr("Sent at", "Envoye le")}:</strong> {formatDate(selectedContact.created_at)}
                </p>

                <div style={{ marginTop: 12, border: "1px solid #e2e8f0", borderRadius: 10, padding: 12, background: "#f8fafc" }}>
                  <strong style={{ color: "#0f172a" }}>{tr("Message", "Message")}</strong>
                  <p style={{ margin: "8px 0 0", whiteSpace: "pre-wrap", color: "#334155", overflowWrap: "anywhere", wordBreak: "break-word" }}>
                    {selectedContact.message}
                  </p>
                </div>

                <form onSubmit={handleReplySubmit} style={{ marginTop: 16 }}>
                  <label htmlFor="reply" style={{ display: "block", marginBottom: 6, color: "#334155", fontWeight: 700 }}>
                    {tr("Administrator reply", "Reponse administrateur")}
                  </label>
                  <textarea
                    id="reply"
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    rows={8}
                    maxLength={5000}
                    style={{
                      width: "100%",
                      boxSizing: "border-box",
                      border: "1px solid #cbd5e1",
                      borderRadius: 10,
                      padding: 10,
                      fontFamily: "inherit",
                      fontSize: 14,
                      resize: "vertical",
                    }}
                    placeholder={tr("Write your reply to the student...", "Saisissez votre reponse a l'etudiant...")}
                  />
                  {selectedContact.replied_at ? (
                    <p style={{ margin: "8px 0 0", color: "#64748b", fontSize: 13 }}>
                      {tr("Last reply", "Derniere reponse")}: {formatDate(selectedContact.replied_at)}
                    </p>
                  ) : null}
                  {error ? <p style={{ margin: "8px 0 0", color: "#b91c1c" }}>{error}</p> : null}
                  <div style={{ marginTop: 12 }}>
                    <button type="submit" className="admin-primary-btn" disabled={saving}>
                      {saving ? tr("Saving...", "Enregistrement...") : tr("Send reply", "Envoyer la reponse")}
                    </button>
                  </div>
                </form>
              </>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
