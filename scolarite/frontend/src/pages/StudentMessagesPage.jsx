import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api/axios";
import MessagingNavRail from "../components/MessagingNavRail";
import MessageImageLightbox from "../components/MessageImageLightbox";
import { useLanguage } from "../i18n/LanguageContext";
import "./StudentMessagesPage.css";

function VoiceMessageCard({ src, mine = false }) {
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);

  const bars = useMemo(
    () => Array.from({ length: 24 }, (_, i) => 10 + Math.round((Math.sin((i + 1) * 0.72) + 1) * 14)),
    []
  );

  function fmt(seconds) {
    const total = Math.max(0, Math.round(Number(seconds) || 0));
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  }

  function togglePlay() {
    const el = audioRef.current;
    if (!el) return;
    if (el.paused) {
      el.play().then(() => setIsPlaying(true)).catch(() => {});
    } else {
      el.pause();
      setIsPlaying(false);
    }
  }

  return (
    <div className={`sm-voice ${mine ? "is-mine" : ""}`}>
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
        onEnded={() => setIsPlaying(false)}
        style={{ display: "none" }}
      />
      <button type="button" className="sm-voice-play" onClick={togglePlay} aria-label={isPlaying ? "Pause voice" : "Play voice"}>
        {isPlaying ? "❚❚" : "▶"}
      </button>
      <div className="sm-voice-wave" aria-hidden="true">
        {bars.map((h, i) => (
          <span key={`bar-${i}`} style={{ height: `${h}px` }} />
        ))}
      </div>
      <span className="sm-voice-time">{fmt(duration)}</span>
      <span className="sm-voice-transcript">View transcription</span>
    </div>
  );
}

