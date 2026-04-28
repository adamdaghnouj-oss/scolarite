import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api/axios";
import { clearAuth } from "../auth/auth";
import { useLanguage } from "../i18n/LanguageContext";
import "./StudentFriendProfilePage.css";

const API_BASE_URL =
  import.meta.env.VITE_API_URL
  || (import.meta.env.DEV ? "http://127.0.0.1:8000/api" : null)
  || api.defaults.baseURL
  || "/api";
const BACKEND_BASE_URL = (() => {
  try {
    const apiUrl = new URL(API_BASE_URL, window.location.origin).toString();
    return apiUrl.replace(/\/api\/?$/i, "").replace(/\/$/, "");
  } catch {
    return window.location.origin;
  }
})();

function resolvePublicFileUrl(pathOrUrl) {
  if (!pathOrUrl || typeof pathOrUrl !== "string") return null;
  const normalized = pathOrUrl.replace(/\\/g, "/").trim();
  if (!normalized) return null;
  if (/^https?:\/\//i.test(normalized)) return normalized;
  const storageIdx = normalized.indexOf("/storage/");
  if (storageIdx >= 0) return `${BACKEND_BASE_URL}${normalized.slice(storageIdx)}`;
  if (normalized.startsWith("storage/")) return `${BACKEND_BASE_URL}/${normalized}`;
  if (normalized.startsWith("/")) return `${BACKEND_BASE_URL}${normalized}`;
  return `${BACKEND_BASE_URL}/storage/${normalized}`;
}

export default function StudentFriendProfilePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [profilePosts, setProfilePosts] = useState([]);
  const [commentDrafts, setCommentDrafts] = useState({});
  const [replyDrafts, setReplyDrafts] = useState({});
  async function loadProfile() {
    setLoading(true);
    try {
      const res = await api.get(`/friends/students/${id}`);
      setData(res.data || null);
      setProfilePosts(Array.isArray(res.data?.posts) ? res.data.posts : []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProfile();
  }, [id]);

  useEffect(() => {
    api.get("/posts/me-context")
      .then((res) => {
        const sid = res.data?.student_id;
        if (sid != null && String(id) === String(sid)) {
          navigate("/profile", { replace: true });
        }
      })
      .catch(() => {});
  }, [id, navigate]);

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

  async function sendInvite() {
    if (!data?.student?.id) return;
    setBusy(true);
    try {
      await api.post("/friends/invitations", { student_id: data.student.id });
      await loadProfile();
    } finally {
      setBusy(false);
    }
  }

  async function acceptInvite() {
    if (!data?.invitation_id) return;
    setBusy(true);
    try {
      await api.post(`/friends/invitations/${data.invitation_id}/accept`);
      await loadProfile();
    } finally {
      setBusy(false);
    }
  }

  async function rejectInvite() {
    if (!data?.invitation_id) return;
    setBusy(true);
    try {
      await api.post(`/friends/invitations/${data.invitation_id}/reject`);
      await loadProfile();
    } finally {
      setBusy(false);
    }
  }

  const student = data?.student;
  const posts = profilePosts;
  const coverUrl = student?.cover_photo_url || resolvePublicFileUrl(student?.cover_photo);
  const avatarUrl = student?.profile_picture_url || resolvePublicFileUrl(student?.profile_picture);

  const action = useMemo(() => {
    const status = data?.relation_status;
    if (status === "friends") {
      return (
        <div className="sfp-action-row">
          <span className="sfp-pill">{t("sfFriendsState")}</span>
          {data?.student?.id ? (
            <button
              type="button"
              className="sfp-btn sfp-btn--primary"
              onClick={() => navigate(`/student/messages?friend=${data.student.id}`)}
            >
              {t("sfSendMessage")}
            </button>
          ) : null}
        </div>
      );
    }
    if (status === "outgoing_pending") return <span className="sfp-pill">{t("sfSentState")}</span>;
    if (status === "incoming_pending") {
      return (
        <div className="sfp-action-row">
          <button type="button" className="sfp-btn sfp-btn--ok" onClick={acceptInvite} disabled={busy}>{t("sfAccept")}</button>
          <button type="button" className="sfp-btn sfp-btn--danger" onClick={rejectInvite} disabled={busy}>{t("sfReject")}</button>
        </div>
      );
    }
    return (
      <button type="button" className="sfp-btn sfp-btn--primary" onClick={sendInvite} disabled={busy}>
        {busy ? "..." : t("sfAddFriend")}
      </button>
    );
  }, [data, busy, t]);

  async function togglePostLike(postId) {
    try {
      const res = await api.post(`/posts/${postId}/like`);
      setProfilePosts((prev) => prev.map((p) => (
        p.id === postId
          ? { ...p, liked_by_me: !!res.data?.liked, likes_count: Number(res.data?.likes_count || 0) }
          : p
      )));
    } catch {
      // keep UI smooth
    }
  }

  async function sendComment(postId) {
    const body = (commentDrafts[postId] || "").trim();
    if (!body) return;
    try {
      const res = await api.post(`/posts/${postId}/comments`, { body });
      setProfilePosts((prev) => prev.map((p) => (
        p.id === postId
          ? {
            ...p,
            comments_count: Number(res.data?.comments_count || (p.comments_count || 0) + 1),
            comments: [...(Array.isArray(p.comments) ? p.comments : []), res.data?.comment].filter(Boolean),
          }
          : p
      )));
      setCommentDrafts((prev) => ({ ...prev, [postId]: "" }));
    } catch {
      // keep UI smooth
    }
  }

  async function toggleCommentLike(commentId, postId) {
    try {
      const res = await api.post(`/posts/comments/${commentId}/like`);
      setProfilePosts((prev) => prev.map((p) => (
        p.id !== postId ? p : {
          ...p,
          comments: (p.comments || []).map((c) => (
            c.id === commentId
              ? { ...c, liked_by_me: !!res.data?.liked, likes_count: Number(res.data?.likes_count || 0) }
              : c
          )),
        }
      )));
    } catch {
      // keep UI smooth
    }
  }

  async function sendReply(commentId, postId) {
    const key = `${postId}:${commentId}`;
    const text = (replyDrafts[key] || "").trim();
    if (!text) return;
    try {
      const res = await api.post(`/posts/comments/${commentId}/replies`, { body: text });
      setProfilePosts((prev) => prev.map((p) => (
        p.id !== postId ? p : {
          ...p,
          comments: (p.comments || []).map((c) => (
            c.id === commentId
              ? { ...c, replies: [...(c.replies || []), res.data?.reply].filter(Boolean) }
              : c
          )),
        }
      )));
      setReplyDrafts((prev) => ({ ...prev, [key]: "" }));
    } catch {
      // keep UI smooth
    }
  }

  return (
    <div className="sfp-page">
      <header className="sfp-topbar">
        <Link to="/" className="sfp-brand">Scolarite</Link>
        <div className="sfp-actions">
          <Link to="/student/posts" className="sfp-btn sfp-btn--ghost">{t("menuPost")}</Link>
          <Link to="/student/friends" className="sfp-btn sfp-btn--ghost">{t("menuFriends")}</Link>
          <Link to="/messages/panier" className="sfp-btn sfp-btn--ghost">{t("menuPanierMessages")}</Link>
          <Link to="/profile" className="sfp-btn sfp-btn--ghost">{t("profile")}</Link>
          <button type="button" className="sfp-btn sfp-btn--primary" onClick={handleLogout}>{t("logout")}</button>
        </div>
      </header>

      <main className="sfp-wrap">
        {loading && <p className="sfp-empty">{t("sfLoading")}</p>}
        {!loading && !student && <p className="sfp-empty">{t("sfNoPeople")}</p>}

        {!loading && student && (
          <>
            <section className="sfp-card">
              <div className="sfp-cover" style={coverUrl ? { backgroundImage: `url(${coverUrl})` } : {}}>
                {!coverUrl && <div className="sfp-cover-fallback" />}
              </div>
              <div className="sfp-head">
                <div className="sfp-avatar">
                  {avatarUrl ? <img src={avatarUrl} alt={student.name || ""} /> : <span>{(student.name || "S").slice(0, 1).toUpperCase()}</span>}
                </div>
                <div className="sfp-meta">
                  <h1>{student.name}</h1>
                  <p>{student.email}</p>
                  <div className="sfp-badges">
                    <span>{t("sfFriendsTab")}: {data?.friends_count ?? 0}</span>
                    <span>{t("sfClass")}: {student.class_name || "—"}</span>
                    <span>{t("sfDepartment")}: {student.departement || "—"}</span>
                  </div>
                </div>
                <div className="sfp-action">{action}</div>
              </div>
            </section>

            <section className="sfp-posts">
              <div className="sfp-posts-title">{t("menuPost")}</div>
              {posts.length === 0 ? (
                <div className="sfp-post-empty">{t("postNoPosts")}</div>
              ) : (
                posts.map((post) => (
                  <article key={post.id} className="sfp-post-item">
                    <div className="sfp-post-head">
                      <div className="sfp-post-author-avatar">
                        {avatarUrl ? <img src={avatarUrl} alt={student.name || ""} /> : <span>{(student.name || "S").slice(0, 1).toUpperCase()}</span>}
                      </div>
                      <div className="sfp-post-author-meta">
                        <div className="sfp-post-author-name">{student.name || "Student"}</div>
                        <div className="sfp-post-author-sub">
                          {(student.class_name || "IT11")} · {post.created_at ? new Date(post.created_at).toLocaleString() : ""}
                        </div>
                      </div>
                    </div>
                    {post.body ? <p className="sfp-post-body">{post.body}</p> : null}
                    {post.image_url ? <img src={post.image_url} alt="post" className="sfp-post-image" /> : null}
                    <div className="sfp-post-actions">
                      <button type="button" className={post.liked_by_me ? "is-active" : ""} onClick={() => togglePostLike(post.id)}>
                        ❤ {Number(post.likes_count || 0)}
                      </button>
                      <button type="button">💬 {Number(post.comments_count || 0)}</button>
                    </div>
                    {Array.isArray(post.comments) && post.comments.length > 0 ? (
                      <div className="sfp-comments-list">
                        {post.comments.map((comment) => (
                          <div key={comment.id} className="sfp-comment-item">
                            <strong>{comment.author?.name || "Student"}:</strong> {comment.body}
                            <div className="sfp-comment-actions">
                              <button
                                type="button"
                                className={comment.liked_by_me ? "is-active" : ""}
                                onClick={() => toggleCommentLike(comment.id, post.id)}
                              >
                                ❤ {Number(comment.likes_count || 0)}
                              </button>
                              <button type="button" onClick={() => sendReply(comment.id, post.id)}>{t("postReply")}</button>
                            </div>
                            {Array.isArray(comment.replies) && comment.replies.length > 0 ? (
                              <div className="sfp-replies-list">
                                {comment.replies.map((reply) => (
                                  <div key={reply.id} className="sfp-reply-item">
                                    <strong>{reply.author?.name || "Student"}:</strong> {reply.body}
                                  </div>
                                ))}
                              </div>
                            ) : null}
                            <div className="sfp-reply-input">
                              <input
                                type="text"
                                value={replyDrafts[`${post.id}:${comment.id}`] || ""}
                                onChange={(e) => setReplyDrafts((prev) => ({ ...prev, [`${post.id}:${comment.id}`]: e.target.value }))}
                                placeholder={t("postWriteReply")}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    e.preventDefault();
                                    sendReply(comment.id, post.id);
                                  }
                                }}
                              />
                              <button type="button" onClick={() => sendReply(comment.id, post.id)}>{t("smSend")}</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : null}
                    <div className="sfp-post-comment">
                      <span className="sfp-post-comment-avatar">
                        {avatarUrl ? <img src={avatarUrl} alt={student.name || ""} /> : (student.name || "S").slice(0, 1).toUpperCase()}
                      </span>
                      <input
                        type="text"
                        value={commentDrafts[post.id] || ""}
                        placeholder={t("postWriteComment")}
                        onChange={(e) => setCommentDrafts((prev) => ({ ...prev, [post.id]: e.target.value }))}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            sendComment(post.id);
                          }
                        }}
                      />
                      <button type="button" className="sfp-post-send" onClick={() => sendComment(post.id)}>{t("smSend")}</button>
                    </div>
                  </article>
                ))
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
