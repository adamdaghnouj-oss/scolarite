import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api/axios";
import { getStoredRole } from "../auth/auth";
import MessagingNavRail from "../components/MessagingNavRail";
import { useLanguage } from "../i18n/LanguageContext";
import "./StudentMessagesPage.css";

export default function PanierMessagesPage() {
  const { t } = useLanguage();
  const role = getStoredRole();
  const [conversations, setConversations] = useState([]);
  const [selectedThreadId, setSelectedThreadId] = useState(null);
  const [threadMeta, setThreadMeta] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const listEndRef = useRef(null);
  const myUserId = useMemo(() => {
    try {
      const raw = localStorage.getItem("user");
      const u = raw ? JSON.parse(raw) : null;
      return u?.id ?? null;
    } catch {
      return null;
    }
  }, []);

  async function loadConversations(silent = false) {
    if (!silent) setLoading(true);
    setError("");
    try {
      const res = await api.get("/messages/panier/conversations");
      const list = Array.isArray(res.data) ? res.data : [];
      setConversations(list);
      if (!selectedThreadId && list[0]?.thread_id) {
        setSelectedThreadId(list[0].thread_id);
      }
    } catch {
      setError(t("pmPanierLoadError"));
      setConversations([]);
    } finally {
      if (!silent) setLoading(false);
    }
  }

  async function loadThread(threadId) {
    if (!threadId) return;
    try {
      const res = await api.get(`/messages/panier/threads/${threadId}`);
      setThreadMeta(res.data?.thread || null);
      setMessages(Array.isArray(res.data?.messages) ? res.data.messages : []);
      setTimeout(() => listEndRef.current?.scrollIntoView({ behavior: "smooth" }), 0);
    } catch {
      setMessages([]);
      setThreadMeta(null);
    }
  }

  useEffect(() => {
    loadConversations();
  }, []);

  useEffect(() => {
    document.body.classList.add("sm-page-active");
    return () => document.body.classList.remove("sm-page-active");
  }, []);

  useEffect(() => {
    if (selectedThreadId) loadThread(selectedThreadId);
  }, [selectedThreadId]);

  useEffect(() => {
    const id = setInterval(() => {
      loadConversations(true);
      if (selectedThreadId) loadThread(selectedThreadId);
    }, 5000);
    return () => clearInterval(id);
  }, [selectedThreadId]);

  async function handleSend(e) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || !selectedThreadId) return;
    setSending(true);
    try {
      const fd = new FormData();
      fd.append("body", trimmed);
      const res = await api.post(`/messages/panier/threads/${selectedThreadId}`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setMessages((prev) => [...prev, res.data]);
      setText("");
      await loadConversations(true);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="sm-page">
      <MessagingNavRail />
      <aside className="sm-left">
        <div className="sm-head sm-head--minimal">
          <div className="sm-convo-title">
            {role === "professeur" ? `${t("professorRole")} · ` : ""}
            {t("pmPanierColumnTitle")}
          </div>
        </div>
        {error ? <div className="sm-error">{error}</div> : null}
        <div className="sm-list">
          {loading && <p className="sm-empty">{t("smLoading")}</p>}
          {!loading && conversations.length === 0 && (
            <p className="sm-empty">{t("pmPanierEmpty")}</p>
          )}
          {conversations.map((c) => (
            <button
              type="button"
              key={c.thread_id}
              className={`sm-item ${selectedThreadId === c.thread_id ? "is-active" : ""}`}
              onClick={() => setSelectedThreadId(c.thread_id)}
            >
              <div className="sm-avatar sm-avatar--class">P</div>
              <div className="sm-item-meta">
                <div className="sm-item-name">{c.title}</div>
                <div className="sm-item-last">{c.class_name} · {c.annee_scolaire}</div>
              </div>
              {c.unread_count > 0 ? <span className="sm-unread-dot">{c.unread_count}</span> : null}
            </button>
          ))}
        </div>
      </aside>

      <section className={`sm-chat ${!threadMeta ? "sm-chat--empty" : ""}`}>
        {!threadMeta ? (
          <div className="sm-placeholder">
            <div className="sm-placeholder-icon">💬</div>
            <h2>{t("pmPanierPlaceholderTitle")}</h2>
            <p>{t("pmPanierPlaceholderHint")}</p>
          </div>
        ) : (
          <>
            <header className="sm-chat-head">
              <div className="sm-chat-user">
                <div className="sm-avatar sm-avatar--lg">P</div>
                <div>
                  <div className="sm-chat-name">{threadMeta.title}</div>
                  <div className="sm-chat-sub">{threadMeta.class_name} — {threadMeta.annee_scolaire}</div>
                </div>
              </div>
            </header>
            <div className="sm-messages">
              {messages.map((m) => {
                const mine = String(m.sender_user_id) === String(myUserId);
                return (
                  <div key={m.id} className={`sm-bubble-row ${mine ? "is-mine" : ""}`}>
                    {!mine ? (
                      <div className="sm-msg-sender-avatar">
                        {m.sender_profile_picture_url
                          ? <img src={m.sender_profile_picture_url} alt={m.sender_name || ""} />
                          : (m.sender_name || "U").slice(0, 1).toUpperCase()}
                      </div>
                    ) : null}
                    <div className={`sm-bubble ${mine ? "is-mine" : ""}`}>
                      {!mine ? <div className="sm-sender-name">{m.sender_name}</div> : null}
                      {m.body ? <p>{m.body}</p> : null}
                      {m.image_url ? <img src={m.image_url} alt="message" /> : null}
                    </div>
                  </div>
                );
              })}
              <div ref={listEndRef} />
            </div>
            <form className="sm-input" onSubmit={handleSend}>
              <input value={text} onChange={(e) => setText(e.target.value)} placeholder={t("smTypeMessage")} />
              <button type="submit" className="sm-send" disabled={sending}>{sending ? "..." : t("smSend")}</button>
            </form>
          </>
        )}
      </section>
    </div>
  );
}