export default function StudentMessagesPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { t } = useLanguage();
  const requestedClassTab = searchParams.get("tab") === "class";
  const safeUser = (() => {
    try {
      const raw = localStorage.getItem("user");
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  })();
  const [conversations, setConversations] = useState([]);
  const [selected, setSelected] = useState(null);
  const [selectedType, setSelectedType] = useState(requestedClassTab ? "class" : "friend");
  const [classConversation, setClassConversation] = useState(null);
  const [classMembers, setClassMembers] = useState([]);
  const [classMembersOpen, setClassMembersOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordedAudioUrl, setRecordedAudioUrl] = useState("");
  const [recordedAudioBlob, setRecordedAudioBlob] = useState(null);
  const [query, setQuery] = useState("");
  const [myStudentId, setMyStudentId] = useState(null);
  const [pageError, setPageError] = useState("");
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editingBody, setEditingBody] = useState("");
  const [openMenuId, setOpenMenuId] = useState(null);
  const [imageLightboxIndex, setImageLightboxIndex] = useState(null);
  const requestedFriendId = searchParams.get("friend");
  const fileRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const listEndRef = useRef(null);
  const messagesRef = useRef(null);
  const stickToBottomRef = useRef(true);

  function scrollToBottom(force = false) {
    if (!messagesRef.current) return;
    if (!force && !stickToBottomRef.current) return;
    listEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }

  async function loadConversations(silent = false) {
    if (!silent) setLoading(true);
    try {
      const res = await api.get("/messages/conversations");
      const list = Array.isArray(res.data) ? res.data : [];
      setConversations(list);
      if (requestedFriendId && !requestedClassTab) {
        const matched = list.find((c) => String(c?.friend?.id) === String(requestedFriendId));
        if (matched?.friend?.id && String(selected?.id) !== String(matched.friend.id)) {
          setSelected(matched.friend);
        }
      }
      if (pageError) setPageError("");
    } catch {
      if (!silent) setPageError("Failed to load conversations.");
    } finally {
      if (!silent) setLoading(false);
    }
  }

  async function loadClassConversation(silent = false) {
    try {
      const res = await api.get("/messages/class/conversation");
      setClassConversation(res.data?.conversation || null);
      if (selectedType === "class" && !res.data?.conversation && !silent) {
        setPageError("You are not assigned to a class.");
      }
    } catch {
      if (!silent) setPageError("Failed to load class conversation.");
      setClassConversation(null);
    }
  }

  async function loadThread(friendId) {
    try {
      const res = await api.get(`/messages/threads/${friendId}`);
      const list = Array.isArray(res.data?.messages) ? res.data.messages : [];
      setMessages(list);
      setTimeout(() => scrollToBottom(false), 0);
      if (pageError) setPageError("");
    } catch {
      setPageError("Failed to load messages.");
    }
  }

  async function loadClassThread() {
    try {
      const res = await api.get("/messages/class/thread");
      const list = Array.isArray(res.data?.messages) ? res.data.messages : [];
      setMessages(list);
      setClassConversation((prev) => ({
        ...(prev || {}),
        ...(res.data?.class || {}),
        id: res.data?.class?.id ?? prev?.id,
        name: res.data?.class?.name ?? prev?.name ?? "Class group",
        students_count: res.data?.class?.students_count ?? prev?.students_count ?? 0,
      }));
      setTimeout(() => scrollToBottom(false), 0);
      if (pageError) setPageError("");
    } catch {
      setPageError("Failed to load class messages.");
    }
  }

  async function loadClassMembers() {
    try {
      const res = await api.get("/messages/class/members");
      setClassMembers(Array.isArray(res.data?.members) ? res.data.members : []);
    } catch {
      setClassMembers([]);
    }
  }

  useEffect(() => {
    if (requestedClassTab) {
      setSelectedType("class");
      setSelected(null);
    }
  }, [requestedClassTab]);

  useEffect(() => {
    loadConversations();
    loadClassConversation();
    loadClassMembers();
    api.get("/student/profile").then((res) => {
      setMyStudentId(res.data?.student?.id ?? null);
    }).catch(() => {
      setMyStudentId(null);
    });
  }, []);

  useEffect(() => {
    document.body.classList.add("sm-page-active");
    return () => document.body.classList.remove("sm-page-active");
  }, []);

  useEffect(() => {
    if (selectedType === "class") {
      loadClassThread();
      return;
    }
    if (!selected?.id) return;
    loadThread(selected.id);
  }, [selected?.id, selectedType]);

  useEffect(() => {
    const id = setInterval(() => {
      if (selectedType === "class") {
        loadClassThread();
      } else if (selected?.id) {
        loadThread(selected.id);
      }
      loadConversations(true);
      loadClassConversation(true);
      if (selectedType === "class") loadClassMembers();
    }, 4000);
    return () => clearInterval(id);
  }, [selected?.id, selectedType]);

  useEffect(() => {
    scrollToBottom(false);
  }, [messages]);

  async function sendMessage({ file = null } = {}) {
    if (selectedType !== "class" && !selected?.id) return;
    const trimmed = text.trim();
    if (!trimmed && !file) return;
    setSending(true);
    try {
      const fd = new FormData();
      if (trimmed) fd.append("body", trimmed);
      if (file) {
        if (String(file.type || "").startsWith("image/")) fd.append("image", file);
        else if (String(file.type || "").includes("pdf")) fd.append("pdf", file);
      }
      const url = selectedType === "class"
        ? "/messages/class/thread"
        : `/messages/threads/${selected.id}`;
      const res = await api.post(url, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setMessages((prev) => [...prev, res.data]);
      setText("");
      stickToBottomRef.current = true;
      setTimeout(() => scrollToBottom(true), 0);
      await loadConversations();
      await loadClassConversation(true);
    } finally {
      setSending(false);
    }
  }

  async function updateMessage(messageId) {
    const body = editingBody.trim();
    if (!body) return;
    const url = selectedType === "class"
      ? `/messages/class/messages/${messageId}`
      : `/messages/threads/messages/${messageId}`;
    try {
      const res = await api.put(url, { body });
      setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, ...res.data } : m)));
      setEditingMessageId(null);
      setEditingBody("");
      setOpenMenuId(null);
    } catch {
      setPageError("Failed to update message.");
    }
  }

  async function deleteMessage(messageId) {
    const url = selectedType === "class"
      ? `/messages/class/messages/${messageId}`
      : `/messages/threads/messages/${messageId}`;
    try {
      await api.delete(url);
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
      setOpenMenuId(null);
    } catch {
      setPageError("Failed to delete message.");
    }
  }

  async function startRecording() {
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
      // Permission denied or unsupported
      alert("Microphone access denied or not supported.");
    }
  }

  async function stopRecordingAndSend() {
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
    if ((!selected?.id && selectedType !== "class") || !recordedAudioBlob) return;
    setSending(true);
    try {
      const fd = new FormData();
      fd.append("audio", recordedAudioBlob, `voice-${Date.now()}.webm`);
      const url = selectedType === "class"
        ? "/messages/class/thread"
        : `/messages/threads/${selected.id}`;
      const res = await api.post(url, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setMessages((prev) => [...prev, res.data]);
      stickToBottomRef.current = true;
      setTimeout(() => scrollToBottom(true), 0);
      await loadConversations();
      await loadClassConversation(true);
      clearRecordedAudio();
    } finally {
      setSending(false);
    }
  }

  function openStudentProfile(studentId) {
    if (!studentId) return;
    if (String(studentId) === String(myStudentId || "")) {
      navigate("/profile");
      return;
    }
    navigate(`/student/friends/${studentId}`);
  }

  function clearRecordedAudio() {
    if (recordedAudioUrl) URL.revokeObjectURL(recordedAudioUrl);
    setRecordedAudioUrl("");
    setRecordedAudioBlob(null);
  }

  useEffect(() => () => {
    if (recordedAudioUrl) URL.revokeObjectURL(recordedAudioUrl);
  }, [recordedAudioUrl]);

  const filteredConversations = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter((c) => (c.friend?.name || "").toLowerCase().includes(q));
  }, [conversations, query]);
  const safeConversations = Array.isArray(filteredConversations)
    ? filteredConversations.filter((item) => item && item.friend && item.friend.id)
    : [];
  const safeMessages = Array.isArray(messages) ? messages.filter((m) => m && typeof m === "object") : [];

  const messageImageGallery = useMemo(() => {
    const safe = Array.isArray(messages) ? messages.filter((m) => m && typeof m === "object") : [];
    return safe.filter((m) => m.image_url).map((m) => ({ id: m.id, url: m.image_url }));
  }, [messages]);

  function openMessageImageLightbox(messageId) {
    const i = messageImageGallery.findIndex((g) => g.id === messageId);
    if (i >= 0) setImageLightboxIndex(i);
  }

  return (
    <div className="sm-page">
      <MessagingNavRail
        classTabActive={selectedType === "class"}
        onClassClick={() => { setSelectedType("class"); setSelected(null); }}
      />
      <aside className="sm-left">
        <div className="sm-head sm-head--minimal">
          <div className="sm-convo-title">{safeUser?.name || t("menuMessaging")}</div>
        </div>
        <div className="sm-search">
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("smSearch")} />
        </div>
        {pageError ? <div className="sm-error">{pageError}</div> : null}
        <div className="sm-list">
          {classConversation ? (
            <button
              type="button"
              className={`sm-item ${selectedType === "class" ? "is-active" : ""}`}
              onClick={() => { setSelectedType("class"); setSelected(null); }}
            >
              <div className="sm-avatar sm-avatar--class">C</div>
              <div className="sm-item-meta">
                <div className="sm-item-name">{classConversation.name || "Class group"}</div>
                <div className="sm-item-last">
                  {classConversation.last_message?.body
                    || (classConversation.last_message?.image_url ? t("smPhoto")
                      : (classConversation.last_message?.audio_url ? t("smVoice") : "Group chat"))}
                </div>
              </div>
              {classConversation.unread_count > 0 ? <span className="sm-unread-dot">{classConversation.unread_count}</span> : null}
            </button>
          ) : null}
          {loading && <p className="sm-empty">{t("smLoading")}</p>}
          {!loading && safeConversations.length === 0 && <p className="sm-empty">{t("smNoConversations")}</p>}
          {safeConversations.map((item) => {
            const f = item.friend;
            const active = selectedType === "friend" && selected?.id === f?.id;
            return (
              <button type="button" key={f.id} className={`sm-item ${active ? "is-active" : ""}`} onClick={() => { setSelectedType("friend"); setSelected(f); }}>
                <div className="sm-avatar">
                  {f.profile_picture_url ? <img src={f.profile_picture_url} alt={f.name || ""} /> : (f.name || "S").slice(0, 1).toUpperCase()}
                </div>
                <div className="sm-item-meta">
                  <div className="sm-item-name">{f.name}</div>
                  <div className="sm-item-last">
                    {item.last_message?.body
                      || (item.last_message?.image_url ? t("smPhoto")
                        : (item.last_message?.audio_url ? t("smVoice") : t("smSayHi")))}
                  </div>
                </div>
                {item.unread_count > 0 ? <span className="sm-unread-dot">{item.unread_count}</span> : null}
              </button>
            );
          })}
        </div>
      </aside>

      <section className={`sm-chat ${selectedType === "friend" && !selected?.id ? "sm-chat--empty" : ""}`}>
        {selectedType === "friend" && !selected?.id ? (
          <div className="sm-placeholder">
            <div className="sm-placeholder-icon">✈</div>
            <h2>{t("smYourMessages")}</h2>
            <p>{t("smChooseConversation")}</p>
          </div>
        ) : (
          <>
            <header className="sm-chat-head">
              <button
                type="button"
                className="sm-chat-user is-clickable"
                onClick={() => {
                  if (selectedType === "class") {
                    setClassMembersOpen(true);
                    loadClassMembers();
                    return;
                  }
                  openStudentProfile(selected?.id);
                }}
              >
                <div className="sm-avatar sm-avatar--lg">
                  {selectedType === "class"
                    ? "C"
                    : (selected.profile_picture_url ? <img src={selected.profile_picture_url} alt={selected.name || ""} /> : (selected.name || "S").slice(0, 1).toUpperCase())}
                </div>
                <div>
                  <div className="sm-chat-name">{selectedType === "class" ? (classConversation?.name || "Class group") : selected.name}</div>
                  <div className="sm-chat-sub">
                    {selectedType === "class"
                      ? `${Number(classConversation?.students_count || 0)} students`
                      : selected.email}
                  </div>
                </div>
              </button>
            </header>
            <div
              className="sm-messages"
              ref={messagesRef}
              onScroll={(e) => {
                const el = e.currentTarget;
                const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
                stickToBottomRef.current = distanceFromBottom < 64;
              }}
            >
              {safeMessages.map((m) => {
                const mine = String(m.sender_student_id) === String(myStudentId);
                const senderName = selectedType === "class"
                  ? (m.sender_name || "Student")
                  : (selected?.name || "Student");
                const senderAvatarUrl = selectedType === "class"
                  ? (m.sender_profile_picture_url || "")
                  : (selected?.profile_picture_url || "");
                return (
                  <div key={m.id} className={`sm-bubble-row ${mine ? "is-mine" : ""}`}>
                    {!mine ? (
                      <button type="button" className="sm-msg-sender-avatar" title={senderName} onClick={() => openStudentProfile(m.sender_student_id)}>
                        {senderAvatarUrl
                          ? <img src={senderAvatarUrl} alt={senderName} />
                          : senderName.slice(0, 1).toUpperCase()}
                      </button>
                    ) : null}
                    <div className={`sm-bubble ${mine ? "is-mine" : ""}`}>
                      {selectedType === "class" && !mine ? (
                        <button type="button" className="sm-sender-name-btn" onClick={() => openStudentProfile(m.sender_student_id)}>
                          {m.sender_name || "Student"}
                        </button>
                      ) : null}
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
                      {m.audio_url ? (
                        <VoiceMessageCard src={m.audio_url} mine={mine} />
                      ) : null}
                      {m.pdf_url ? (
                        <a href={m.pdf_url} target="_blank" rel="noreferrer">
                          PDF
                        </a>
                      ) : null}
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
            <form className="sm-input" onSubmit={(e) => { e.preventDefault(); sendMessage(); }}>
              {recordedAudioUrl ? (
                <div className="sm-audio-preview">
                  <audio controls src={recordedAudioUrl} className="sm-audio" />
                  <button type="button" className="sm-icon-btn sm-send" onClick={sendRecordedAudio} disabled={sending}>✓</button>
                  <button type="button" className="sm-icon-btn" onClick={clearRecordedAudio}>✕</button>
                </div>
              ) : null}
              <button type="button" className="sm-icon-btn" onClick={() => fileRef.current?.click()}>📎</button>
              <button
                type="button"
                className={`sm-icon-btn ${recording ? "is-recording" : ""}`}
                onClick={() => (recording ? stopRecordingAndSend() : startRecording())}
                title={recording ? t("smStopRecord") : t("smRecord")}
              >
                {recording ? "■" : "🎙"}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*,.pdf"
                style={{ display: "none" }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) sendMessage({ file });
                  e.target.value = "";
                }}
              />
              <input value={text} onChange={(e) => setText(e.target.value)} placeholder={t("smTypeMessage")} />
              <button type="submit" className="sm-send" disabled={sending}>{sending ? "..." : t("smSend")}</button>
            </form>
          </>
        )}
      </section>
      {classMembersOpen ? (
        <div className="sm-members-modal-backdrop" onClick={() => setClassMembersOpen(false)}>
          <div className="sm-members-modal" onClick={(e) => e.stopPropagation()}>
            <div className="sm-members-head">
              <h3>{classConversation?.name || "Class"} students</h3>
              <button type="button" className="sm-icon-btn" onClick={() => setClassMembersOpen(false)}>✕</button>
            </div>
            <div className="sm-members-list">
              {classMembers.length === 0 ? (
                <div className="sm-empty">No students found.</div>
              ) : classMembers.map((member) => (
                <button
                  key={member.id}
                  type="button"
                  className="sm-member-item"
                  onClick={() => {
                    setClassMembersOpen(false);
                    navigate(`/student/friends/${member.id}`);
                  }}
                >
                  <span className="sm-avatar">
                    {member.profile_picture_url
                      ? <img src={member.profile_picture_url} alt={member.name || ""} />
                      : (member.name || "S").slice(0, 1).toUpperCase()}
                  </span>
                  <span className="sm-member-meta">
                    <strong>{member.name}</strong>
                    <small>{member.matricule || member.email || ""}</small>
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}
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
