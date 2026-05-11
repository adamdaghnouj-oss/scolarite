import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../api/axios";
import "./AdminPanel.css";
import { useLanguage } from "../i18n/LanguageContext";
import StaffSidebar from "../components/StaffSidebar";

const EMPTY_SPECIALITE = { departement: "", code: "", name: "" };
const EMPTY_PLAN = { departement: "", class_ids: [], semestre_id: "", title: "", version: 1, is_active: true };
const EMPTY_PANIER = { name: "", ordre: 0 };
const EMPTY_MODULE = { code: "", name: "", coefficient: 1, ordre: 0 };
const EMPTY_EVAL = { type: "ds", weight: "", ordre: 0 };
const EMPTY_AFFECT = { class_ids: [], annee_scolaire: "", departement: "" };

function normalize(s) {
  return String(s ?? "").trim().toLowerCase();
}

function classLevelLabel(value) {
  if (value === "first") return "1ere annee";
  if (value === "second") return "2eme annee";
  if (value === "third_pfe") return "3eme annee (PFE)";
  return "Niveau non defini";
}

export default function DirecteurPlansPage() {
  const { language } = useLanguage();
  const tr = (en, fr) => (language === "fr" ? fr : en);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [semestres, setSemestres] = useState([]);
  const [specialites, setSpecialites] = useState([]);
  const [plans, setPlans] = useState([]);
  const [classes, setClasses] = useState([]);
  const [affectations, setAffectations] = useState([]);

  const [filters, setFilters] = useState({ departement: "", specialite_id: "", semestre_id: "" });
  const [q, setQ] = useState("");

  const [selectedPlanId, setSelectedPlanId] = useState(null);
  const [planTree, setPlanTree] = useState(null);
  const [treeLoading, setTreeLoading] = useState(false);

  const [modal, setModal] = useState(null); // 'specialite' | 'plan' | 'panier' | 'module' | 'eval' | 'affect' | null
  const [formError, setFormError] = useState("");

  const [specialiteForm, setSpecialiteForm] = useState(EMPTY_SPECIALITE);
  const [planForm, setPlanForm] = useState(EMPTY_PLAN);
  const [panierForm, setPanierForm] = useState(EMPTY_PANIER);
  const [moduleForm, setModuleForm] = useState(EMPTY_MODULE);
  const [evalForm, setEvalForm] = useState(EMPTY_EVAL);
  const [affectForm, setAffectForm] = useState(EMPTY_AFFECT);

  const [context, setContext] = useState({ planId: null, panierId: null, moduleId: null });

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      // ensure semesters exist (safe)
      await api.post("/plan-etudes/semestres/seed");

      const [sem, specs, cls] = await Promise.all([
        api.get("/plan-etudes/semestres"),
        api.get("/plan-etudes/specialites"),
        api.get("/plan-etudes/classes"),
      ]);
      setSemestres(sem.data);
      setSpecialites(specs.data);
      setClasses(cls.data);
    } catch (e) {
      setError(e.response?.data?.message || tr("Failed to load reference data.", "Echec du chargement des donnees de reference."));
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchPlans = useCallback(async () => {
    try {
      const params = { active: true };
      if (filters.specialite_id) params.specialite_id = filters.specialite_id;
      if (filters.semestre_id) params.semestre_id = filters.semestre_id;
      const res = await api.get("/plan-etudes/plans", { params });
      setPlans(res.data);
    } catch {
      setPlans([]);
    }
  }, [filters.specialite_id, filters.semestre_id]);

  const fetchAffectations = useCallback(async () => {
    try {
      const res = await api.get("/plan-etudes/affectations");
      setAffectations(res.data);
    } catch {
      setAffectations([]);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    fetchPlans();
    fetchAffectations();
  }, [fetchPlans, fetchAffectations]);

  const specialitesFiltered = useMemo(() => {
    const dep = normalize(filters.departement);
    if (!dep) return specialites;
    return specialites.filter((s) => normalize(s.departement) === dep);
  }, [specialites, filters.departement]);

  const plansFiltered = useMemo(() => {
    const nq = normalize(q);
    return (plans ?? []).filter((p) => {
      if (!nq) return true;
      const sp = p.specialite?.name || "";
      const dep = p.specialite?.departement || "";
      const title = p.title || "";
      return normalize(sp).includes(nq) || normalize(dep).includes(nq) || normalize(title).includes(nq);
    });
  }, [plans, q]);

  const selectedPlan = useMemo(() => plans.find((p) => p.id === selectedPlanId) ?? null, [plans, selectedPlanId]);

  const openModal = (id) => {
    setFormError("");
    setModal(id);
  };

  const closeModal = () => {
    setFormError("");
    setModal(null);
    setContext({ planId: null, panierId: null, moduleId: null });
  };

  const loadPlanTree = useCallback(async (planId) => {
    setTreeLoading(true);
    try {
      const res = await api.get(`/plan-etudes/plans/${planId}`);
      setPlanTree(res.data);
    } catch {
      setPlanTree(null);
    } finally {
      setTreeLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedPlanId) loadPlanTree(selectedPlanId);
  }, [selectedPlanId, loadPlanTree]);

  async function submitSpecialite(e) {
    e.preventDefault();
    setFormError("");
    try {
      const res = await api.post("/plan-etudes/specialites", specialiteForm);
      setSpecialites((prev) => [...prev, res.data]);
      closeModal();
    } catch (err) {
      const d = err.response?.data;
      setFormError(d?.message || (d?.errors ? Object.values(d.errors).flat().join(" ") : "Failed to create specialite."));
    }
  }

  async function submitPlan(e) {
    e.preventDefault();
    setFormError("");
    try {
      if (!planForm.class_ids?.length) {
        setFormError("Please select at least one class.");
        return;
      }

      const createdPlans = [];
      const newSpecialites = [];
      const desiredVersion = Number(planForm.version || 1);

      for (const classId of planForm.class_ids) {
        const selectedClass = classes.find((c) => String(c.id) === String(classId));
        if (!selectedClass) continue;

        let resolvedSpecialite = specialites.find(
          (s) => normalize(s.departement) === normalize(selectedClass.departement) && normalize(s.name) === normalize(selectedClass.name)
        );

        // Auto-create speciality from selected class when missing.
        if (!resolvedSpecialite) {
          const created = await api.post("/plan-etudes/specialites", {
            departement: selectedClass.departement || "General",
            code: "",
            name: selectedClass.name,
          });
          resolvedSpecialite = created.data;
          newSpecialites.push(created.data);
        }

        // Ensure unique (specialite, semestre, version). If desired version exists, use next free one.
        const existingRes = await api.get("/plan-etudes/plans", {
          params: {
            specialite_id: Number(resolvedSpecialite.id),
            semestre_id: Number(planForm.semestre_id),
          },
        });
        const existingVersions = new Set((existingRes.data || []).map((p) => Number(p.version)));
        let finalVersion = desiredVersion;
        while (existingVersions.has(finalVersion)) {
          finalVersion += 1;
        }

        const payload = {
          specialite_id: Number(resolvedSpecialite.id),
          semestre_id: Number(planForm.semestre_id),
          title: planForm.title,
          version: finalVersion,
          is_active: !!planForm.is_active,
        };
        const res = await api.post("/plan-etudes/plans", payload);
        createdPlans.push(res.data);
      }

      if (newSpecialites.length) {
        setSpecialites((prev) => [...prev, ...newSpecialites]);
      }
      if (createdPlans.length) {
        setPlans((prev) => [...createdPlans, ...prev]);
        setSelectedPlanId(createdPlans[0].id);
      }
      closeModal();
    } catch (err) {
      const d = err.response?.data;
      setFormError(d?.message || (d?.errors ? Object.values(d.errors).flat().join(" ") : "Failed to create plan."));
    }
  }

  async function submitPanier(e) {
    e.preventDefault();
    setFormError("");
    try {
      const res = await api.post(`/plan-etudes/plans/${context.planId}/paniers`, {
        name: panierForm.name,
        ordre: Number(panierForm.ordre || 0),
      });
      await loadPlanTree(context.planId);
      closeModal();
      return res.data;
    } catch (err) {
      const d = err.response?.data;
      setFormError(d?.message || (d?.errors ? Object.values(d.errors).flat().join(" ") : "Failed to add panier."));
      return null;
    }
  }

  async function submitModule(e) {
    e.preventDefault();
    setFormError("");
    try {
      await api.post(`/plan-etudes/paniers/${context.panierId}/modules`, {
        code: moduleForm.code || null,
        name: moduleForm.name,
        coefficient: Number(moduleForm.coefficient),
        ordre: Number(moduleForm.ordre || 0),
      });
      await loadPlanTree(context.planId);
      closeModal();
    } catch (err) {
      const d = err.response?.data;
      setFormError(d?.message || (d?.errors ? Object.values(d.errors).flat().join(" ") : "Failed to add module."));
    }
  }

  async function submitEval(e) {
    e.preventDefault();
    setFormError("");
    try {
      const weightVal = evalForm.weight === "" ? null : Number(evalForm.weight);
      await api.post(`/plan-etudes/paniers/${context.panierId}/evaluations`, {
        type: evalForm.type,
        weight: weightVal,
        ordre: Number(evalForm.ordre || 0),
      });
      await loadPlanTree(context.planId);
      closeModal();
    } catch (err) {
      const d = err.response?.data;
      setFormError(d?.message || (d?.errors ? Object.values(d.errors).flat().join(" ") : "Failed to add evaluation."));
    }
  }

  async function submitAffect(e) {
    e.preventDefault();
    setFormError("");
    try {
      if (!affectForm.class_ids.length) {
        setFormError("Please select at least one class.");
        return;
      }

      const payload = {
        plan_etude_id: Number(context.planId),
        annee_scolaire: affectForm.annee_scolaire,
      };

      const createdAffects = await Promise.all(
        affectForm.class_ids.map((classId) =>
          api.post("/plan-etudes/affectations", { ...payload, class_id: Number(classId) }).then((r) => r.data)
        )
      );
      setAffectations((prev) => [...createdAffects, ...prev]);
      closeModal();
    } catch (err) {
      const d = err.response?.data;
      setFormError(d?.message || (d?.errors ? Object.values(d.errors).flat().join(" ") : "Failed to assign plan to classes."));
    }
  }

  async function quickDelete(url, after) {
    if (!confirm("Are you sure?")) return;
    try {
      await api.delete(url);
      await after();
    } catch {
      alert("Delete failed.");
    }
  }

  async function deletePlanWithDependencies(planId) {
    // Remove affectations linked to this plan first.
    const linkedAffects = (affectations || []).filter((a) => Number(a.plan_etude_id) === Number(planId));
    for (const a of linkedAffects) {
      await api.delete(`/plan-etudes/affectations/${a.id}`);
    }

    // Remove plan tree (evaluations on panier -> modules -> paniers).
    const planRes = await api.get(`/plan-etudes/plans/${planId}`);
    const paniers = planRes.data?.paniers || [];
    for (const panier of paniers) {
      for (const ev of panier.evaluations || []) {
        await api.delete(`/plan-etudes/evaluations/${ev.id}`);
      }
      for (const mod of panier.modules || []) {
        await api.delete(`/plan-etudes/modules/${mod.id}`);
      }
      await api.delete(`/plan-etudes/paniers/${panier.id}`);
    }

    // Soft-delete the plan itself (DELETE route is not supported by backend).
    await api.put(`/plan-etudes/plans/${planId}`, { is_active: false });
  }

  const classLabel = (c) => `${c.annee_scolaire || "—"} • ${c.departement || "—"} • ${c.name} • ${classLevelLabel(c.niveau)}`;

  return (
    <div className="admin-wrap">
      <StaffSidebar variant="directeur" />

      <main className="admin-main">
        <header className="admin-topbar">
          <div>
            <h1 className="admin-title">{tr("Study plans", "Plans d'etude")}</h1>
            <p className="admin-subtitle">
              {tr(
                "Each plan has paniers (subject groups). Evaluations (DS, exam, TP) are defined once per panier. Modules under a panier carry coefficients and structure.",
                "Chaque plan a des paniers (groupes de matieres). Les evaluations (DS, examen, TP) sont definies une fois par panier. Les modules portent les coefficients et la structure."
              )}
            </p>
          </div>
          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <button type="button" className="admin-secondary-btn" onClick={() => { fetchAll(); fetchPlans(); fetchAffectations(); }}>
              {tr("Refresh", "Actualiser")}
            </button>
            <button
              type="button"
              className="admin-primary-btn"
              onClick={() => {
                setPlanForm({
                  ...EMPTY_PLAN,
                  departement: filters.departement || "",
                  semestre_id: filters.semestre_id || "",
                });
                openModal("plan");
              }}
            >
              + Plan (Semestre)
            </button>
          </div>
        </header>

        {error && <p style={{ color: "red", padding: "0 6px" }}>{error}</p>}

        <section className="admin-card" style={{ marginBottom: 14 }}>
          <div className="admin-toolbar">
            <div className="admin-search">
              <span className="admin-search-icon" aria-hidden="true">⌕</span>
              <input className="admin-input admin-input--search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher..." />
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <select
                className="admin-input"
                value={filters.departement}
                onChange={(e) => setFilters((p) => ({ ...p, departement: e.target.value, specialite_id: "" }))}
                style={{ width: 220 }}
              >
                <option value="">Tous départements</option>
                {Array.from(new Set(specialites.map((s) => s.departement))).sort().map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
              <select
                className="admin-input"
                value={filters.specialite_id}
                onChange={(e) => setFilters((p) => ({ ...p, specialite_id: e.target.value }))}
                style={{ width: 260 }}
              >
                <option value="">Toutes spécialités</option>
                {specialitesFiltered.map((s) => (
                  <option key={s.id} value={s.id}>{s.code ? `${s.code} — ` : ""}{s.name}</option>
                ))}
              </select>
              <select
                className="admin-input"
                value={filters.semestre_id}
                onChange={(e) => setFilters((p) => ({ ...p, semestre_id: e.target.value }))}
                style={{ width: 160 }}
              >
                <option value="">Tous semestres</option>
                {semestres.map((s) => (
                  <option key={s.id} value={s.id}>{s.label || `S${s.number}`}</option>
                ))}
              </select>
            </div>
          </div>
        </section>

        <div style={{ display: "grid", gridTemplateColumns: "380px 1fr", gap: 14 }}>
          {/* Left: plans list */}
          <section className="admin-card">
            <div style={{ padding: "14px 14px 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontWeight: 800, color: "#0f172a" }}>Plans</div>
              <div style={{ color: "#64748b", fontSize: 12 }}>{plansFiltered.length} items</div>
            </div>
            <div className="admin-table-wrap" style={{ paddingTop: 10 }}>
              {loading ? (
                <p style={{ padding: "1rem", textAlign: "center" }}>Loading...</p>
              ) : plansFiltered.length === 0 ? (
                <p style={{ padding: "1rem", textAlign: "center", color: "#64748b" }}>Aucun plan.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column" }}>
                  {plansFiltered.map((p) => (
                    <div
                      key={p.id}
                      style={{
                        background: selectedPlanId === p.id ? "#eff6ff" : "white",
                        borderBottom: "1px solid #f1f5f9",
                        padding: "12px 14px",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "start", justifyContent: "space-between", gap: 8 }}>
                        <button
                          type="button"
                          onClick={() => setSelectedPlanId(p.id)}
                          style={{
                            textAlign: "left",
                            background: "transparent",
                            border: "0",
                            padding: 0,
                            cursor: "pointer",
                            flex: 1,
                          }}
                        >
                          <div style={{ fontWeight: 800, color: "#0f172a", fontSize: 13 }}>
                            {p.specialite?.code ? `${p.specialite.code} • ` : ""}{p.specialite?.name || "—"}
                          </div>
                          <div style={{ color: "#64748b", fontSize: 12, marginTop: 4 }}>
                            {p.specialite?.departement || "—"} • {p.semestre?.label || `S${p.semestre?.number ?? ""}`} • v{p.version}
                          </div>
                          {p.title ? <div style={{ color: "#334155", fontSize: 12, marginTop: 6 }}>{p.title}</div> : null}
                        </button>

                        <button
                          type="button"
                          title="Delete plan"
                          aria-label="Delete plan"
                          className="admin-icon-btn"
                          style={{ color: "#ef4444" }}
                          onClick={async () => {
                            if (!confirm("Delete this plan?")) return;
                            try {
                              await deletePlanWithDependencies(p.id);
                              setPlans((prev) => prev.filter((x) => x.id !== p.id));
                              if (selectedPlanId === p.id) {
                                setSelectedPlanId(null);
                                setPlanTree(null);
                              }
                              setAffectations((prev) => prev.filter((a) => Number(a.plan_etude_id) !== Number(p.id)));
                            } catch (err) {
                              alert(err.response?.data?.message || "Failed to delete plan.");
                            }
                          }}
                        >
                          🗑
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* Right: tree + affectation */}
          <section className="admin-card">
            <div style={{ padding: 14, borderBottom: "1px solid #eef2f7", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontWeight: 900, color: "#0f172a" }}>Détails</div>
                <div style={{ fontSize: 12, color: "#64748b" }}>
                  {selectedPlan
                    ? `${selectedPlan.specialite?.departement || "—"} • ${selectedPlan.specialite?.name || "—"} • ${selectedPlan.semestre?.label || ""}`
                    : "Sélectionnez un plan"}
                </div>
              </div>
              {selectedPlan ? (
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    className="admin-secondary-btn"
                    onClick={() => {
                      setPanierForm(EMPTY_PANIER);
                      setContext({ planId: selectedPlan.id, panierId: null, moduleId: null });
                      openModal("panier");
                    }}
                  >
                    + Panier
                  </button>
                  <button
                    type="button"
                    className="admin-primary-btn"
                    onClick={() => {
                      setAffectForm({ ...EMPTY_AFFECT, annee_scolaire: "" });
                      setContext({ planId: selectedPlan.id, panierId: null, moduleId: null });
                      openModal("affect");
                    }}
                  >
                    Affecter à une classe
                  </button>
                </div>
              ) : null}
            </div>

            <div style={{ padding: 14 }}>
              {!selectedPlan ? (
                <p style={{ color: "#64748b" }}>Choisissez un plan à gauche pour gérer paniers, évaluations (par matière) et modules.</p>
              ) : treeLoading ? (
                <p style={{ color: "#64748b" }}>Loading...</p>
              ) : !planTree ? (
                <p style={{ color: "#ef4444" }}>Impossible de charger le plan.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  {(planTree.paniers ?? []).length === 0 ? (
                    <p style={{ color: "#64748b" }}>Aucun panier. Ajoutez un panier.</p>
                  ) : (
                    planTree.paniers.map((panier) => (
                      <div key={panier.id} style={{ border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden" }}>
                        <div style={{ background: "#f8fafc", padding: "10px 12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <div style={{ fontWeight: 900 }}>{panier.name}</div>
                          <div style={{ display: "flex", gap: 8 }}>
                            <button
                              type="button"
                              className="admin-secondary-btn"
                              style={{ padding: "6px 10px" }}
                              onClick={() => {
                                setModuleForm(EMPTY_MODULE);
                                setContext({ planId: planTree.id, panierId: panier.id, moduleId: null });
                                openModal("module");
                              }}
                            >
                              + Module
                            </button>
                            <button
                              type="button"
                              className="admin-secondary-btn"
                              style={{ padding: "6px 10px", borderColor: "#ef4444", color: "#ef4444" }}
                              onClick={() => quickDelete(`/plan-etudes/paniers/${panier.id}`, () => loadPlanTree(planTree.id))}
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                        <div style={{ padding: 12 }}>
                          <div
                            style={{
                              marginBottom: 12,
                              padding: "10px 12px",
                              border: "1px solid #e2e8f0",
                              borderRadius: 10,
                              background: "#fff",
                            }}
                          >
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                              <div style={{ fontWeight: 700, fontSize: 13, color: "#334155" }}>Évaluations (matière entière)</div>
                              <button
                                type="button"
                                className="admin-secondary-btn"
                                style={{ padding: "6px 10px" }}
                                onClick={() => {
                                  setEvalForm(EMPTY_EVAL);
                                  setContext({ planId: planTree.id, panierId: panier.id, moduleId: null });
                                  openModal("eval");
                                }}
                              >
                                + Évaluation
                              </button>
                            </div>
                            <div style={{ marginTop: 10 }}>
                              {(panier.evaluations ?? []).length === 0 ? (
                                <div style={{ color: "#64748b", fontSize: 12 }}>Aucune évaluation.</div>
                              ) : (
                                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                                  {(panier.evaluations ?? []).map((ev) => (
                                    <div
                                      key={ev.id}
                                      style={{
                                        display: "flex",
                                        gap: 8,
                                        alignItems: "center",
                                        border: "1px solid #e2e8f0",
                                        borderRadius: 999,
                                        padding: "6px 10px",
                                        fontSize: 12,
                                      }}
                                    >
                                      <strong>{ev.type}</strong>
                                      {ev.weight !== null && ev.weight !== undefined ? (
                                        <span style={{ color: "#64748b" }}>({ev.weight})</span>
                                      ) : null}
                                      <button
                                        type="button"
                                        style={{ border: 0, background: "transparent", color: "#ef4444", cursor: "pointer" }}
                                        onClick={() => quickDelete(`/plan-etudes/evaluations/${ev.id}`, () => loadPlanTree(planTree.id))}
                                        aria-label="Delete evaluation"
                                      >
                                        ✕
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                          {(panier.modules ?? []).length === 0 ? (
                            <div style={{ color: "#64748b" }}>No modules.</div>
                          ) : (
                            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                              {panier.modules.map((m) => (
                                <div key={m.id} style={{ border: "1px solid #eef2f7", borderRadius: 10, padding: 10 }}>
                                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                                    <div>
                                      <div style={{ fontWeight: 900 }}>
                                        {m.code ? `${m.code} — ` : ""}{m.name}
                                      </div>
                                      <div style={{ fontSize: 12, color: "#64748b" }}>
                                        Coefficient: <strong>{m.coefficient}</strong>
                                      </div>
                                    </div>
                                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                                      <button
                                        type="button"
                                        className="admin-secondary-btn"
                                        style={{ padding: "6px 10px", borderColor: "#ef4444", color: "#ef4444" }}
                                        onClick={() => quickDelete(`/plan-etudes/modules/${m.id}`, () => loadPlanTree(planTree.id))}
                                      >
                                        Delete
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  )}

                  {/* Affectations table */}
                  <div style={{ borderTop: "1px solid #eef2f7", paddingTop: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ fontWeight: 900 }}>Affectations (toutes)</div>
                      <div style={{ fontSize: 12, color: "#64748b" }}>{affectations.length}</div>
                    </div>
                    <div className="admin-table-wrap" style={{ paddingLeft: 0, paddingRight: 0 }}>
                      <table className="admin-table">
                        <thead>
                          <tr>
                            <th>Classe</th>
                            <th>Année</th>
                            <th>Plan</th>
                            <th className="admin-actions-col">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(affectations ?? []).slice(0, 50).map((a) => (
                            <tr key={a.id}>
                              <td>{a.classe ? classLabel(a.classe) : a.class_id}</td>
                              <td>{a.annee_scolaire}</td>
                              <td>
                                {a.plan_etude
                                  ? `${a.plan_etude.specialite?.code ? `${a.plan_etude.specialite.code} • ` : ""}${a.plan_etude.specialite?.name || "—"} • ${a.plan_etude.semestre?.label || ""} • v${a.plan_etude.version}`
                                  : a.plan_etude_id}
                              </td>
                              <td className="admin-actions">
                                <button
                                  type="button"
                                  className="admin-icon-btn"
                                  style={{ color: "#ef4444" }}
                                  onClick={() => quickDelete(`/plan-etudes/affectations/${a.id}`, fetchAffectations)}
                                  title="Delete"
                                >
                                  🗑
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {affectations.length > 50 ? (
                        <div style={{ padding: "8px 0", fontSize: 12, color: "#64748b" }}>
                          Showing first 50 affectations.
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>
      </main>

      {/* Modals */}
      {modal && (
        <div className="admin-modal-overlay" onClick={closeModal}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560 }}>
            <div className="admin-modal-header">
              <h2 className="admin-modal-title">
                {modal === "specialite" ? "Créer une spécialité"
                  : modal === "plan" ? "Créer un plan (par semestre)"
                    : modal === "panier" ? "Ajouter un panier"
                      : modal === "module" ? "Ajouter un module"
                        : modal === "eval" ? "Ajouter une évaluation"
                          : modal === "affect" ? "Affecter le plan à une classe"
                            : "Form"}
              </h2>
              <button type="button" className="admin-modal-close" onClick={closeModal}>✕</button>
            </div>

            {formError ? <p className="auth-error">{formError}</p> : null}

            {modal === "specialite" && (
              <form className="admin-modal-form" onSubmit={submitSpecialite}>
                <label className="admin-label">Département *</label>
                <input className="admin-input" value={specialiteForm.departement} onChange={(e) => setSpecialiteForm((p) => ({ ...p, departement: e.target.value }))} required placeholder="IT" />
                <label className="admin-label">Code (optionnel)</label>
                <input className="admin-input" value={specialiteForm.code} onChange={(e) => setSpecialiteForm((p) => ({ ...p, code: e.target.value }))} placeholder="DSI" />
                <label className="admin-label">Nom spécialité *</label>
                <input className="admin-input" value={specialiteForm.name} onChange={(e) => setSpecialiteForm((p) => ({ ...p, name: e.target.value }))} required placeholder="Développement Web et Application" />
                <div className="admin-modal-actions">
                  <button type="button" className="admin-secondary-btn" onClick={closeModal}>Cancel</button>
                  <button type="submit" className="admin-primary-btn">Save</button>
                </div>
              </form>
            )}

            {modal === "plan" && (
              <form className="admin-modal-form" onSubmit={submitPlan}>
                <label className="admin-label">Departement *</label>
                <select
                  className="admin-input"
                  value={planForm.departement}
                  onChange={(e) => setPlanForm((p) => ({ ...p, departement: e.target.value, specialite_id: "" }))}
                  required
                >
                  <option value="">Select...</option>
                  {Array.from(new Set(classes.map((c) => c.departement).filter(Boolean))).sort().map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>

                <label className="admin-label">Classes (multiple) *</label>
                <div style={{ maxHeight: 180, overflowY: "auto", border: "1px solid #e2e8f0", borderRadius: 8, padding: 8 }}>
                  {classes
                    .filter((c) => !planForm.departement || c.departement === planForm.departement)
                    .map((c) => (
                      <label key={c.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 2px", fontSize: 13 }}>
                        <input
                          type="checkbox"
                          checked={planForm.class_ids.includes(String(c.id))}
                          onChange={(e) => {
                            setPlanForm((prev) => ({
                              ...prev,
                              class_ids: e.target.checked
                                ? [...prev.class_ids, String(c.id)]
                                : prev.class_ids.filter((id) => id !== String(c.id)),
                            }));
                          }}
                        />
                        <span>{c.departement || "—"} • {c.name} • {classLevelLabel(c.niveau)}</span>
                      </label>
                    ))}
                </div>
                <label className="admin-label">Semestre *</label>
                <select className="admin-input" value={planForm.semestre_id} onChange={(e) => setPlanForm((p) => ({ ...p, semestre_id: e.target.value }))} required>
                  <option value="">Select...</option>
                  {semestres.map((s) => (
                    <option key={s.id} value={s.id}>{s.label || `S${s.number}`}</option>
                  ))}
                </select>
                <label className="admin-label">Titre</label>
                <input className="admin-input" value={planForm.title} onChange={(e) => setPlanForm((p) => ({ ...p, title: e.target.value }))} placeholder="Plan DSI - S1" />
                <label className="admin-label">Version</label>
                <input className="admin-input" type="number" min="1" value={planForm.version} onChange={(e) => setPlanForm((p) => ({ ...p, version: e.target.value }))} />
                <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input type="checkbox" checked={!!planForm.is_active} onChange={(e) => setPlanForm((p) => ({ ...p, is_active: e.target.checked }))} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#334155" }}>Active</span>
                </label>
                <div className="admin-modal-actions">
                  <button type="button" className="admin-secondary-btn" onClick={closeModal}>Cancel</button>
                  <button type="submit" className="admin-primary-btn">Save</button>
                </div>
              </form>
            )}

            {modal === "panier" && (
              <form className="admin-modal-form" onSubmit={submitPanier}>
                <label className="admin-label">Nom *</label>
                <input className="admin-input" value={panierForm.name} onChange={(e) => setPanierForm((p) => ({ ...p, name: e.target.value }))} required placeholder="Tronc commun" />
                <label className="admin-label">Ordre</label>
                <input className="admin-input" type="number" min="0" value={panierForm.ordre} onChange={(e) => setPanierForm((p) => ({ ...p, ordre: e.target.value }))} />
                <div className="admin-modal-actions">
                  <button type="button" className="admin-secondary-btn" onClick={closeModal}>Cancel</button>
                  <button type="submit" className="admin-primary-btn">Add</button>
                </div>
              </form>
            )}

            {modal === "module" && (
              <form className="admin-modal-form" onSubmit={submitModule}>
                <label className="admin-label">Code (optionnel)</label>
                <input className="admin-input" value={moduleForm.code} onChange={(e) => setModuleForm((p) => ({ ...p, code: e.target.value }))} placeholder="ALG1" />
                <label className="admin-label">Nom module *</label>
                <input className="admin-input" value={moduleForm.name} onChange={(e) => setModuleForm((p) => ({ ...p, name: e.target.value }))} required placeholder="Algorithmique" />
                <label className="admin-label">Coefficient *</label>
                <input className="admin-input" type="number" min="0" step="0.01" value={moduleForm.coefficient} onChange={(e) => setModuleForm((p) => ({ ...p, coefficient: e.target.value }))} required />
                <label className="admin-label">Ordre</label>
                <input className="admin-input" type="number" min="0" value={moduleForm.ordre} onChange={(e) => setModuleForm((p) => ({ ...p, ordre: e.target.value }))} />
                <div className="admin-modal-actions">
                  <button type="button" className="admin-secondary-btn" onClick={closeModal}>Cancel</button>
                  <button type="submit" className="admin-primary-btn">Add</button>
                </div>
              </form>
            )}

            {modal === "eval" && (
              <form className="admin-modal-form" onSubmit={submitEval}>
                <label className="admin-label">Type *</label>
                <select className="admin-input" value={evalForm.type} onChange={(e) => setEvalForm((p) => ({ ...p, type: e.target.value }))} required>
                  <option value="ds">DS</option>
                  <option value="examen">Examen</option>
                  <option value="tp">TP</option>
                </select>
                <label className="admin-label">Poids (optionnel)</label>
                <input className="admin-input" type="number" min="0" step="0.01" value={evalForm.weight} onChange={(e) => setEvalForm((p) => ({ ...p, weight: e.target.value }))} placeholder="e.g. 40" />
                <label className="admin-label">Ordre</label>
                <input className="admin-input" type="number" min="0" value={evalForm.ordre} onChange={(e) => setEvalForm((p) => ({ ...p, ordre: e.target.value }))} />
                <div className="admin-modal-actions">
                  <button type="button" className="admin-secondary-btn" onClick={closeModal}>Cancel</button>
                  <button type="submit" className="admin-primary-btn">Add</button>
                </div>
              </form>
            )}

            {modal === "affect" && (
              <form className="admin-modal-form" onSubmit={submitAffect}>
                <label className="admin-label">Departement *</label>
                <select
                  className="admin-input"
                  value={affectForm.departement}
                  onChange={(e) => setAffectForm((p) => ({ ...p, departement: e.target.value, class_ids: [] }))}
                  required
                >
                  <option value="">Select...</option>
                  {Array.from(new Set(classes.map((c) => c.departement).filter(Boolean))).sort().map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>

                <label className="admin-label">Classes (multiple) *</label>
                <div style={{ maxHeight: 180, overflowY: "auto", border: "1px solid #e2e8f0", borderRadius: 8, padding: 8 }}>
                  {classes
                    .filter((c) => !affectForm.departement || c.departement === affectForm.departement)
                    .map((c) => (
                      <label key={c.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 2px", fontSize: 13 }}>
                        <input
                          type="checkbox"
                          checked={affectForm.class_ids.includes(String(c.id))}
                          onChange={(e) => {
                            setAffectForm((prev) => ({
                              ...prev,
                              class_ids: e.target.checked
                                ? [...prev.class_ids, String(c.id)]
                                : prev.class_ids.filter((id) => id !== String(c.id)),
                            }));
                          }}
                        />
                        <span>{classLabel(c)}</span>
                      </label>
                    ))}
                </div>
                <label className="admin-label">Année scolaire *</label>
                <input className="admin-input" value={affectForm.annee_scolaire} onChange={(e) => setAffectForm((p) => ({ ...p, annee_scolaire: e.target.value }))} required placeholder="2025-2026" />
                <div className="admin-modal-actions">
                  <button type="button" className="admin-secondary-btn" onClick={closeModal}>Cancel</button>
                  <button type="submit" className="admin-primary-btn">Affecter</button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

