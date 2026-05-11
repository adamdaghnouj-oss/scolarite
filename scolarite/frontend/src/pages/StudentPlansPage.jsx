import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/axios";
import { useLanguage } from "../i18n/LanguageContext";
import { useAuth } from "../auth/useAuth";
import "./StudentPlansPage.css";

export default function StudentPlansPage() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const auth = useAuth();
  const topHeroGif = new URL("../assets/ca262e0354eea311c41134c3e4bc3bc2.gif", import.meta.url).toString();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [classId, setClassId] = useState(null);
  const [affectations, setAffectations] = useState([]);
  const [selectedPlanId, setSelectedPlanId] = useState(null);
  const [planTree, setPlanTree] = useState(null);
  const [treeLoading, setTreeLoading] = useState(false);

  async function handleLogout() {
    await auth.logout();
    navigate("/login");
  }

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError("");
      try {
        const profileRes = await api.get("/student/profile");
        const profile = profileRes.data?.profile || {};
        let classFromProfile = profile.class_id || null;

        // Fallback: some student rows store only `classe` (name like IT11) without `class_id`.
        if (!classFromProfile && profile.classe) {
          try {
            const classesRes = await api.get("/classes");
            const resolved = (classesRes.data || []).find(
              (c) => String(c.name || "").trim().toLowerCase() === String(profile.classe || "").trim().toLowerCase()
            );
            if (resolved?.id) classFromProfile = resolved.id;
          } catch {
            // keep null if we cannot resolve
          }
        }

        setClassId(classFromProfile);

        if (!classFromProfile) {
          setAffectations([]);
          setLoading(false);
          return;
        }

        const affRes = await api.get("/plan-etudes/affectations", {
          params: { class_id: classFromProfile },
        });
        const list = affRes.data || [];
        setAffectations(list);
        if (list.length > 0) {
          const firstPlanId = list[0]?.plan_etude?.id || list[0]?.plan_etude_id || null;
          setSelectedPlanId(firstPlanId);
        }
      } catch (err) {
        setError(err.response?.data?.message || "Failed to load your class plans.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  useEffect(() => {
    async function loadTree() {
      if (!selectedPlanId) {
        setPlanTree(null);
        return;
      }
      setTreeLoading(true);
      try {
        const res = await api.get(`/plan-etudes/plans/${selectedPlanId}`);
        setPlanTree(res.data);
      } catch {
        setPlanTree(null);
      } finally {
        setTreeLoading(false);
      }
    }
    loadTree();
  }, [selectedPlanId]);

  const activeAffectations = useMemo(
    () => affectations.filter((a) => (a?.plan_etude?.is_active ?? true) === true),
    [affectations]
  );

  if (loading) {
    return <div className="spn-wrap"><p>Loading plans...</p></div>;
  }

  return (
    <div className="spn-wrap">
      <header className="spn-topnav">
        <div className="spn-topnav-inner">
          <div className="spn-brand">
            <div className="spn-brand-mark" aria-hidden="true">S</div>
            <span>Scolarité</span>
          </div>

          <nav className="spn-links" aria-label="Primary">
            <Link to="/">{t("navHome")}</Link>
            <Link to="/student/about">{t("navAbout")}</Link>
            <Link to="/student/plans" className="is-active">{t("navPrograms")}</Link>
            <Link to="/student/contact">{t("navContact")}</Link>
          </nav>

          <div className="spn-actions">
            <Link to="/profile" className="spn-btn spn-btn-ghost">{t("profile")}</Link>
            <button type="button" className="spn-btn spn-btn-primary" onClick={handleLogout}>{t("logout")}</button>
          </div>
        </div>
      </header>

      <div className="spn-header">
        <div>
          <h1>{t("navPrograms")}</h1>
          <p>Plans assigned to your class</p>
        </div>
        <Link to="/" className="spn-back">← {t("navHome")}</Link>
      </div>

      <section className="spn-hero" style={{ "--spn-hero-img": `url(${topHeroGif})` }}>
        <div className="spn-hero-overlay" />
        <div className="spn-hero-copy">
          <p className="spn-hero-kicker">{t("navPrograms")}</p>
          <h2>Find the right study plan for your class</h2>
        </div>
      </section>

      {error ? <p className="spn-error">{error}</p> : null}
      {!classId ? <p className="spn-empty">Your profile is not linked to a class yet.</p> : null}

      {classId && (
        <div className="spn-grid">
          <aside className="spn-list">
            <h2>Assigned plans</h2>
            {activeAffectations.length === 0 ? (
              <p className="spn-empty">No plan assigned to your class yet.</p>
            ) : (
              activeAffectations.map((a) => {
                const pid = a?.plan_etude?.id || a?.plan_etude_id;
                return (
                  <button
                    key={a.id}
                    type="button"
                    className={`spn-plan-item ${selectedPlanId === pid ? "is-active" : ""}`}
                    onClick={() => setSelectedPlanId(pid)}
                  >
                    <div className="spn-plan-title">
                      {a?.plan_etude?.specialite?.name || "Plan"}
                    </div>
                    <div className="spn-plan-sub">
                      {a?.plan_etude?.semestre?.label || ""} • {a?.annee_scolaire || ""}
                    </div>
                  </button>
                );
              })
            )}
          </aside>

          <main className="spn-details">
            {treeLoading ? (
              <p>Loading plan details...</p>
            ) : !planTree ? (
              <p className="spn-empty">Select a plan to view details.</p>
            ) : (
              <>
                <h2>{planTree?.title || "Plan details"}</h2>
                <p className="spn-meta">
                  {planTree?.specialite?.departement || "—"} • {planTree?.specialite?.name || "—"} • {planTree?.semestre?.label || ""}
                </p>

                <div className="spn-tree">
                  {(planTree.paniers || []).map((panier) => (
                    <div key={panier.id} className="spn-panier">
                      <h3>{panier.name}</h3>
                      {(panier.modules || []).length === 0 ? (
                        <p className="spn-empty">No modules.</p>
                      ) : (
                        (panier.modules || []).map((m) => (
                          <div key={m.id} className="spn-module">
                            <div className="spn-module-head">
                              <strong>{m.code ? `${m.code} - ` : ""}{m.name}</strong>
                              <span>Coef {m.coefficient}</span>
                            </div>
                            <ul>
                              {(m.evaluations || []).map((ev) => (
                                <li key={ev.id}>{ev.type} {ev.weight !== null && ev.weight !== undefined ? `(${ev.weight}%)` : ""}</li>
                              ))}
                            </ul>
                          </div>
                        ))
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
          </main>
        </div>
      )}
    </div>
  );
}
