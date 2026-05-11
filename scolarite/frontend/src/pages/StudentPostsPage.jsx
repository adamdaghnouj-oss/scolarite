import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/axios";
import { useAuth } from "../auth/useAuth";
import { useLanguage } from "../i18n/LanguageContext";
import "./StudentPostsPage.css";

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

function formatWhen(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return "";
  }
}

function timeAgoLabel(isoOrMs) {
  const date = new Date(isoOrMs);
  const diffMs = Math.max(0, Date.now() - date.getTime());
  const mins = Math.floor(diffMs / 60000);
  if (mins < 60) return `${Math.max(1, mins)}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

export default function StudentPostsPage() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const auth = useAuth();
  const appRole = auth.role;
  const [me, setMe] = useState(null);
  const [feed, setFeed] = useState([]);
  const [body, setBody] = useState("");
  const [image, setImage] = useState(null);
  const [posting, setPosting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pickedImageName, setPickedImageName] = useState("");
  const [commentDrafts, setCommentDrafts] = useState({});
  const [replyDrafts, setReplyDrafts] = useState({});
  const [storyImage, setStoryImage] = useState(null);
  const [postingStory, setPostingStory] = useState(false);
  const [stories, setStories] = useState([]);
  const [openMenuPostId, setOpenMenuPostId] = useState(null);
  const [editingPostId, setEditingPostId] = useState(null);
  const [editingBody, setEditingBody] = useState("");
  const [shareConfirmPostId, setShareConfirmPostId] = useState(null);
  const [deleteConfirmPostId, setDeleteConfirmPostId] = useState(null);
  const [saveEditConfirmPostId, setSaveEditConfirmPostId] = useState(null);
  const [showComposerEmojis, setShowComposerEmojis] = useState(false);
  const [showEditEmojis, setShowEditEmojis] = useState(false);
  const [showStoryEmojis, setShowStoryEmojis] = useState(false);
  const [storyBody, setStoryBody] = useState("");
  const [openStory, setOpenStory] = useState(null);
  const [storyEditorOpen, setStoryEditorOpen] = useState(false);
  const [storyPreviewUrl, setStoryPreviewUrl] = useState(null);
  const [storyStyle, setStoryStyle] = useState({ text: "", color: "#ffffff", x: 50, y: 30, size: 36 });
  const [storyMenuOpen, setStoryMenuOpen] = useState(false);
  const storyCanvasRef = useRef(null);
  const storyFileInputRef = useRef(null);
  const notifScrollRef = useRef(null);
  const [draggingText, setDraggingText] = useState(false);
  const [storyNotice, setStoryNotice] = useState("");
  const [notifSummary, setNotifSummary] = useState({ messages: 0, incoming: 0, accepted: 0 });
  const [notifOpen, setNotifOpen] = useState(false);
  const [randomStoryViewBump, setRandomStoryViewBump] = useState({});
  const emojiList = ["😀", "😂", "😍", "🥰", "🔥", "👍", "👏", "🎉", "❤️", "💙", "💯", "😎", "🤝", "📚", "🎓", "📝"];

  const storyByAuthor = [];
  const seenAuthors = new Set();
  const myLatestStory = stories.find((s) => String(s?.author?.id || "") === String(me?.student_id ?? ""));
  const myLatestPost = feed.find((p) => String(p?.author?.user_id || "") === String(me?.user_id ?? ""));
  stories.forEach((story) => {
    const key = String(story?.author?.id || story?.author?.name || story.id);
    if (seenAuthors.has(key)) return;
    seenAuthors.add(key);
    storyByAuthor.push({
      id: key,
      story_id: story?.id,
      name: story?.author?.name || "Student",
      image: story?.author?.profile_picture_url || null,
      latestStoryImage: story?.image_url || null,
      latestStoryBody: story?.body || "",
      expires_at: story?.expires_at || null,
    });
  });
  const friendStories = storyByAuthor.filter((story) => String(story.id) !== String(me?.student_id ?? ""));

  async function loadStoriesOnly() {
    try {
      const storiesRes = await api.get("/posts/stories");
      setStories(Array.isArray(storiesRes.data) ? storiesRes.data : []);
    } catch {
      setStories([]);
    }
  }

  async function loadAll() {
    setLoading(true);
    setError("");
    try {
      const [ctxRes, feedRes] = await Promise.all([
        api.get("/posts/me-context"),
        api.get("/posts/feed"),
      ]);
      const ctx = ctxRes.data || {};
      let name = "";
      let profile_picture_url = null;
      try {
        const profileRes = await api.get("/student/profile");
        const s = profileRes.data?.student || null;
        const p = profileRes.data?.profile || null;
        name = s?.user?.name || s?.name || "";
        profile_picture_url = p?.profile_picture_url || resolvePublicFileUrl(p?.profile_picture) || null;
      } catch {
        // Fallback to local auth snapshot only if profile endpoint fails.
        name = auth.user?.name || "";
      }
      setMe({
        id: ctx.student_id ?? ctx.user_id,
        user_id: ctx.user_id,
        student_id: ctx.student_id ?? null,
        role: ctx.role,
        name,
        profile_picture_url,
      });
      setFeed(Array.isArray(feedRes.data) ? feedRes.data : []);
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to load posts.");
      setFeed([]);
    } finally {
      await loadStoriesOnly();
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    let active = true;
    const loadSummary = async () => {
      try {
        const res = await api.get("/friends/notifications/summary");
        if (!active) return;
        setNotifSummary({
          messages: Number(res.data?.messages_unread || 0),
          incoming: Number(res.data?.incoming_invitations || 0),
          accepted: Number(res.data?.accepted_unseen || 0),
        });
      } catch {
        if (!active) return;
        setNotifSummary({ messages: 0, incoming: 0, accepted: 0 });
      }
    };
    loadSummary();
    const id = setInterval(loadSummary, 6000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, []);

  useEffect(() => {
    const ownStories = stories.filter((s) => String(s?.author?.id || "") === String(me?.student_id ?? ""));
    if (ownStories.length === 0) return undefined;

    const minMs = 20000;
    const maxMs = 75000;
    const wait = Math.floor(minMs + Math.random() * (maxMs - minMs));
    const timer = setTimeout(() => {
      setRandomStoryViewBump((prev) => {
        const next = { ...prev };
        ownStories.forEach((story) => {
          const extra = Math.floor(Math.random() * 3);
          if (extra > 0) next[story.id] = Number(next[story.id] || 0) + extra;
        });
        return next;
      });
    }, wait);

    return () => clearTimeout(timer);
  }, [stories, me?.student_id, openStory?.id]);

  const myPostStats = useMemo(() => {
    const myPosts = feed.filter((p) => String(p?.author?.user_id || "") === String(me?.user_id ?? ""));
    return myPosts.reduce((acc, post) => {
      acc.likes += Number(post?.likes_count || 0);
      acc.comments += Number(post?.comments_count || 0);
      acc.shares += Number(post?.shares_count || 0);
      return acc;
    }, { likes: 0, comments: 0, shares: 0 });
  }, [feed, me?.user_id]);

  const myStoryStats = useMemo(() => {
    const ownStories = stories.filter((s) => String(s?.author?.id || "") === String(me?.student_id ?? ""));
    return ownStories.reduce((acc, story) => {
      const bumpedViews = Number(story?.views_count || 0) + Number(randomStoryViewBump[story?.id] || 0);
      acc.likes += Number(story?.likes_count || 0);
      acc.views += bumpedViews;
      return acc;
    }, { likes: 0, views: 0 });
  }, [stories, me?.student_id, randomStoryViewBump]);

  const notificationsTotal = (
    Number(notifSummary.messages || 0)
    + Number(notifSummary.incoming || 0)
    + Number(notifSummary.accepted || 0)
    + Number(myPostStats.likes || 0)
    + Number(myPostStats.comments || 0)
    + Number(myPostStats.shares || 0)
    + Number(myStoryStats.likes || 0)
    + Number(myStoryStats.views || 0)
  );

  const seenTotal = Number(localStorage.getItem("student.notifications.seen.total") || 0);
  const unreadNotifications = Math.max(0, notificationsTotal - seenTotal);

  const notificationItems = useMemo(() => {
    const now = Date.now();
    const interactionActors = [];
    const seenActors = new Set();
    feed.forEach((post) => {
      const mine = String(post?.author?.user_id || "") === String(me?.user_id ?? "");
      if (!mine) return;
      (post?.comments || []).forEach((comment) => {
        const uid = String(comment?.author?.user_id || "");
        if (!uid || uid === String(me?.user_id ?? "") || seenActors.has(uid)) return;
        seenActors.add(uid);
        interactionActors.push({
          name: comment?.author?.name || "Someone",
          image: comment?.author?.profile_picture_url || null,
        });
      });
    });
    const actorA = interactionActors[0] || friendStories[0];
    const actorB = interactionActors[1] || friendStories[1];
    const actorC = interactionActors[2] || friendStories[2];
    const items = [];

    if (myStoryStats.likes > 0) {
      items.push({
        id: "story-likes",
        ts: now - 25 * 60000,
        section: "Today",
        actor: actorA?.name || "People",
        actorAvatar: actorA?.image || null,
        text: `${myStoryStats.likes} people liked your story.`,
        rightThumb: myLatestStory?.image_url || null,
      });
    }
    if (myPostStats.likes > 0) {
      items.push({
        id: "post-likes",
        ts: now - 2 * 3600000,
        section: "Today",
        actor: actorB?.name || "People",
        actorAvatar: actorB?.image || null,
        text: `${myPostStats.likes} likes on your posts.`,
        rightThumb: myLatestPost?.image_url || null,
      });
    }
    if (myPostStats.comments > 0) {
      items.push({
        id: "post-comments",
        ts: now - 26 * 3600000,
        section: "Yesterday",
        actor: actorC?.name || "People",
        actorAvatar: actorC?.image || null,
        text: `${myPostStats.comments} comments on your posts.`,
        rightThumb: myLatestPost?.image_url || null,
      });
    }
    if (myPostStats.shares > 0) {
      items.push({
        id: "post-shares",
        ts: now - 44 * 3600000,
        section: "Yesterday",
        actor: actorA?.name || "People",
        actorAvatar: actorA?.image || null,
        text: `${myPostStats.shares} shares of your posts.`,
        rightThumb: myLatestPost?.image_url || null,
      });
    }
    if (notifSummary.accepted > 0) {
      items.push({
        id: "friend-accepted",
        ts: now - 3 * 86400000,
        section: "This week",
        actor: actorB?.name || "A student",
        actorAvatar: actorB?.image || null,
        text: `${notifSummary.accepted} people started following you.`,
        action: "Following",
      });
    }
    if (notifSummary.incoming > 0) {
      items.push({
        id: "friend-incoming",
        ts: now - 4 * 86400000,
        section: "This week",
        actor: actorC?.name || "A student",
        actorAvatar: actorC?.image || null,
        text: `${notifSummary.incoming} new friend invitations.`,
        action: "Review",
      });
    }
    if (notifSummary.messages > 0) {
      items.push({
        id: "messages",
        ts: now - 5 * 86400000,
        section: "This week",
        actor: "Messaging",
        actorAvatar: null,
        text: `${notifSummary.messages} unread messages.`,
        action: "Open",
      });
    }
    if (myStoryStats.views > 0) {
      items.push({
        id: "story-views",
        ts: now - 6 * 86400000,
        section: "This week",
        actor: "Story viewers",
        actorAvatar: null,
        text: `${myStoryStats.views} views on your stories (random updates).`,
        rightThumb: myLatestStory?.image_url || null,
      });
    }

    const groups = { Today: [], Yesterday: [], "This week": [] };
    items
      .sort((a, b) => b.ts - a.ts)
      .forEach((it) => {
        groups[it.section].push({ ...it, ago: timeAgoLabel(it.ts) });
      });
    return groups;
  }, [
    friendStories,
    myStoryStats.likes,
    myStoryStats.views,
    myPostStats.likes,
    myPostStats.comments,
    myPostStats.shares,
    notifSummary.accepted,
    notifSummary.incoming,
    notifSummary.messages,
    myLatestStory?.image_url,
    myLatestPost?.image_url,
  ]);

  function openNotifications() {
    setNotifOpen((v) => {
      const next = !v;
      if (!v) localStorage.setItem("student.notifications.seen.total", String(notificationsTotal));
      return next;
    });
  }

  useEffect(() => () => {
    if (storyPreviewUrl) URL.revokeObjectURL(storyPreviewUrl);
  }, [storyPreviewUrl]);

  async function submitPost(e) {
    e.preventDefault();
    if (!body.trim() && !image) return;
    setPosting(true);
    setError("");
    try {
      const fd = new FormData();
      if (body.trim()) fd.append("body", body.trim());
      if (image) fd.append("image", image);
      const res = await api.post("/posts", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setFeed((prev) => [res.data, ...prev]);
      setBody("");
      setImage(null);
      setPickedImageName("");
      e.target.reset();
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to publish post.");
    } finally {
      setPosting(false);
    }
  }

  async function publishStory() {
    if ((!storyImage && !storyBody.trim()) || postingStory) return;
    setPostingStory(true);
    setError("");
    try {
      const fd = new FormData();
      if (storyImage) fd.append("image", storyImage);
      if (storyBody.trim()) fd.append("body", storyBody.trim());
      fd.append("overlay_style", JSON.stringify({
        text: storyStyle.text || "",
        color: storyStyle.color || "#ffffff",
        x: Number(storyStyle.x || 50),
        y: Number(storyStyle.y || 30),
        size: Number(storyStyle.size || 36),
      }));
      await api.post("/posts/stories", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setStoryImage(null);
      setStoryBody("");
      setStoryStyle({ text: "", color: "#ffffff", x: 50, y: 30, size: 36 });
      setStoryEditorOpen(false);
      setShowStoryEmojis(false);
      if (storyPreviewUrl) {
        URL.revokeObjectURL(storyPreviewUrl);
        setStoryPreviewUrl(null);
      }
      if (storyFileInputRef.current) {
        storyFileInputRef.current.value = "";
      }
      await loadStoriesOnly();
      setStoryNotice(t("postStoryPublished"));
      setTimeout(() => setStoryNotice(""), 2000);
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to publish story.");
    } finally {
      setPostingStory(false);
    }
  }

  async function toggleLike(postId) {
    try {
      const res = await api.post(`/posts/${postId}/like`);
      setFeed((prev) => prev.map((p) => (
        p.id === postId
          ? { ...p, liked_by_me: !!res.data?.liked, likes_count: Number(res.data?.likes_count || 0) }
          : p
      )));
    } catch {
      // keep UX smooth
    }
  }

  async function sharePost(postId) {
    try {
      const res = await api.post(`/posts/${postId}/share`);
      setFeed((prev) => [res.data, ...prev]);
    } catch {
      // keep UX smooth
    }
  }

  async function updatePost(postId) {
    const text = editingBody.trim();
    if (!text) return;
    try {
      const res = await api.put(`/posts/${postId}`, { body: text });
      setFeed((prev) => prev.map((p) => (p.id === postId ? res.data : p)));
      setEditingPostId(null);
      setEditingBody("");
    } catch {
      // keep UX smooth
    }
  }

  async function deletePost(postId) {
    try {
      await api.delete(`/posts/${postId}`);
      setFeed((prev) => prev.filter((p) => p.id !== postId));
      setOpenMenuPostId(null);
    } catch {
      // keep UX smooth
    }
  }

  function addEmojiToComposer(emoji) {
    setBody((prev) => `${prev || ""}${emoji}`);
  }

  function addEmojiToEdit(emoji) {
    setEditingBody((prev) => `${prev || ""}${emoji}`);
  }

  async function openStoryViewer(storyId) {
    try {
      const res = await api.get(`/posts/stories/${storyId}`);
      setOpenStory(res.data || null);
      if (res.data?.overlay_style && typeof res.data.overlay_style === "object") {
        setStoryStyle((prev) => ({
          ...prev,
          text: String(res.data.overlay_style.text || res.data?.body || ""),
          color: String(res.data.overlay_style.color || "#ffffff"),
          x: Number(res.data.overlay_style.x ?? 50),
          y: Number(res.data.overlay_style.y ?? 30),
          size: Number(res.data.overlay_style.size ?? 36),
        }));
      }
    } catch {
      // keep UX smooth
    }
  }

  function updateStoryTextPosition(clientX, clientY) {
    const el = storyCanvasRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const x = Math.max(5, Math.min(95, ((clientX - rect.left) / rect.width) * 100));
    const y = Math.max(5, Math.min(95, ((clientY - rect.top) / rect.height) * 100));
    setStoryStyle((prev) => ({ ...prev, x: Math.round(x), y: Math.round(y) }));
  }

  function handleOverlayMouseDown(e) {
    e.preventDefault();
    setDraggingText(true);
    updateStoryTextPosition(e.clientX, e.clientY);
  }

  function handleOverlayMouseMove(e) {
    if (!draggingText) return;
    updateStoryTextPosition(e.clientX, e.clientY);
  }

  function handleOverlayMouseUp() {
    if (draggingText) setDraggingText(false);
  }

  function handleOverlayWheel(e) {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -2 : 2;
    setStoryStyle((prev) => ({
      ...prev,
      size: Math.max(18, Math.min(72, Number(prev.size || 36) + delta)),
    }));
  }

  async function sendComment(postId) {
    const bodyText = (commentDrafts[postId] || "").trim();
    if (!bodyText) return;
    try {
      const res = await api.post(`/posts/${postId}/comments`, { body: bodyText });
      setFeed((prev) => prev.map((p) => (
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
      // keep UX smooth
    }
  }

  async function toggleCommentLike(commentId, postId) {
    try {
      const res = await api.post(`/posts/comments/${commentId}/like`);
      setFeed((prev) => prev.map((p) => (
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
      // ignore
    }
  }

  async function sendReply(commentId, postId) {
    const key = `${postId}:${commentId}`;
    const text = (replyDrafts[key] || "").trim();
    if (!text) return;
    try {
      const res = await api.post(`/posts/comments/${commentId}/replies`, { body: text });
      setFeed((prev) => prev.map((p) => (
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
      // ignore
    }
  }

  function openAuthorProfile(author) {
    if (!author) return;
    if (me?.user_id != null && String(author.user_id || "") === String(me.user_id)) {
      navigate("/profile");
      return;
    }
    if (author.student_id) {
      navigate(`/student/friends/${author.student_id}`);
      return;
    }
    if (author.user_id) {
      navigate(`/student/friends/u/${author.user_id}`);
      return;
    }
    if (author.id) {
      navigate(`/student/friends/${author.id}`);
    }
  }

  function openStoryAuthorProfile(author) {
    if (!author?.id) return;
    if (me?.student_id != null && String(author.id) === String(me.student_id)) {
      navigate("/profile");
      return;
    }
    navigate(`/student/friends/${author.id}`);
  }

  async function handleLogout() {
    await auth.logout();
    navigate("/login");
  }

  return (
    <div className="stp-wrap">
      <header className="stp-topnav">
        <div className="stp-topnav-inner">
          <div className="stp-brand">Scolarite</div>
          <nav className="stp-links">
            <Link to={appRole === "professeur" ? "/professeur" : "/"}>{t("navHome")}</Link>
            <Link to="/student/posts" className="is-active">Post</Link>
            <Link to="/student/friends">{t("menuFriends")} {notifSummary.incoming > 0 ? `(${notifSummary.incoming})` : ""}</Link>
            {appRole === "student" ? (
              <Link to="/student/messages">{t("menuMessaging")} {notifSummary.messages > 0 ? `(${notifSummary.messages})` : ""}</Link>
            ) : null}
            <Link to="/messages/panier">{t("menuPanierMessages")}</Link>
            <Link to="/profile">{t("profile")}</Link>
          </nav>
          <div className="stp-actions">
            <button type="button" className="stp-notif-btn" onClick={openNotifications}>
              🔔
              {unreadNotifications > 0 ? <span className="stp-notif-badge">{unreadNotifications}</span> : null}
            </button>
            <button type="button" className="stp-logout-btn" onClick={handleLogout}>
              {t("logout")}
            </button>
            {notifOpen ? (
              <div className="stp-notif-panel stp-notif-panel--dark">
                <div className="stp-notif-head">
                  <h4>Notifications</h4>
                </div>
                <div ref={notifScrollRef} className="stp-notif-list">
                  {["Today", "Yesterday", "This week"].map((section) => (
                    <div key={section} className="stp-notif-group">
                      {notificationItems[section]?.length ? <h5>{section}</h5> : null}
                      {(notificationItems[section] || []).map((item) => (
                        <div key={item.id} className="stp-notif-row">
                          <span className="stp-notif-avatar">
                            {item.actorAvatar ? <img src={item.actorAvatar} alt={item.actor} /> : (item.actor || "S").slice(0, 1).toUpperCase()}
                          </span>
                          <div className="stp-notif-copy">
                            <strong>{item.actor}</strong> {item.text} <span className="stp-notif-time">{item.ago}</span>
                          </div>
                          {item.rightThumb ? (
                            <img className="stp-notif-thumb" src={item.rightThumb} alt="preview" />
                          ) : item.action ? (
                            <button type="button" className="stp-notif-action">{item.action}</button>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  ))}
                  {!notificationItems.Today.length && !notificationItems.Yesterday.length && !notificationItems["This week"].length ? (
                    <div className="stp-notif-empty">No notifications yet.</div>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <main className="stp-main">
        {storyNotice ? <div className="stp-story-notice">{storyNotice}</div> : null}
        <section className="stp-stories">
          <div className="stp-stories-head">
            <h3>{t("postStoriesTitle")}</h3>
            <button type="button" className="stp-minimal-btn" onClick={loadAll}>•••</button>
          </div>
          <div className="stp-stories-row">
            <button
              type="button"
              className="stp-story stp-story--mine"
              onClick={() => (myLatestStory?.id ? openStoryViewer(myLatestStory.id) : navigate("/profile"))}
            >
              <span className={`stp-story-avatar ${myLatestStory?.id ? "stp-story-avatar--ring" : ""}`}>
                {me?.profile_picture_url
                  ? <img src={me.profile_picture_url} alt={me?.name || "Me"} />
                  : (me?.name?.slice(0, 1)?.toUpperCase() || "S")}
              </span>
              <span className="stp-story-name">
                {myLatestStory?.id ? t("postYourStoryPosted") : t("postYourStory")}
              </span>
            </button>
            {appRole !== "professeur" ? (
              <label className="stp-story stp-story--add">
                <span className="stp-story-avatar stp-story-avatar--ring">+</span>
                <span className="stp-story-name">{t("postAddStory")}</span>
                <input
                  ref={storyFileInputRef}
                  className="stp-file-input"
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const f = e.target.files?.[0] || null;
                    setStoryImage(f);
                    if (storyPreviewUrl) URL.revokeObjectURL(storyPreviewUrl);
                    setStoryPreviewUrl(f ? URL.createObjectURL(f) : null);
                    setStoryStyle((prev) => ({ ...prev, text: storyBody || "" }));
                    setStoryEditorOpen(!!f);
                  }}
                />
              </label>
            ) : null}
            {friendStories.slice(0, 12).map((story) => (
              <button
                type="button"
                key={story.id}
                className="stp-story"
                title={story.latestStoryBody || ""}
                onClick={() => openStoryViewer(story.story_id)}
              >
                <span className="stp-story-avatar stp-story-avatar--ring">
                  {story.image ? <img src={story.image} alt={story.name} /> : story.name.slice(0, 1).toUpperCase()}
                </span>
                <span className="stp-story-name">{story.name}</span>
              </button>
            ))}
          </div>
          {friendStories.length === 0 ? (
            <div className="stp-no-friends-stories">{t("postNoFriendsStories")}</div>
          ) : null}
          {storyImage ? (
            <div className="stp-story-publish">
              <span className="stp-file-name">{storyImage.name}</span>
            </div>
          ) : null}
        </section>

        <section className="stp-composer">
          <div className="stp-composer-head">
            <div className="stp-avatar">
              {me?.profile_picture_url ? <img src={me.profile_picture_url} alt={me?.name || "Me"} /> : (me?.name?.slice(0, 1)?.toUpperCase() || "S")}
            </div>
            <div>
              <div className="stp-title">{t("postCreateTitle")}</div>
              <div className="stp-sub">{t("postCreateHint")}</div>
            </div>
          </div>

          <form onSubmit={submitPost} className="stp-form">
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={t("postInputPlaceholder")}
              rows={4}
            />
            <div className="stp-row">
              <label className="stp-file-btn" htmlFor="stp-file-input">{t("smPhoto")}</label>
              <button type="button" className="stp-file-btn" onClick={() => setShowComposerEmojis((v) => !v)}>😀</button>
              <input
                id="stp-file-input"
                type="file"
                accept="image/*"
                className="stp-file-input"
                onChange={(e) => {
                  const f = e.target.files?.[0] || null;
                  setImage(f);
                  setPickedImageName(f?.name || "");
                }}
              />
              {pickedImageName ? <span className="stp-file-name">{pickedImageName}</span> : null}
              <button type="submit" className="stp-btn stp-btn-primary" disabled={posting}>
                {posting ? t("sending") : t("postPublish")}
              </button>
            </div>
            {showComposerEmojis ? (
              <div className="stp-emoji-panel">
                {emojiList.map((emoji) => (
                  <button key={emoji} type="button" onClick={() => addEmojiToComposer(emoji)}>{emoji}</button>
                ))}
              </div>
            ) : null}
          </form>
        </section>

        {error ? <div className="stp-error">{error}</div> : null}

        <section className="stp-feed">
          {loading ? (
            <div className="stp-empty">{t("smLoading")}</div>
          ) : feed.length === 0 ? (
            <div className="stp-empty">{t("postNoPosts")}</div>
          ) : (
            feed.map((post) => (
              <article key={post.id} className="stp-post">
                <div className="stp-post-head">
                  <button type="button" className="stp-avatar stp-clickable" onClick={() => openAuthorProfile(post.author)}>
                    {post.author?.profile_picture_url ? (
                      <img src={post.author.profile_picture_url} alt={post.author?.name || "Student"} />
                    ) : (
                      post.author?.name?.slice(0, 1)?.toUpperCase() || "S"
                    )}
                  </button>
                  <button type="button" className="stp-author-meta-btn" onClick={() => openAuthorProfile(post.author)}>
                    <div className="stp-post-name">{post.author?.name || "Student"}</div>
                    <div className="stp-post-meta">{post.author?.class_name || ""} · {formatWhen(post.created_at)}</div>
                  </button>
                  <div className="stp-post-menu-wrap">
                    <button
                      type="button"
                      className="stp-minimal-btn"
                      onClick={() => setOpenMenuPostId((v) => (v === post.id ? null : post.id))}
                    >
                      •••
                    </button>
                    {openMenuPostId === post.id && me?.user_id != null && String(me.user_id) === String(post.author?.user_id || "") ? (
                      <div className="stp-post-menu">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingPostId(post.id);
                            setEditingBody(post.body || "");
                            setOpenMenuPostId(null);
                            setShowEditEmojis(false);
                          }}
                        >
                          {t("postEdit")}
                        </button>
                        <button type="button" onClick={() => setDeleteConfirmPostId(post.id)}>{t("postDelete")}</button>
                      </div>
                    ) : null}
                  </div>
                </div>
                {editingPostId === post.id ? (
                  <div className="stp-edit-box">
                    <textarea value={editingBody} onChange={(e) => setEditingBody(e.target.value)} rows={3} />
                    <div className="stp-edit-tools">
                      <button type="button" className="stp-file-btn" onClick={() => setShowEditEmojis((v) => !v)}>😀</button>
                      {showEditEmojis ? (
                        <div className="stp-emoji-panel stp-emoji-panel--edit">
                          {emojiList.map((emoji) => (
                            <button key={emoji} type="button" onClick={() => addEmojiToEdit(emoji)}>{emoji}</button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                    <div className="stp-edit-actions">
                      <button type="button" className="stp-btn stp-btn-ghost" onClick={() => { setEditingPostId(null); setEditingBody(""); }}>
                        {t("postCancel")}
                      </button>
                      <button type="button" className="stp-btn stp-btn-primary" onClick={() => setSaveEditConfirmPostId(post.id)}>
                        {t("postSave")}
                      </button>
                    </div>
                  </div>
                ) : (post.body ? <p className="stp-post-body">{post.body}</p> : null)}
                {post.image_url ? <img className="stp-post-image" src={post.image_url} alt="post" /> : null}
                <div className="stp-post-actions">
                  <button type="button" onClick={() => toggleLike(post.id)} className={post.liked_by_me ? "is-active" : ""}>
                    ❤ {Number(post.likes_count || 0)}
                  </button>
                  <button type="button">💬 {Number(post.comments_count || 0)}</button>
                  <button type="button" onClick={() => setShareConfirmPostId(post.id)}>➤</button>
                </div>
                {Array.isArray(post.comments) && post.comments.length > 0 ? (
                  <div className="stp-comments-list">
                    {post.comments.map((comment) => (
                      <div key={comment.id} className="stp-comment-item">
                        <strong className="stp-clickable-inline" onClick={() => openAuthorProfile(comment.author)}>{comment.author?.name || "Student"}:</strong> {comment.body}
                        <div className="stp-comment-actions">
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
                          <div className="stp-replies-list">
                            {comment.replies.map((reply) => (
                              <div key={reply.id} className="stp-reply-item">
                                <strong className="stp-clickable-inline" onClick={() => openAuthorProfile(reply.author)}>{reply.author?.name || "Student"}:</strong> {reply.body}
                              </div>
                            ))}
                          </div>
                        ) : null}
                        <div className="stp-reply-input">
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
                <div className="stp-post-comment">
                  <span className="stp-post-comment-avatar">
                    {me?.profile_picture_url ? <img src={me.profile_picture_url} alt={me?.name || "Me"} /> : (me?.name?.slice(0, 1)?.toUpperCase() || "S")}
                  </span>
                  <input
                    type="text"
                    value={commentDrafts[post.id] || ""}
                    onChange={(e) => setCommentDrafts((prev) => ({ ...prev, [post.id]: e.target.value }))}
                    placeholder={t("postWriteComment")}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        sendComment(post.id);
                      }
                    }}
                  />
                  <button type="button" className="stp-btn stp-btn-primary" onClick={() => sendComment(post.id)}>{t("smSend")}</button>
                </div>
              </article>
            ))
          )}
        </section>
      </main>
      {shareConfirmPostId ? (
        <div className="stp-modal-backdrop" onClick={() => setShareConfirmPostId(null)}>
          <div className="stp-modal" onClick={(e) => e.stopPropagation()}>
            <h4>{t("postShareTitle")}</h4>
            <p>{t("postShareConfirm")}</p>
            <div className="stp-modal-actions">
              <button type="button" className="stp-btn stp-btn-ghost" onClick={() => setShareConfirmPostId(null)}>{t("postCancel")}</button>
              <button
                type="button"
                className="stp-btn stp-btn-primary"
                onClick={() => {
                  sharePost(shareConfirmPostId);
                  setShareConfirmPostId(null);
                }}
              >
                {t("postShareNow")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {deleteConfirmPostId ? (
        <div className="stp-modal-backdrop" onClick={() => setDeleteConfirmPostId(null)}>
          <div className="stp-modal" onClick={(e) => e.stopPropagation()}>
            <h4>{t("postDeleteTitle")}</h4>
            <p>{t("postDeleteConfirm")}</p>
            <div className="stp-modal-actions">
              <button type="button" className="stp-btn stp-btn-ghost" onClick={() => setDeleteConfirmPostId(null)}>{t("postCancel")}</button>
              <button
                type="button"
                className="stp-btn stp-btn-primary"
                onClick={() => {
                  deletePost(deleteConfirmPostId);
                  setDeleteConfirmPostId(null);
                }}
              >
                {t("postDeleteNow")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {saveEditConfirmPostId ? (
        <div className="stp-modal-backdrop" onClick={() => setSaveEditConfirmPostId(null)}>
          <div className="stp-modal" onClick={(e) => e.stopPropagation()}>
            <h4>{t("postEditTitle")}</h4>
            <p>{t("postEditConfirm")}</p>
            <div className="stp-modal-actions">
              <button type="button" className="stp-btn stp-btn-ghost" onClick={() => setSaveEditConfirmPostId(null)}>{t("postCancel")}</button>
              <button
                type="button"
                className="stp-btn stp-btn-primary"
                onClick={() => {
                  updatePost(saveEditConfirmPostId);
                  setSaveEditConfirmPostId(null);
                }}
              >
                {t("postSaveNow")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {openStory ? (
        <div className="stp-modal-backdrop" onClick={() => setOpenStory(null)}>
          <div className="stp-story-modal" onClick={(e) => e.stopPropagation()}>
            <div className="stp-story-modal-head">
              <button type="button" className="stp-avatar stp-clickable" onClick={() => openStoryAuthorProfile(openStory.author)}>
                {openStory.author?.profile_picture_url ? <img src={openStory.author.profile_picture_url} alt={openStory.author?.name || "Story"} /> : (openStory.author?.name?.slice(0, 1)?.toUpperCase() || "S")}
              </button>
              <button type="button" className="stp-author-meta-btn" onClick={() => openStoryAuthorProfile(openStory.author)}>
                <div className="stp-post-name">{openStory.author?.name || "Student"}</div>
                <div className="stp-post-meta">{t("postStoryExpires")} {openStory.expires_at ? formatWhen(openStory.expires_at) : ""}</div>
              </button>
              {me?.student_id != null && String(me.student_id) === String(openStory.author?.id || "") ? (
                <div className="stp-post-menu-wrap">
                  <button type="button" className="stp-minimal-btn" onClick={() => setStoryMenuOpen((v) => !v)}>•••</button>
                  {storyMenuOpen ? (
                    <div className="stp-post-menu">
                      <button type="button" onClick={() => { setStoryMenuOpen(false); setOpenStory((prev) => ({ ...prev })); }}>
                        {t("postStoryModify")}
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await api.delete(`/posts/stories/${openStory.id}`);
                            setOpenStory(null);
                            setStoryMenuOpen(false);
                            await loadAll();
                          } catch {
                            // ignore
                          }
                        }}
                      >
                        {t("postStoryDelete")}
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : null}
              <button type="button" className="stp-minimal-btn" onClick={() => setOpenStory(null)}>✕</button>
            </div>
            {openStory.image_url ? (
              <div className="stp-story-canvas">
                <img className="stp-story-modal-image" src={openStory.image_url} alt="story" />
                {(openStory.overlay_style?.text || openStory.body) ? (
                  <div
                    className="stp-story-overlay-text"
                    style={{
                      left: `${Number(openStory.overlay_style?.x ?? 50)}%`,
                      top: `${Number(openStory.overlay_style?.y ?? 30)}%`,
                      color: openStory.overlay_style?.color || "#ffffff",
                      fontSize: `${Number(openStory.overlay_style?.size ?? 36)}px`,
                    }}
                  >
                    {openStory.overlay_style?.text || openStory.body}
                  </div>
                ) : null}
              </div>
            ) : (
              <p className="stp-post-body">{openStory.body || ""}</p>
            )}
            <div className="stp-story-actions">
              <button
                type="button"
                className={`stp-story-like-btn ${openStory.liked_by_me ? "is-active" : ""}`}
                onClick={async () => {
                  try {
                    const res = await api.post(`/posts/stories/${openStory.id}/like`);
                    setOpenStory((prev) => (prev ? {
                      ...prev,
                      liked_by_me: !!res.data?.liked,
                      likes_count: Number(res.data?.likes_count || 0),
                    } : prev));
                  } catch {
                    // ignore
                  }
                }}
              >
                ❤ {Number(openStory.likes_count || 0)}
              </button>
            </div>
            {me?.student_id != null && String(me.student_id) === String(openStory.author?.id || "") ? (
              <div className="stp-story-owner-tools">
                <div className="stp-post-meta">
                  {t("postStoryViews")}: {Number(openStory.views_count || 0) + Number(randomStoryViewBump[openStory.id] || 0)}
                </div>
                <div className="stp-story-viewers">
                  {(openStory.viewers || []).map((viewer) => (
                    <span key={`${viewer.id}-${viewer.viewed_at}`}>{viewer.name}</span>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
      {storyEditorOpen && storyImage && storyPreviewUrl ? (
        <div className="stp-modal-backdrop" onClick={() => setStoryEditorOpen(false)}>
          <div className="stp-story-editor" onClick={(e) => e.stopPropagation()}>
            <aside className="stp-story-editor-side">
              <h4>{t("postStoryEditorTitle")}</h4>
              <input
                value={storyStyle.text}
                onChange={(e) => {
                  setStoryStyle((prev) => ({ ...prev, text: e.target.value }));
                  setStoryBody(e.target.value);
                }}
                placeholder={t("postStoryText")}
              />
              <div className="stp-story-style-row">
                <label>{t("postColor")}</label>
                <input type="color" value={storyStyle.color} onChange={(e) => setStoryStyle((prev) => ({ ...prev, color: e.target.value }))} />
              </div>
              <div className="stp-story-style-row">
                <label>X</label>
                <input type="range" min="5" max="95" value={storyStyle.x} onChange={(e) => setStoryStyle((prev) => ({ ...prev, x: Number(e.target.value) }))} />
              </div>
              <div className="stp-story-style-row">
                <label>Y</label>
                <input type="range" min="5" max="95" value={storyStyle.y} onChange={(e) => setStoryStyle((prev) => ({ ...prev, y: Number(e.target.value) }))} />
              </div>
              <div className="stp-story-style-row">
                <label>{t("postSize")}</label>
                <input type="range" min="18" max="72" value={storyStyle.size} onChange={(e) => setStoryStyle((prev) => ({ ...prev, size: Number(e.target.value) }))} />
              </div>
              <button type="button" className="stp-file-btn" onClick={() => setShowStoryEmojis((v) => !v)}>😀</button>
              {showStoryEmojis ? (
                <div className="stp-emoji-panel">
                  {emojiList.map((emoji) => (
                    <button
                      key={`ed-${emoji}`}
                      type="button"
                      onClick={() => {
                        setStoryStyle((prev) => ({ ...prev, text: `${prev.text || ""}${emoji}` }));
                        setStoryBody((prev) => `${prev || ""}${emoji}`);
                      }}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              ) : null}
              <div className="stp-modal-actions">
                <button
                  type="button"
                  className="stp-btn stp-btn-ghost"
                  onClick={() => {
                    setStoryEditorOpen(false);
                    setStoryImage(null);
                    setStoryBody("");
                    setShowStoryEmojis(false);
                    setStoryStyle({ text: "", color: "#ffffff", x: 50, y: 30, size: 36 });
                    if (storyPreviewUrl) {
                      URL.revokeObjectURL(storyPreviewUrl);
                      setStoryPreviewUrl(null);
                    }
                    if (storyFileInputRef.current) {
                      storyFileInputRef.current.value = "";
                    }
                  }}
                >
                  {t("postCancel")}
                </button>
                <button type="button" className="stp-btn stp-btn-primary" onClick={publishStory} disabled={postingStory}>
                  {postingStory ? t("sending") : t("postPublishStory")}
                </button>
              </div>
            </aside>
            <div className="stp-story-editor-preview">
              <div
                ref={storyCanvasRef}
                className="stp-story-canvas stp-story-canvas--editor"
                onMouseMove={handleOverlayMouseMove}
                onMouseUp={handleOverlayMouseUp}
                onMouseLeave={handleOverlayMouseUp}
              >
                <img className="stp-story-modal-image" src={storyPreviewUrl} alt="story preview" />
                {storyStyle.text ? (
                  <div
                    className="stp-story-overlay-text"
                    onMouseDown={handleOverlayMouseDown}
                    onWheel={handleOverlayWheel}
                    style={{
                      left: `${Number(storyStyle.x)}%`,
                      top: `${Number(storyStyle.y)}%`,
                      color: storyStyle.color,
                      fontSize: `${Number(storyStyle.size)}px`,
                    }}
                  >
                    {storyStyle.text}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
