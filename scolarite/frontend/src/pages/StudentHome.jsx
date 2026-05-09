import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "./StudentHome.css";
import { api } from "../api/axios";
import { clearAuth, getStoredRole, isAuthed } from "../auth/auth";
import { useLanguage } from "../i18n/LanguageContext";

const STUDENT_NOTIF_LAST_SEEN_KEY = "student_notifications_last_seen_at";

function toMs(v) {
  if (!v) return 0;
  const ms = new Date(v).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

export default function StudentHome() {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [sideMenuOpen, setSideMenuOpen] = useState(false);
  const [quickSearch, setQuickSearch] = useState("");
  const [notif, setNotif] = useState({ friends: 0, messages: 0, programs: 0, events: 0, internships: 0 });
  const { t } = useLanguage();

  useEffect(() => {
    const els = Array.from(document.querySelectorAll("[data-reveal]"));
    if (els.length === 0) return undefined;

    // Respect OS-level accessibility preference.
    const prefersReducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    if (prefersReducedMotion) {
      els.forEach((el) => el.classList.add("is-visible"));
      return undefined;
    }

    // Start hidden (CSS handles the initial style via .sh-reveal).
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const el = entry.target;
          el.classList.add("is-visible");
          io.unobserve(el);
        });
      },
      { root: null, threshold: 0.12, rootMargin: "0px 0px -10% 0px" }
    );

    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  // Derive auth from localStorage so refresh/back always reflect correctly.
  const authed = isAuthed();
  const userRole = getStoredRole();
  const isStudentLoggedIn = authed && userRole === "student";
  const isAdminLoggedIn = authed && userRole === "administrateur";
  const isDirecteurLoggedIn = authed && userRole === "directeur_etudes";
  const isDirecteurStageLoggedIn = authed && userRole === "directeur_stage";
  const isProfLoggedIn = authed && userRole === "professeur";
  const isStaffLoggedIn = isAdminLoggedIn || isDirecteurLoggedIn || isDirecteurStageLoggedIn || isProfLoggedIn;

  const staffDashboardTo = isAdminLoggedIn
    ? "/admin"
    : isDirecteurLoggedIn
      ? "/directeur/classes"
      : isDirecteurStageLoggedIn
        ? "/directeur-stage/internships"
      : "/professeur";
  const staffDashboardLabel = isAdminLoggedIn
    ? t("administration")
    : isDirecteurLoggedIn
      ? t("directorPortal")
      : isDirecteurStageLoggedIn
        ? "Directeur des Stage"
      : t("professorPortal");

  async function handleLogout() {
    try {
      await api.post("/logout");
    } catch {
      // Even if API logout fails, clear local auth so UI returns to normal.
    } finally {
      clearAuth();
      setMenuOpen(false);
      navigate("/", { replace: true });
    }
  }

  useEffect(() => {
    if (!isStudentLoggedIn) return undefined;
    let active = true;
    const loadNotif = async () => {
      try {
        const res = await api.get("/friends/notifications/summary");
        if (!active) return;
        setNotif((prev) => ({
          ...prev,
          friends: Number(res.data?.friends_total_notifications || 0),
          messages: Number(res.data?.messages_unread || 0),
        }));
      } catch {
        if (active) {
          setNotif((prev) => ({
            ...prev,
            friends: 0,
            messages: 0,
          }));
        }
      }
    };
    loadNotif();
    const id = setInterval(loadNotif, 5000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [isStudentLoggedIn]);

  useEffect(() => {
    if (!isStudentLoggedIn) return undefined;
    let active = true;

    const loadAcademicNotif = async () => {
      const nowIso = new Date().toISOString();
      const lastSeenRaw = localStorage.getItem(STUDENT_NOTIF_LAST_SEEN_KEY);
      const lastSeenMs = toMs(lastSeenRaw) || 0;
      try {
        const [timetableRes, examRes, eventsRes, internshipsRes] = await Promise.all([
          api.get("/student/class-documents/timetable"),
          api.get("/student/class-documents/exam_calendar"),
          api.get("/events"),
          api.get("/student/internships"),
        ]);

        if (!active) return;

        const timetableRows = Array.isArray(timetableRes.data) ? timetableRes.data : [];
        const examRows = Array.isArray(examRes.data) ? examRes.data : [];
        const eventsRows = Array.isArray(eventsRes.data) ? eventsRes.data : [];
        const internshipRows = Array.isArray(internshipsRes.data) ? internshipsRes.data : [];

        const newProgramCount = [...timetableRows, ...examRows].filter((d) => toMs(d?.created_at || d?.updated_at) > lastSeenMs).length;
        const newEventsCount = eventsRows.filter((e) => toMs(e?.created_at || e?.updated_at) > lastSeenMs).length;
        const approvedInternshipsCount = internshipRows.filter(
          (r) => r?.status === "approved" && toMs(r?.approved_at || r?.updated_at) > lastSeenMs
        ).length;

        setNotif((prev) => ({
          ...prev,
          programs: newProgramCount,
          events: newEventsCount,
          internships: approvedInternshipsCount,
        }));

        if (!lastSeenRaw) {
          localStorage.setItem(STUDENT_NOTIF_LAST_SEEN_KEY, nowIso);
        }
      } catch {
        // Keep previous academic counts on transient errors to avoid badge flicker.
      }
    };

    loadAcademicNotif();
    const id = setInterval(loadAcademicNotif, 12000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [isStudentLoggedIn]);

  function markNotificationsAsRead() {
    localStorage.setItem(STUDENT_NOTIF_LAST_SEEN_KEY, new Date().toISOString());
    setNotif((prev) => ({ ...prev, programs: 0, events: 0, internships: 0 }));
  }

  // Provided landing images (src/assets)
  // Main hero background
  // - 69000f68a70605dafc274a418ce3abc9.jpg
  // Secondary images (3)
  // - 0013e699c6346ce0eeebace3cc732028.jpg
  // - a26a83ba9fe458088a1992a8c150903c.jpg
  // - 128ae1fd2b81d9b12b3814fa2f160e90.jpg
  // Note: keep imports local so Vite bundles them.
  // eslint-disable-next-line import/no-unresolved
  const heroImg = new URL("../assets/69000f68a70605dafc274a418ce3abc9.jpg", import.meta.url).toString();
  // eslint-disable-next-line import/no-unresolved
  const aboutImg1 = new URL("../assets/0013e699c6346ce0eeebace3cc732028.jpg", import.meta.url).toString();
  // eslint-disable-next-line import/no-unresolved
  const aboutImg2 = new URL("../assets/a26a83ba9fe458088a1992a8c150903c.jpg", import.meta.url).toString();
  // eslint-disable-next-line import/no-unresolved
  const aboutImg3 = new URL("../assets/128ae1fd2b81d9b12b3814fa2f160e90.jpg", import.meta.url).toString();
  // eslint-disable-next-line import/no-unresolved
  const profileGif = new URL("../assets/profile.gif", import.meta.url).toString();
  // eslint-disable-next-line import/no-unresolved
  const aboutGif = new URL("../assets/about.gif", import.meta.url).toString();
  // eslint-disable-next-line import/no-unresolved
  const contactGif = new URL("../assets/contact.gif", import.meta.url).toString();
  // eslint-disable-next-line import/no-unresolved
  const programGif = new URL("../assets/program - Copie.gif", import.meta.url).toString();
  // eslint-disable-next-line import/no-unresolved
  const msgGif = new URL("../assets/msg.gif", import.meta.url).toString();
  // eslint-disable-next-line import/no-unresolved
  const eventsGif = new URL("../assets/events.gif", import.meta.url).toString();
  // eslint-disable-next-line import/no-unresolved
  const calendarGif = new URL("../assets/calendar.gif", import.meta.url).toString();
  // eslint-disable-next-line import/no-unresolved
  const documGif = new URL("../assets/docum.gif", import.meta.url).toString();
  // eslint-disable-next-line import/no-unresolved
  const annGif = new URL("../assets/ann.gif", import.meta.url).toString();
  // eslint-disable-next-line import/no-unresolved
  const acadGif = new URL("../assets/acad.gif", import.meta.url).toString();
  // eslint-disable-next-line import/no-unresolved
  const gradeGif = new URL("../assets/grade.gif", import.meta.url).toString();
  // eslint-disable-next-line import/no-unresolved
  const amiesGif = new URL("../assets/amies.gif", import.meta.url).toString();
  // eslint-disable-next-line import/no-unresolved
  const emptGif = new URL("../assets/empt.gif", import.meta.url).toString();
  // eslint-disable-next-line import/no-unresolved
  const calexGif = new URL("../assets/calex.gif", import.meta.url).toString();
  // eslint-disable-next-line import/no-unresolved
  const absenceGif = new URL("../assets/absence.gif", import.meta.url).toString();
  // eslint-disable-next-line import/no-unresolved
  const rattGif = new URL("../assets/ratt.gif", import.meta.url).toString();
  // eslint-disable-next-line import/no-unresolved
  const deliGif = new URL("../assets/deli.gif", import.meta.url).toString();
  // eslint-disable-next-line import/no-unresolved
  const stageGif = new URL("../assets/satge.gif", import.meta.url).toString();
  // eslint-disable-next-line import/no-unresolved
  const attpGif = new URL("../assets/attp.gif", import.meta.url).toString();
  // eslint-disable-next-line import/no-unresolved
  const postGif = new URL("./post.gif", import.meta.url).toString();

  const navLinks = useMemo(() => {
    const base = [
      { to: "/", label: t("navHome") },
      { to: "/student/about", label: t("navAbout") },
    { to: "/student/posts", label: "Post" },
      { to: "/student/contact", label: t("navContact") },
    ];
    if (isStudentLoggedIn) {
      base.splice(3, 0, { to: "/student/grades", label: t("menuGrades") });
    }
    return base;
  }, [isStudentLoggedIn, t]);

  const quickMenuItems = [
    { icon: "👤", label: t("profile"), to: "/profile", gif: profileGif, key: "profile" },
    { icon: "📝", label: t("menuPost"), to: "/student/posts", gif: postGif, key: "post" },
    { icon: "ℹ️", label: t("navAbout"), to: "/student/about", gif: aboutGif, key: "about" },
    { icon: "📚", label: t("navPrograms"), to: "/student/plans", gif: programGif, key: "programs", badge: notif.programs },
    { icon: "📊", label: t("menuGrades"), to: "/student/grades", gif: gradeGif, key: "grades" },
    { icon: "✉️", label: t("navContact"), to: "/student/contact", gif: contactGif, key: "contact" },
    { icon: "🎉", label: t("menuEvents"), to: "/student/events", gif: eventsGif, key: "events", badge: notif.events },
    { icon: "🗓️", label: t("menuCalendar"), href: "#", gif: calendarGif, key: "calendrier" },
    { icon: "💬", label: t("menuMessaging"), to: "/student/messages", gif: msgGif, key: "mesagerie", badge: notif.messages },
    { icon: "👥", label: t("menuFriends"), to: "/student/friends", gif: amiesGif, key: "amis", badge: notif.friends },
    { icon: "⏰", label: t("menuSchedule"), to: "/student/timetable", gif: emptGif, key: "emploi" },
    { icon: "📝", label: t("menuExamCalendar"), to: "/student/exam-calendar", gif: calexGif, key: "calexam" },
    { icon: "🚫", label: t("menuAbsenceNotices"), to: "/student/absences", gif: absenceGif, key: "absence" },
    { icon: "🔁", label: t("menuRetakes"), href: "#", gif: rattGif, key: "rattrapages" },
    { icon: "🏢", label: t("menuInternships"), to: "/student/internships", gif: stageGif, key: "stages", badge: notif.internships },
    { icon: "✅", label: t("menuAttendanceCert"), to: "/student/attendance-certificates", gif: attpGif, key: "attestation" },
  ];

  const filteredQuickMenuItems = useMemo(() => {
    const q = quickSearch.trim().toLowerCase();
    if (!q) return quickMenuItems;
    return quickMenuItems.filter((item) => item.label.toLowerCase().includes(q));
  }, [quickMenuItems, quickSearch]);
  const totalMenuNotifications =
    Number(notif.friends || 0) +
    Number(notif.messages || 0) +
    Number(notif.programs || 0) +
    Number(notif.events || 0) +
    Number(notif.internships || 0);

  return (
    <div className="sh-page" id="home">
      <header className="sh-nav">
        <div className="sh-nav-inner">
          <div className="sh-brand">
            <div className="sh-brand-mark" aria-hidden="true">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M4 9.5L12 4l8 5.5V20a1 1 0 0 1-1 1h-5v-7H10v7H5a1 1 0 0 1-1-1V9.5Z" fill="currentColor" opacity="0.12" />
                <path d="M4 9.5L12 4l8 5.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M7.5 21V12.5h9V21" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <span className="sh-brand-text">Scolarité</span>
          </div>

          {isStudentLoggedIn && (
            <div className="sh-inline-menu-wrap">
              <button
                type="button"
                className={`sh-side-menu-btn ${sideMenuOpen ? "is-open" : ""}`}
                onClick={() => setSideMenuOpen((v) => !v)}
                aria-label={t("menu")}
                title={t("menu")}
              >
                <span className="sh-side-menu-ico" aria-hidden="true">▦</span>
                <span className="sh-side-menu-text">{t("menu")}</span>
                {totalMenuNotifications > 0 ? (
                  <span className="sh-menu-notif-badge">{totalMenuNotifications}</span>
                ) : null}
              </button>
            </div>
          )}

          <nav className="sh-nav-links" aria-label="Primary">
            {navLinks.map((link) => (
              link.to ? (
                <Link key={link.label} to={link.to} className="sh-nav-link">
                  {link.label}
                </Link>
              ) : (
                <a key={link.href} href={link.href} className="sh-nav-link">
                  {link.label}
                </a>
              )
            ))}
          </nav>

          <div className="sh-nav-actions">
            {isStudentLoggedIn ? (
              <>
                <Link to="/profile" className="sh-btn sh-btn-ghost">
                  {t("profile")}
                </Link>
                <button type="button" className="sh-btn sh-btn-primary" onClick={handleLogout}>
                  {t("logout")}
                </button>
              </>
            ) : isStaffLoggedIn ? (
              <>
                <Link to="/change-password" className="sh-btn sh-btn-ghost">
                  {t("changePassword")}
                </Link>
                <Link to={staffDashboardTo} className="sh-btn sh-btn-primary">
                  {staffDashboardLabel}
                </Link>
                <button type="button" className="sh-btn sh-btn-ghost" onClick={handleLogout}>
                  {t("logout")}
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="sh-btn sh-btn-ghost">
                  {t("login")}
                </Link>
                <Link to="/register" className="sh-btn sh-btn-primary">
                  {t("createAccount")}
                </Link>
              </>
            )}
          </div>

          <button className="sh-menu-btn" onClick={() => setMenuOpen((v) => !v)} aria-label={t("menu")}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            {totalMenuNotifications > 0 ? (
              <span className="sh-menu-notif-badge sh-menu-notif-badge--mobile">{totalMenuNotifications}</span>
            ) : null}
          </button>
        </div>

        {menuOpen && (
          <div className="sh-mobile">
            <div className="sh-mobile-card">
              {navLinks.map((link) => (
                link.to ? (
                  <Link key={link.label} to={link.to} className="sh-mobile-link" onClick={() => setMenuOpen(false)}>
                    {link.label}
                  </Link>
                ) : (
                  <a key={link.href} href={link.href} className="sh-mobile-link" onClick={() => setMenuOpen(false)}>
                    {link.label}
                  </a>
                )
              ))}
              <div className="sh-mobile-actions">
                {isStudentLoggedIn ? (
                  <>
                    <Link to="/profile" className="sh-btn sh-btn-ghost" onClick={() => setMenuOpen(false)}>
                      {t("profile")}
                    </Link>
                    <button type="button" className="sh-btn sh-btn-primary" onClick={handleLogout}>
                      {t("logout")}
                    </button>
                  </>
                ) : isStaffLoggedIn ? (
                  <>
                    <Link to="/change-password" className="sh-btn sh-btn-ghost" onClick={() => setMenuOpen(false)}>
                      {t("changePassword")}
                    </Link>
                    <Link to={staffDashboardTo} className="sh-btn sh-btn-primary" onClick={() => setMenuOpen(false)}>
                      {staffDashboardLabel}
                    </Link>
                    <button type="button" className="sh-btn sh-btn-ghost" onClick={() => { setMenuOpen(false); handleLogout(); }}>
                      {t("logout")}
                    </button>
                  </>
                ) : (
                  <>
                    <Link to="/login" className="sh-btn sh-btn-ghost" onClick={() => setMenuOpen(false)}>
                      {t("login")}
                    </Link>
                    <Link to="/register" className="sh-btn sh-btn-primary" onClick={() => setMenuOpen(false)}>
                      {t("createAccount")}
                    </Link>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </header>
      {isStudentLoggedIn && (
        <>
          <button
            type="button"
            aria-label="Close menu"
            className={`sh-drawer-backdrop ${sideMenuOpen ? "is-open" : ""}`}
            onClick={() => setSideMenuOpen(false)}
          />
          <aside className={`sh-drawer ${sideMenuOpen ? "is-open" : ""}`} aria-hidden={!sideMenuOpen}>
            <div className="sh-drawer-head">
              <div className="sh-drawer-title">{t("menu")}</div>
              <button type="button" className="sh-drawer-close" onClick={() => setSideMenuOpen(false)}>✕</button>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
              <p className="sh-drawer-subtitle">{t("quickAccess")}</p>
              <button
                type="button"
                className="sh-side-menu-link"
                onClick={markNotificationsAsRead}
                style={{ padding: "6px 10px", fontSize: 12 }}
              >
                Mark notifications as read
              </button>
            </div>
            <form
              className="sh-drawer-search"
              onSubmit={(e) => {
                e.preventDefault();
              }}
            >
              <input
                type="text"
                placeholder={t("searchQuickLinks")}
                aria-label="Search quick links"
                value={quickSearch}
                onChange={(e) => setQuickSearch(e.target.value)}
              />
              <button type="submit">{t("go")}</button>
            </form>

            <div className="sh-drawer-scroll">
              <div className="sh-drawer-grid">
                {filteredQuickMenuItems.map((item, idx) => (
                  item.to ? (
                  <Link key={item.label} to={item.to} className={`sh-drawer-card sh-drawer-card--tone-${(idx % 6) + 1} ${item.gif ? "sh-drawer-card--gif" : ""} ${item.key === "profile" ? "sh-drawer-card--profile" : ""}`} onClick={() => setSideMenuOpen(false)}>
                      <div className="sh-drawer-card-top">
                        {item.gif ? (
                          <img className="sh-drawer-card-gif" src={item.gif} alt={item.label} />
                        ) : (
                          <span className="sh-drawer-card-ico">{item.icon}</span>
                        )}
                        {item.badge > 0 ? <span className="sh-drawer-card-notif">{item.badge}</span> : null}
                        <span className="sh-drawer-card-plus">+</span>
                      </div>
                      <span className="sh-drawer-card-label">{item.label}</span>
                      <span className="sh-drawer-card-btn">{t("view")}</span>
                    </Link>
                  ) : (
                    <a key={item.label} href={item.href} className={`sh-drawer-card sh-drawer-card--tone-${(idx % 6) + 1} ${item.gif ? "sh-drawer-card--gif" : ""}`} onClick={() => setSideMenuOpen(false)}>
                      <div className="sh-drawer-card-top">
                        {item.gif ? (
                          <img className="sh-drawer-card-gif" src={item.gif} alt={item.label} />
                        ) : (
                          <span className="sh-drawer-card-ico">{item.icon}</span>
                        )}
                        {item.badge > 0 ? <span className="sh-drawer-card-notif">{item.badge}</span> : null}
                        <span className="sh-drawer-card-plus">+</span>
                      </div>
                      <span className="sh-drawer-card-label">{item.label}</span>
                      <span className="sh-drawer-card-btn">{t("view")}</span>
                    </a>
                  )
                ))}
              </div>
              {filteredQuickMenuItems.length === 0 && (
                <p style={{ margin: "10px 2px 0", color: "rgba(15, 23, 42, 0.6)", fontSize: 13 }}>
                  {t("noQuickMatch")}
                </p>
              )}
            </div>

            <button type="button" className="sh-drawer-logout" onClick={handleLogout}>
              {t("logout")}
            </button>
          </aside>
        </>
      )}

      <main>
        <section className="sh-hero" style={{ "--sh-hero-img": `url(${heroImg})` }}>
          <div className="sh-hero-overlay" aria-hidden="true" />
          <div className="sh-hero-inner">
            <div className="sh-hero-left">
              <div className="sh-pill">{t("heroPill")}</div>
              <h1 className="sh-hero-title">{t("heroTitle")}</h1>
              <p className="sh-hero-subtitle">
                {t("heroSubtitle")}
              </p>
              <div className="sh-hero-cta">
                {isStudentLoggedIn ? (
                  <Link to="/profile" className="sh-btn sh-btn-primary sh-btn-lg">
                    {t("goToProfile")}
                  </Link>
                ) : isStaffLoggedIn ? (
                  <Link to={staffDashboardTo} className="sh-btn sh-btn-primary sh-btn-lg">
                    {staffDashboardLabel}
                  </Link>
                ) : (
                  <Link to="/login" className="sh-btn sh-btn-primary sh-btn-lg">
                    {t("getStarted")}
                  </Link>
                )}
                <Link to="/student/about" className="sh-btn sh-btn-ghost sh-btn-lg">
                  {t("learnMore")}
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section className="sh-features sh-reveal" id="programs" data-reveal>
          <div className="sh-container">
            <div className="sh-feature-grid">
              <div className="sh-feature sh-reveal sh-reveal--delay-1" data-reveal>
                <div className="sh-feature-ico" aria-hidden="true">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 3l9 6-9 6-9-6 9-6Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                    <path d="M3 9v8l9 6 9-6V9" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" opacity="0.9" />
                  </svg>
                </div>
                <div className="sh-feature-title">{t("classManagement")}</div>
                <div className="sh-feature-text">{t("classManagementText")}</div>
              </div>

              <div className="sh-feature sh-reveal sh-reveal--delay-2" data-reveal>
                <div className="sh-feature-ico" aria-hidden="true">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M7 7h10M7 12h10M7 17h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    <path d="M5 4h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H8l-3 3V6a2 2 0 0 1 2-2Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" opacity="0.9" />
                  </svg>
                </div>
                <div className="sh-feature-title">{t("studyPlans")}</div>
                <div className="sh-feature-text">{t("studyPlansText")}</div>
              </div>

              <div className="sh-feature sh-reveal sh-reveal--delay-3" data-reveal>
                <div className="sh-feature-ico" aria-hidden="true">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 2l8 4v6c0 5-3.5 9-8 10-4.5-1-8-5-8-10V6l8-4Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                    <path d="M9 12l2 2 4-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <div className="sh-feature-title">{t("secureAccess")}</div>
                <div className="sh-feature-text">{t("secureAccessText")}</div>
              </div>
            </div>
          </div>
        </section>

        <section className="sh-about sh-reveal" id="about" data-reveal>
          <div className="sh-container sh-about-grid">
            <div className="sh-collage sh-reveal sh-reveal--delay-1" aria-label="Campus photos" data-reveal>
              <div className="sh-collage-ring" aria-hidden="true" />
              <img className="sh-img sh-img-lg" src={aboutImg1} alt="Campus" loading="lazy" />
              <img className="sh-img sh-img-sm1" src={aboutImg2} alt="Students" loading="lazy" />
              <img className="sh-img sh-img-sm2" src={aboutImg3} alt="Learning" loading="lazy" />
            </div>

            <div className="sh-about-copy sh-reveal sh-reveal--delay-2" data-reveal>
              <div className="sh-section-kicker">{t("aboutPlatform")}</div>
              <h2 className="sh-section-title">{t("aboutTitle")}</h2>
              <p className="sh-section-text">
                {t("aboutText")}
              </p>
              <ul className="sh-checklist">
                <li>{t("aboutItem1")}</li>
                <li>{t("aboutItem2")}</li>
                <li>{t("aboutItem3")}</li>
              </ul>
              <Link className="sh-btn sh-btn-primary" to="/student/contact">
                {t("contactUs")}
              </Link>
            </div>
          </div>
        </section>

        <footer className="sh-footer sh-reveal" id="contact" data-reveal>
          <div className="sh-container sh-footer-inner">
            <div className="sh-footer-left">
              <div className="sh-footer-brand">Scolarité</div>
              <div className="sh-footer-text">{t("footerText")}</div>
            </div>
            <div className="sh-footer-right">
              {isStudentLoggedIn ? (
                <>
                  <Link to="/profile" className="sh-footer-link">
                    {t("profile")}
                  </Link>
                  <button type="button" className="sh-footer-link" onClick={handleLogout}>
                    {t("logout")}
                  </button>
                </>
              ) : isStaffLoggedIn ? (
                <>
                  <Link to="/change-password" className="sh-footer-link">
                    {t("changePassword")}
                  </Link>
                  <Link to={staffDashboardTo} className="sh-footer-link">
                    {staffDashboardLabel}
                  </Link>
                  <button type="button" className="sh-footer-link" onClick={handleLogout}>
                    {t("logout")}
                  </button>
                </>
              ) : (
                <>
                  <Link to="/login" className="sh-footer-link">
                    {t("login")}
                  </Link>
                  <Link to="/register" className="sh-footer-link">
                    {t("register")}
                  </Link>
                </>
              )}
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}