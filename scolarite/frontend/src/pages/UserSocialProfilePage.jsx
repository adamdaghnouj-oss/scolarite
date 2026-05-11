import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api/axios";
import { useAuth } from "../auth/useAuth";
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

export default function UserSocialProfilePage() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const auth = useAuth();
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [profilePosts, setProfilePosts] = useState([]);
  const [commentDrafts, setCommentDrafts] = useState({});

  async function loadProfile() {
    setLoading(true);
    try {
      const res = await api.get(`/friends/users/${userId}`);
      setData(res.data || null);
      setProfilePosts(Array.isArray(res.data?.posts) ? res.data.posts : []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProfile();
  }, [userId]);

  async function handleLogout() {
    await auth.logout();
    navigate("/login");
  }

  async function sendInvite() {
    if (!userId) return;
    setBusy(true);
    try {
      await api.post("/friends/invitations", { receiver_user_id: Number(userId) });
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

  const person = data?.person;
  const posts = profilePosts;
  const avatarUrl = person?.profile_picture_url || resolvePublicFileUrl(person?.profile_picture);
  const coverUrl = person?.cover_photo_url || resolvePublicFileUrl(person?.cover_photo);

  const action = useMemo(() => {
    const status = data?.relation_status;
    if (status === "friends") {
      return (
        <div className="sfp-action-row">
          <span className="sfp-pill">{t("sfFriendsState")}</span>
          <Link className="sfp-btn sfp-btn--primary" to="/messages/panier">{t("menuPanierMessages")}</Link>
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
      // ignore
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
      // ignore
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
        {!loading && !person && <p className="sfp-empty">{t("sfNoPeople")}</p>}

        {!loading && person && (
          <>
            <section className="sfp-card">
              <div className="sfp-cover" style={coverUrl ? { backgroundImage: `url(${coverUrl})` } : {}}>
                {!coverUrl ? <div className="sfp-cover-fallback" /> : null}
              </div>
              <div className="sfp-head">
                <div className="sfp-avatar">
                  {avatarUrl ? <img src={avatarUrl} alt={person.name || ""} /> : <span>{(person.name || "U").slice(0, 1).toUpperCase()}</span>}
                </div>
                <div className="sfp-meta">
                  <h1>{person.name}</h1>
                  <p>{person.email}</p>
                  <div className="sfp-badges">
                    <span>{person.role === "professeur" ? "Professeur" : "Étudiant"}</span>
                    <span>{t("sfFriendsTab")}: {data?.friends_count ?? 0}</span>
                    <span>{t("sfDepartment")}: {person.departement || "—"}</span>
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
                        {post.author?.profile_picture_url
                          ? <img src={post.author.profile_picture_url} alt={post.author?.name || ""} />
                          : (post.author?.name || "U").slice(0, 1).toUpperCase()}
                      </div>
                      <div className="sfp-post-author-meta">
                        <div className="sfp-post-author-name">{post.author?.name || "—"}</div>
                        <div className="sfp-post-author-sub">{formatWhen(post.created_at)}</div>
                      </div>
                    </div>
                    {post.body && <div className="sfp-post-body">{post.body}</div>}
                    {post.image_url ? <img src={post.image_url} alt="post" className="sfp-post-image" /> : null}
                    <div className="sfp-post-actions">
                      <button type="button" className={`sfp-mini ${post.liked_by_me ? "is-active" : ""}`} onClick={() => togglePostLike(post.id)}>
                        {post.liked_by_me ? "♥" : "♡"} {post.likes_count || 0}
                      </button>
                      <button type="button" className="sfp-mini">💬 {post.comments_count || 0}</button>
                    </div>
                    <div className="sfp-comment-box">
                      <input
                        className="sfp-input"
                        placeholder={t("postWriteComment")}
                        value={commentDrafts[post.id] || ""}
                        onChange={(e) => setCommentDrafts((p) => ({ ...p, [post.id]: e.target.value }))}
                      />
                      <button type="button" className="sfp-btn sfp-btn--primary" onClick={() => sendComment(post.id)}>OK</button>
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

function formatWhen(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return "";
  }
}
