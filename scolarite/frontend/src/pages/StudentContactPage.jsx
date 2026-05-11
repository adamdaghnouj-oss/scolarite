import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/axios";
import { useAuth } from "../auth/useAuth";
import { useLanguage } from "../i18n/LanguageContext";
import "./StudentContactPage.css";

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

export default function StudentContactPage() {
  const navigate = useNavigate();
  const auth = useAuth();
  const { t } = useLanguage();

  const [contacts, setContacts] = useState([]);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function loadContacts() {
    setLoading(true);
    setError("");
    try {
      const res = await api.get("/student-contacts");
      setContacts(Array.isArray(res.data) ? res.data : []);
    } catch {
      setContacts([]);
      setError("Failed to load your contact messages.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadContacts();
  }, []);

  const orderedContacts = useMemo(
    () => [...contacts].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [contacts]
  );

  async function handleLogout() {
    await auth.logout();
    navigate("/login");
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSuccess("");

    const nextSubject = subject.trim();
    const nextMessage = message.trim();
    if (!nextSubject || !nextMessage) {
      setError("Please fill subject and message.");
      return;
    }

    setSending(true);
    try {
      const res = await api.post("/student-contacts", {
        subject: nextSubject,
        message: nextMessage,
      });
      setContacts((prev) => [res.data, ...prev]);
      setSubject("");
      setMessage("");
      setSuccess("Message sent to administration successfully.");
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to send message.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="scp-wrap">
      <header className="scp-topnav">
        <div className="scp-topnav-inner">
          <div className="scp-brand">Scolarite</div>
          <nav className="scp-links">
            <Link to="/">{t("navHome")}</Link>
            <Link to="/student/posts">Post</Link>
            <Link to="/student/events">Events</Link>
            <Link to="/student/contact" className="is-active">Contact Admin</Link>
            <Link to="/profile">{t("profile")}</Link>
          </nav>
          <button type="button" className="scp-logout-btn" onClick={handleLogout}>
            {t("logout")}
          </button>
        </div>
      </header>

      <main className="scp-main">
        <section className="scp-card">
          <p className="scp-kicker">Student support</p>
          <h1>Contact the administrator</h1>
          <p className="scp-subtitle">
            Send your question or request. The administrator can read it and reply from the Student Contacts page.
          </p>

          <form className="scp-form" onSubmit={handleSubmit}>
            <label htmlFor="scp-subject">Subject</label>
            <input
              id="scp-subject"
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Ex: Problem with registration"
              maxLength={180}
              required
            />

            <label htmlFor="scp-message">Message</label>
            <textarea
              id="scp-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Write your message to administration..."
              maxLength={5000}
              rows={6}
              required
            />

            {error ? <p className="scp-error">{error}</p> : null}
            {success ? <p className="scp-success">{success}</p> : null}

            <div className="scp-actions">
              <button type="submit" className="scp-btn scp-btn-primary" disabled={sending}>
                {sending ? "Sending..." : "Send Message"}
              </button>
              <button
                type="button"
                className="scp-btn scp-btn-ghost"
                onClick={() => {
                  setSubject("");
                  setMessage("");
                  setError("");
                  setSuccess("");
                }}
              >
                Clear
              </button>
            </div>
          </form>
        </section>

        <section className="scp-card">
          <div className="scp-history-head">
            <h2>Your previous messages</h2>
            <button type="button" className="scp-btn scp-btn-ghost" onClick={loadContacts}>
              Refresh
            </button>
          </div>
          {loading ? (
            <p className="scp-empty">Loading messages...</p>
          ) : orderedContacts.length === 0 ? (
            <p className="scp-empty">You did not send any message yet.</p>
          ) : (
            <div className="scp-list">
              {orderedContacts.map((item) => (
                <article key={item.id} className="scp-item">
                  <div className="scp-item-head">
                    <h3>{item.subject}</h3>
                    <span className={`scp-badge ${item.status === "replied" ? "is-replied" : "is-pending"}`}>
                      {item.status === "replied" ? "Replied" : "Pending"}
                    </span>
                  </div>
                  <p className="scp-date">Sent: {formatDate(item.created_at)}</p>
                  <p className="scp-message">{item.message}</p>

                  {item.admin_reply ? (
                    <div className="scp-reply">
                      <strong>Administrator reply</strong>
                      <p>{item.admin_reply}</p>
                      <span>{item.replied_by?.name ? `By ${item.replied_by.name}` : ""} {item.replied_at ? `• ${formatDate(item.replied_at)}` : ""}</span>
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
