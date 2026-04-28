import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/axios";
import { clearAuth } from "../auth/auth";
import { useLanguage } from "../i18n/LanguageContext";
import heroImage from "../assets/0013e699c6346ce0eeebace3cc732028.jpg";
import "./StudentAboutPage.css";

export default function StudentAboutPage() {
  const navigate = useNavigate();
  const { t } = useLanguage();

  const scenes = useMemo(
    () => [
      {
        title: "What is Scolarite",
        subtitle: "A connected campus platform for student life",
        leftLabel: "Core mission",
        leftText: "Unify study planning, communication, profile management, and support services in one clean workspace.",
        rightLabel: "User impact",
        rightText: "Students gain clarity, professors coordinate teaching faster, and administration responds with less friction.",
      },
      {
        title: "Academic Workflow",
        subtitle: "From class assignment to study plan visibility",
        leftLabel: "Class intelligence",
        leftText: "Role-aware views expose only the right information while preserving a simple and focused experience.",
        rightLabel: "Operational value",
        rightText: "Reduced manual tracking and better consistency in class structure, modules, and academic progress.",
      },
      {
        title: "Communication Layer",
        subtitle: "Fast messaging and direct student-admin support",
        leftLabel: "Student contacts",
        leftText: "The contact module creates direct channels to administration with traceable replies and clear status.",
        rightLabel: "Collaboration",
        rightText: "Social posts, friends, and message spaces help users collaborate naturally around campus life.",
      },
      {
        title: "Scalable Foundation",
        subtitle: "Designed to evolve with your institution",
        leftLabel: "Security model",
        leftText: "Role-based routes and controlled data access protect sensitive operations and student records.",
        rightLabel: "Roadmap",
        rightText: "Future modules can extend analytics, alerts, scheduling, and digital services without redesigning the core.",
      },
    ],
    []
  );

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
    <div className="sab-page">
      <header className="sab-nav">
        <div className="sab-nav-inner">
          <div className="sab-brand">Scolarite</div>
          <nav className="sab-links">
            <Link to="/">{t("navHome")}</Link>
            <Link to="/student/about" className="is-active">{t("navAbout")}</Link>
            <Link to="/student/contact">{t("navContact")}</Link>
            <Link to="/student/posts">Post</Link>
          </nav>
          <button type="button" className="sab-logout" onClick={handleLogout}>{t("logout")}</button>
        </div>
      </header>

      <main>
        <section className="sab-hero">
          <div className="sab-hero-inner">
            <div className="sab-hero-surface">
              <div className="sab-hero-copy">
                <p className="sab-hero-kicker">About us</p>
                <h1 className="sab-hero-title">About our platform</h1>
                <p className="sab-hero-sub">
                  We bring student experience, professor workflows, and administrative operations into one clean, secure
                  campus workspace.
                </p>
              </div>

              <div className="sab-hero-model" aria-hidden="true">
                <img className="sab-hero-image" src={heroImage} alt="" loading="eager" />
              </div>
            </div>
          </div>
        </section>

        <section id="story" className="sab-story">
          <div className="sab-scenes">
            {scenes.map((scene) => (
              <section className="sab-scene" key={scene.title}>
                <div className="sab-scene-head">
                  <p className="sab-scene-kicker">{scene.subtitle}</p>
                  <h2>{scene.title}</h2>
                </div>
                <div className="sab-story-pair">
                  <article className="sab-side-card">
                    <h3>{scene.leftLabel}</h3>
                    <p>{scene.leftText}</p>
                  </article>
                  <article className="sab-side-card">
                    <h3>{scene.rightLabel}</h3>
                    <p>{scene.rightText}</p>
                  </article>
                </div>
              </section>
            ))}
          </div>
        </section>

        <section className="sab-why">
          <div className="sab-grid">
            <article>
              <h2>Why we built it</h2>
              <p>
                Students needed one simple, modern, and secure place to manage academic and social workflows without
                jumping between many disconnected tools.
              </p>
            </article>
            <article>
              <h2>What it offers</h2>
              <p>
                User management, profile validation, study plans, class communication, messaging, posts, events,
                and role-based dashboards for each actor.
              </p>
            </article>
            <article>
              <h2>Our design vision</h2>
              <p>
                Fast, clean, and immersive interactions inspired by premium digital products while staying practical
                for daily university use.
              </p>
            </article>
            <article>
              <h2>Who benefits</h2>
              <p>
                Students access their full academic path, professors manage teaching context efficiently, and
                administrators gain a clear operational view.
              </p>
            </article>
            <article>
              <h2>Student support flow</h2>
              <p>
                The new contact module allows direct student-to-admin communication with traceable replies and
                organized follow-up in dedicated dashboards.
              </p>
            </article>
            <article>
              <h2>Future roadmap</h2>
              <p>
                Upcoming improvements include deeper analytics, smarter notifications, and expanded self-service tools
                to reduce manual administrative workload.
              </p>
            </article>
          </div>
        </section>
      </main>
    </div>
  );
}
