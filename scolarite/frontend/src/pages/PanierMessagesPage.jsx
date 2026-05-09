import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api/axios";
import { getStoredRole } from "../auth/auth";
import MessagingNavRail from "../components/MessagingNavRail";
import MessageImageLightbox from "../components/MessageImageLightbox";
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
  const [attachFile, setAttachFile] = useState(null);
  const [recording, setRecording] = useState(false);
  const [recordedAudioUrl, setRecordedAudioUrl] = useState("");
  const [recordedAudioBlob, setRecordedAudioBlob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [openMenuId, setOpenMenuId] = useState(null);
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editingBody, setEditingBody] = useState("");
  const [imageLightboxIndex, setImageLightboxIndex] = useState(null);
  const listEndRef = useRef(null);
  const fileRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedThreadId]);

  async function handleSend(e) {
    e.preventDefault();
    const trimmed = text.trim();
    if ((!trimmed && !attachFile) || !selectedThreadId) return;
    if (role !== "professeur") {
      setError("Only professor can send course messages.");
      return;
    }
    setSending(true);
    try {
      const fd = new FormData();
      fd.append("body", trimmed);
      if (attachFile) {
        if (String(attachFile.type || "").startsWith("image/")) fd.append("image", attachFile);
        else if (String(attachFile.type || "").startsWith("audio/")) fd.append("audio", attachFile);
        else if (String(attachFile.type || "").includes("pdf")) fd.append("pdf", attachFile);
      }
      const res = await api.post(`/messages/panier/threads/${selectedThreadId}`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setMessages((prev) => [...prev, res.data]);
      setText("");
      setAttachFile(null);
      await loadConversations(true);
      setError("");
    } catch (e2) {
      setError(e2?.response?.data?.message || "Send failed.");
    } finally {
      setSending(false);
    }
  }

  async function updateMessage(messageId) {
    const body = editingBody.trim();
    if (!body) return;
    try {
      const res = await api.put(`/messages/panier/messages/${messageId}`, { body });
      setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, ...res.data } : m)));
      setEditingMessageId(null);
      setEditingBody("");
      setOpenMenuId(null);
    } catch {
      setError("Update failed.");
    }
  }

  async function startRecording() {
    if (role !== "professeur") return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.start();
      setRecording(true);
    } catch {
      setError("Microphone access denied or not supported.");
    }
  }

  async function stopRecordingAndPrepare() {
    const recorder = mediaRecorderRef.current;
    if (!recorder) return;
    await new Promise((resolve) => {
      recorder.onstop = resolve;
      recorder.stop();
    });
    setRecording(false);
    const blob = new Blob(chunksRef.current, { type: "audio/webm" });
    if (blob.size > 0) {
      if (recordedAudioUrl) URL.revokeObjectURL(recordedAudioUrl);
      setRecordedAudioBlob(blob);
      setRecordedAudioUrl(URL.createObjectURL(blob));
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    mediaRecorderRef.current = null;
    chunksRef.current = [];
  }

  async function sendRecordedAudio() {
    if (role !== "professeur" || !recordedAudioBlob || !selectedThreadId) return;
    setSending(true);
    try {
      const fd = new FormData();
      fd.append("audio", recordedAudioBlob, `voice-${Date.now()}.webm`);
      const res = await api.post(`/messages/panier/threads/${selectedThreadId}`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setMessages((prev) => [...prev, res.data]);
      setRecordedAudioBlob(null);
      if (recordedAudioUrl) URL.revokeObjectURL(recordedAudioUrl);
      setRecordedAudioUrl("");
      await loadConversations(true);
      setError("");
    } catch (e2) {
      setError(e2?.response?.data?.message || "Voice send failed.");
    } finally {
      setSending(false);
    }
  }

  async function deleteMessage(messageId) {
    try {
      await api.delete(`/messages/panier/messages/${messageId}`);
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
      setOpenMenuId(null);
    } catch {
      setError("Delete failed.");
    }
  }

  const messageImageGallery = useMemo(
    () => messages.filter((m) => m?.image_url).map((m) => ({ id: m.id, url: m.image_url })),
    [messages]
  );

  function openMessageImageLightbox(messageId) {
    const i = messageImageGallery.findIndex((g) => g.id === messageId);
    if (i >= 0) setImageLightboxIndex(i);
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
                      {editingMessageId === m.id ? (
                        <div style={{ display: "grid", gap: 6 }}>
                          <input value={editingBody} onChange={(e) => setEditingBody(e.target.value)} />
                          <div style={{ display: "flex", gap: 6 }}>
                            <button type="button" className="sm-icon-btn sm-send" onClick={() => updateMessage(m.id)}>Save</button>
                            <button type="button" className="sm-icon-btn" onClick={() => setEditingMessageId(null)}>Cancel</button>
                          </div>
                        </div>
                      ) : m.body ? <p>{m.body}</p> : null}
                      {m.image_url ? (
                        <button
                          type="button"
                          className="sm-msg-image-btn"
                          onClick={() => openMessageImageLightbox(m.id)}
                          aria-label={t("smPhoto")}
                        >
                          <img src={m.image_url} alt="" className="sm-msg-image-thumb" />
                        </button>
                      ) : null}
                      {m.audio_url ? <audio controls src={m.audio_url} className="sm-audio" /> : null}
                      {m.pdf_url ? <a href={m.pdf_url} target="_blank" rel="noreferrer">PDF</a> : null}
                      {mine ? (
                        <div className="sm-msg-menu-wrap">
                          <button type="button" className="sm-msg-menu-btn" onClick={() => setOpenMenuId((p) => (p === m.id ? null : m.id))}>⋯</button>
                          {openMenuId === m.id ? (
                            <div className="sm-msg-menu">
                              <button type="button" onClick={() => { setEditingMessageId(m.id); setEditingBody(m.body || ""); }}>Modify</button>
                              <button type="button" onClick={() => deleteMessage(m.id)}>Delete</button>
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })}
              <div ref={listEndRef} />
            </div>
            <form className="sm-input" onSubmit={handleSend}>
              {recordedAudioUrl ? (
                <div className="sm-audio-preview">
                  <audio controls src={recordedAudioUrl} className="sm-audio" />
                  <button type="button" className="sm-icon-btn sm-send" onClick={sendRecordedAudio} disabled={sending || role !== "professeur"}>✓</button>
                  <button type="button" className="sm-icon-btn" onClick={() => { if (recordedAudioUrl) URL.revokeObjectURL(recordedAudioUrl); setRecordedAudioUrl(""); setRecordedAudioBlob(null); }}>✕</button>
                </div>
              ) : null}
              <button type="button" className="sm-icon-btn" onClick={() => fileRef.current?.click()} disabled={role !== "professeur"}>📎</button>
              <button
                type="button"
                className={`sm-icon-btn ${recording ? "is-recording" : ""}`}
                onClick={() => (recording ? stopRecordingAndPrepare() : startRecording())}
                disabled={role !== "professeur"}
              >
                {recording ? "■" : "🎙"}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*,audio/*,.pdf"
                style={{ display: "none" }}
                onChange={(e) => setAttachFile(e.target.files?.[0] || null)}
              />
              <input value={text} onChange={(e) => setText(e.target.value)} placeholder={role === "professeur" ? t("smTypeMessage") : "Only professor can send messages"} disabled={role !== "professeur"} />
              {attachFile ? <span className="sm-item-last" style={{ alignSelf: "center" }}>{attachFile.name}</span> : null}
              <button type="submit" className="sm-send" disabled={sending || role !== "professeur"}>{sending ? "..." : t("smSend")}</button>
            </form>
          </>
        )}
      </section>
      <MessageImageLightbox
        images={messageImageGallery}
        activeIndex={imageLightboxIndex}
        onClose={() => setImageLightboxIndex(null)}
        onChangeIndex={setImageLightboxIndex}
        labels={{
          close: t("smImgClose"),
          prev: t("smImgPrev"),
          next: t("smImgNext"),
          download: t("smImgDownload"),
          dialog: t("smImgViewer"),
        }}
      />
    </div>
  );
}
