import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/axios";
import { useAuth } from "../auth/useAuth";
import { useLanguage } from "../i18n/LanguageContext";
import "./StudentFriendsPage.css";

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

export default function StudentFriendsPage() {
  const navigate = useNavigate();
  const auth = useAuth();
  const { t } = useLanguage();
  const [tab, setTab] = useState("friends");
  const [query, setQuery] = useState("");
  const [friends, setFriends] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [incoming, setIncoming] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [busyIds, setBusyIds] = useState({});
  const [notif, setNotif] = useState({ incoming: 0, accepted: 0 });
  const [notifOpen, setNotifOpen] = useState(false);

  const bgPhoto = new URL("../assets/0013e699c6346ce0eeebace3cc732028.jpg", import.meta.url).toString();

  async function loadAll() {
    setLoading(true);
    try {
      const [friendsRes, suggestionsRes, incomingRes] = await Promise.all([
        api.get("/friends/my"),
        api.get("/friends/suggestions", { params: { q: query } }),
        api.get("/friends/invitations/incoming"),
      ]);
      setFriends(friendsRes.data || []);
      setSuggestions(suggestionsRes.data || []);
      setIncoming(incomingRes.data || []);
      if (!selected && (friendsRes.data?.[0] || suggestionsRes.data?.[0])) {
        setSelected(friendsRes.data?.[0] || suggestionsRes.data?.[0] || null);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      loadAll();
    }, 220);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    let active = true;
    const loadNotif = async () => {
      try {
        const res = await api.get("/friends/notifications/summary");
        if (!active) return;
        setNotif({
          incoming: Number(res.data?.incoming_invitations || 0),
          accepted: Number(res.data?.accepted_unseen || 0),
        });
      } catch {
        if (active) setNotif({ incoming: 0, accepted: 0 });
      }
    };
    loadNotif();
    // opening friends page marks "accepted your invitation" as seen
    api.post("/friends/notifications/accepted/seen").then(loadNotif).catch(() => {});
    const id = setInterval(loadNotif, 5000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, []);

  async function handleLogout() {
    await auth.logout();
    navigate("/login");
  }

  function personBusyKey(person) {
    if (!person) return "";
    return String(person.user_id ?? person.id ?? "");
  }

  async function sendInvite(person) {
    const key = personBusyKey(person);
    if (!key) return;
    setBusyIds((p) => ({ ...p, [key]: true }));
    try {
      if (person.id) {
        await api.post("/friends/invitations", { student_id: person.id });
      } else if (person.user_id) {
        await api.post("/friends/invitations", { receiver_user_id: person.user_id });
      }
      await loadAll();
    } finally {
      setBusyIds((p) => ({ ...p, [key]: false }));
    }
  }

  async function acceptInvite(invitationId) {
    setBusyIds((p) => ({ ...p, [`inv-${invitationId}`]: true }));
    try {
      await api.post(`/friends/invitations/${invitationId}/accept`);
      await loadAll();
    } finally {
      setBusyIds((p) => ({ ...p, [`inv-${invitationId}`]: false }));
    }
  }

  async function rejectInvite(invitationId) {
    setBusyIds((p) => ({ ...p, [`inv-${invitationId}`]: true }));
    try {
      await api.post(`/friends/invitations/${invitationId}/reject`);
      await loadAll();
    } finally {
      setBusyIds((p) => ({ ...p, [`inv-${invitationId}`]: false }));
    }
  }

  function openProfile(person) {
    if (!person) return;
    if (person.id) {
      navigate(`/student/friends/${person.id}`);
      return;
    }
    if (person.user_id) {
      navigate(`/student/friends/u/${person.user_id}`);
    }
  }

  const visibleList = useMemo(() => {
    if (tab === "friends") return friends;
    if (tab === "discover") return suggestions;
    return incoming;
  }, [tab, friends, suggestions, incoming]);
  const isSelectedFriend = useMemo(
    () => !!selected?.user_id && friends.some((f) => String(f.user_id) === String(selected.user_id)),
    [selected?.user_id, friends]
  );

  function renderAvatar(person, size = 58) {
    const src = person?.profile_picture_url || resolvePublicFileUrl(person?.profile_picture);
    if (src) return <img src={src} alt={person?.name || ""} style={{ width: size, height: size }} />;
    return <span>{(person?.name || "S").slice(0, 1).toUpperCase()}</span>;
  }

  return (
    <div className="sf-page" style={{ "--sf-bg": `url(${bgPhoto})` }}>
      <div className="sf-overlay" />
      <header className="sf-topbar">
        <Link to="/" className="sf-brand">Scolarite</Link>
        <div className="sf-search">
          <span>⌕</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("sfSearchStudents")}
          />
        </div>
        <div className="sf-actions">
          <button type="button" className="sf-btn sf-btn--ghost" onClick={() => setNotifOpen((v) => !v)}>
            🔔 {(Number(notif.incoming || 0) + Number(notif.accepted || 0)) > 0 ? `(${Number(notif.incoming || 0) + Number(notif.accepted || 0)})` : ""}
          </button>
          <Link to="/student/posts" className="sf-btn sf-btn--ghost">{t("menuPost")}</Link>
          <Link to="/messages/panier" className="sf-btn sf-btn--ghost">{t("menuPanierMessages")}</Link>
          <Link to="/profile" className="sf-btn sf-btn--ghost">{t("profile")}</Link>
          <button type="button" className="sf-btn sf-btn--primary" onClick={handleLogout}>{t("logout")}</button>
        </div>
      </header>
      {notifOpen ? (
        <div className="sf-notif-panel">
          <div>Incoming friend invitations: <strong>{Number(notif.incoming || 0)}</strong></div>
          <div>Accepted invitations: <strong>{Number(notif.accepted || 0)}</strong></div>
          <div>Open posts page for likes/comments/shares/stories notifications.</div>
        </div>
      ) : null}

      <main className="sf-wrap">
        <section className="sf-left">
          <div className="sf-tabs">
            <button type="button" className={`sf-tab ${tab === "friends" ? "is-active" : ""}`} onClick={() => setTab("friends")}>
              {t("sfFriendsTab")} ({friends.length})
            </button>
            <button type="button" className={`sf-tab ${tab === "invitations" ? "is-active" : ""}`} onClick={() => setTab("invitations")}>
              {t("sfInvitationsTab")} ({incoming.length})
              {notif.incoming > 0 ? <span className="sf-red-badge">{notif.incoming}</span> : null}
            </button>
            <button type="button" className={`sf-tab ${tab === "discover" ? "is-active" : ""}`} onClick={() => setTab("discover")}>
              {t("sfDiscoverTab")}
            </button>
          </div>
          {notif.accepted > 0 ? (
            <div className="sf-accepted-note">
              {t("sfAcceptedNotice")} <span className="sf-red-badge">{notif.accepted}</span>
            </div>
          ) : null}

          <div className="sf-list">
            {loading && <p className="sf-empty">{t("sfLoading")}</p>}
            {!loading && visibleList.length === 0 && <p className="sf-empty">{t("sfNoPeople")}</p>}

            {tab !== "invitations" && visibleList.map((person) => (
              <article key={`${person.role || "u"}-${person.user_id ?? person.id}`} className="sf-item">
                <button type="button" className="sf-item-main" onClick={() => openProfile(person)}>
                  <div className="sf-avatar">{renderAvatar(person)}</div>
                  <div className="sf-info">
                    <div className="sf-name">{person.name}</div>
                    <div className="sf-sub">{person.class_name || person.matricule || "—"}</div>
                  </div>
                </button>
                {tab === "discover" && (
                  <div className="sf-item-actions">
                    {person.relation_status === "friends" && <span className="sf-pill">{t("sfFriendsState")}</span>}
                    {person.relation_status === "outgoing_pending" && <span className="sf-pill">{t("sfSentState")}</span>}
                    {person.relation_status === "incoming_pending" && <span className="sf-pill">{t("sfIncomingState")}</span>}
                    {person.relation_status === "none" && (
                      <button
                        type="button"
                        className="sf-mini-btn"
                        disabled={!!busyIds[personBusyKey(person)]}
                        onClick={() => sendInvite(person)}
                      >
                        {busyIds[personBusyKey(person)] ? "..." : t("sfAddFriend")}
                      </button>
                    )}
                  </div>
                )}
              </article>
            ))}

            {tab === "invitations" && incoming.map((inv) => (
              <article key={inv.invitation_id} className="sf-item">
                <button type="button" className="sf-item-main" onClick={() => openProfile(inv.from)}>
                  <div className="sf-avatar">{renderAvatar(inv.from)}</div>
                  <div className="sf-info">
                    <div className="sf-name">{inv.from.name}</div>
                    <div className="sf-sub">{inv.from.class_name || inv.from.matricule || "—"}</div>
                  </div>
                </button>
                <div className="sf-item-actions">
                  <button
                    type="button"
                    className="sf-mini-btn sf-mini-btn--ok"
                    disabled={!!busyIds[`inv-${inv.invitation_id}`]}
                    onClick={() => acceptInvite(inv.invitation_id)}
                  >
                    {t("sfAccept")}
                  </button>
                  <button
                    type="button"
                    className="sf-mini-btn sf-mini-btn--danger"
                    disabled={!!busyIds[`inv-${inv.invitation_id}`]}
                    onClick={() => rejectInvite(inv.invitation_id)}
                  >
                    {t("sfReject")}
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>

        <aside className="sf-right">
          {selected ? (
            <div className="sf-profile-card">
              <div className="sf-profile-head">
                <div className="sf-profile-avatar">{renderAvatar(selected, 112)}</div>
                <div>
                  <h2>{selected.name}</h2>
                  <p>{selected.email}</p>
                </div>
              </div>
              <div className="sf-profile-grid">
                <div><span>{t("sfClass")}</span><strong>{selected.class_name || "—"}</strong></div>
                <div><span>{t("sfDepartment")}</span><strong>{selected.departement || "—"}</strong></div>
                <div><span>{t("sfMatricule")}</span><strong>{selected.matricule || "—"}</strong></div>
              </div>
              {isSelectedFriend && selected?.role === "student" && selected?.id ? (
                <div className="sf-profile-actions">
                  <button
                    type="button"
                    className="sf-mini-btn sf-mini-btn--msg"
                    onClick={() => navigate(`/student/messages?friend=${selected.id}`)}
                  >
                    {t("sfSendMessage")}
                  </button>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="sf-empty-card">{t("sfSelectStudent")}</div>
          )}
        </aside>
      </main>
    </div>
  );
}
