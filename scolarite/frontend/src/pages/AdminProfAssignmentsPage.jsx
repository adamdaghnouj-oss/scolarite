import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../api/axios";
import "./AdminPanel.css";
import "./AdminProfAssignmentsPage.css";
import { useLanguage } from "../i18n/LanguageContext";
import StaffSidebar from "../components/StaffSidebar";

function norm(s) {
  return String(s ?? "").trim().toLowerCase();
}

function classLevelLabel(value, tr) {
  if (value === "first") return tr("First year", "1ere annee");
  if (value === "second") return tr("Second year", "2eme annee");
  if (value === "third_pfe") return tr("Third year (PFE)", "3eme annee (PFE)");
  return tr("level not set", "niveau non defini");
}

function collectModuleIds(plan) {
  const ids = [];
  for (const panier of plan?.paniers ?? []) {
    for (const m of panier.modules ?? []) {
      ids.push(m.id);
    }
  }
  return ids;
}

/** panierId -> moduleId for building save payload */
function moduleToPanierIdMap(plan) {
  const map = new Map();
  for (const panier of plan?.paniers ?? []) {
    for (const m of panier.modules ?? []) {
      map.set(m.id, panier.id);
    }
  }
  return map;
}

/**
 * How TP is configured for each panier when loading from API (still stored per module in DB).
 * - sameAsCours: TP professor = panier course professor (same value written on every module row)
 * - else tp: one TP professor applied to every module in the panier (when distinct stored values match)
 */
function derivePanierTpState(plan, assignments) {
  const fromApi = {};
  for (const a of assignments ?? []) {
    fromApi[a.module_id] = a;
  }
  const out = {};
  for (const panier of plan?.paniers ?? []) {
    const mods = panier.modules ?? [];
    if (mods.length === 0) {
      out[panier.id] = { sameAsCours: false, tp: "", allDepts: false };
      continue;
    }
    const rows = mods.map((m) => {
      const a = fromApi[m.id] || {};
      return {
        c: a.professeur_cours_id ?? null,
        t: a.professeur_tp_id ?? null,
      };
    });
    const allHaveT = rows.every((r) => r.t != null);
    const uniqT = [...new Set(rows.map((r) => r.t).filter((x) => x != null))];
    const singleSharedTp = allHaveT && uniqT.length === 1;
    const sameAsCours = rows.every(
      (r) => (r.c == null && r.t == null) || (r.c != null && r.t != null && r.c === r.t)
    );

    if (singleSharedTp) {
      out[panier.id] = { sameAsCours: false, tp: String(uniqT[0]), allDepts: false };
    } else if (sameAsCours) {
      out[panier.id] = { sameAsCours: true, tp: "", allDepts: false };
    } else {
      out[panier.id] = { sameAsCours: false, tp: "", allDepts: false };
    }
  }
  return out;
}

function distinctStoredTpProfessorIds(panier, assignments) {
  const fromApi = {};
  for (const a of assignments ?? []) {
    fromApi[a.module_id] = a;
  }
  const s = new Set();
  for (const m of panier.modules ?? []) {
    const t = fromApi[m.id]?.professeur_tp_id;
    if (t != null) s.add(t);
  }
  return s;
}

function distinctStoredCoursProfessorIds(panier, assignments) {
  const fromApi = {};
  for (const a of assignments ?? []) {
    fromApi[a.module_id] = a;
  }
  const s = new Set();
  for (const m of panier.modules ?? []) {
    const c = fromApi[m.id]?.professeur_cours_id;
    if (c != null) s.add(c);
  }
  return s;
}

/** One cours professor per panier for the UI; DB still stores per module. */
function derivePanierCoursState(plan, assignments) {
  const fromApi = {};
  for (const a of assignments ?? []) {
    fromApi[a.module_id] = a;
  }
  const out = {};
  for (const panier of plan?.paniers ?? []) {
    const mods = panier.modules ?? [];
    if (mods.length === 0) {
      out[panier.id] = { cours: "", allDepts: false };
      continue;
    }
    const coursIds = mods.map((m) => fromApi[m.id]?.professeur_cours_id ?? null);
    const uniq = [...new Set(coursIds.filter((x) => x != null))];
    if (uniq.length === 0) {
      out[panier.id] = { cours: "", allDepts: false };
    } else if (uniq.length === 1) {
      out[panier.id] = { cours: String(uniq[0]), allDepts: false };
    } else {
      const pick = coursIds.find((x) => x != null);
      out[panier.id] = { cours: pick != null ? String(pick) : "", allDepts: false };
    }
  }
  return out;
}

export default function AdminProfAssignmentsPage() {
  const { language } = useLanguage();
  const tr = (en, fr) => (language === "fr" ? fr : en);

  const [classes, setClasses] = useState([]);
  const [profs, setProfs] = useState([]);
  /** "" = not chosen yet; "__empty__" = classes/profs with no department set */
  const [selectedDepartment, setSelectedDepartment] = useState("");
  const [selectedClassId, setSelectedClassId] = useState("");

  const [planPayload, setPlanPayload] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [loadOk, setLoadOk] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  /** panierId -> { cours: string id or "", allDepts } — one cours professor for the whole matière (all modules) */
  const [panierCoursState, setPanierCoursState] = useState({});
  /** panierId -> { sameAsCours, tp: string id or "", allDepts } — TP applies to whole matière (all modules) */
  const [panierTpState, setPanierTpState] = useState({});
  const [globalAllDepts, setGlobalAllDepts] = useState(false);

  const fetchRefs = useCallback(async () => {
    try {
      const [cRes, pRes] = await Promise.all([api.get("/classes"), api.get("/professeurs")]);
      setClasses(cRes.data ?? []);
      setProfs(pRes.data ?? []);
    } catch {
      setClasses([]);
      setProfs([]);
    }
  }, []);

  useEffect(() => {
    fetchRefs();
  }, [fetchRefs]);

  const departmentOptions = useMemo(() => {
    const names = new Set();
    let hasEmptyClass = false;
    for (const c of classes) {
      const d = String(c.departement ?? "").trim();
      if (d) names.add(d);
      else hasEmptyClass = true;
    }
    const list = [...names].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
    return { list, hasEmptyClass };
  }, [classes]);

  const filteredClasses = useMemo(() => {
    if (!selectedDepartment) return [];
    if (selectedDepartment === "__empty__") {
      return classes.filter((c) => !String(c.departement ?? "").trim());
    }
    return classes.filter((c) => norm(c.departement) === norm(selectedDepartment));
  }, [classes, selectedDepartment]);

  const selectedClass = useMemo(
    () => filteredClasses.find((c) => String(c.id) === String(selectedClassId)),
    [filteredClasses, selectedClassId]
  );

  const profOptionsForRow = useCallback(
    (rowAllDepts) => {
      if (globalAllDepts || rowAllDepts) return profs;
      if (!selectedDepartment) return [];
      if (selectedDepartment === "__empty__") {
        return profs.filter((p) => !String(p.departement ?? "").trim());
      }
      return profs.filter((p) => norm(p.departement) === norm(selectedDepartment));
    },
    [globalAllDepts, selectedDepartment, profs]
  );

  function initProfStateFromResponse(plan, assignments) {
    setPanierCoursState(derivePanierCoursState(plan, assignments));
    setPanierTpState(derivePanierTpState(plan, assignments));
  }

  async function loadContext() {
    setLoadError("");
    setLoadOk("");
    setPlanPayload(null);
    setPanierCoursState({});
    setPanierTpState({});
    if (!selectedClass?.id || !selectedClass?.annee_scolaire) {
      setLoadError(tr("Pick a class that has a school year set.", "Choisissez une classe avec une annee scolaire."));
      return;
    }
    setLoading(true);
    try {
      const res = await api.get("/plan-etudes/class-module-assignments", {
        params: { class_id: selectedClass.id, annee_scolaire: selectedClass.annee_scolaire },
      });
      setPlanPayload(res.data);
      initProfStateFromResponse(res.data.plan, res.data.assignments);
      setLoadOk(tr("Plan and modules loaded.", "Plan et modules charges."));
    } catch (e) {
      const msg = e.response?.data?.message;
      setLoadError(
        msg
          || tr("Could not load plan for this class.", "Impossible de charger le plan pour cette classe.")
      );
    } finally {
      setLoading(false);
    }
  }

  function setPanierCoursField(panierId, field, value) {
    setPanierCoursState((prev) => {
      const cur = prev[panierId] || { cours: "", allDepts: false };
      return { ...prev, [panierId]: { ...cur, [field]: value } };
    });
  }

  function setPanierTpField(panierId, field, value) {
    setPanierTpState((prev) => {
      const cur = prev[panierId] || { sameAsCours: false, tp: "", allDepts: false };
      const next = { ...cur, [field]: value };
      if (field === "sameAsCours" && value) next.tp = "";
      return { ...prev, [panierId]: next };
    });
  }

  async function saveAll() {
    if (!planPayload?.plan || !selectedClass) return;
    setSaving(true);
    setLoadError("");
    setLoadOk("");
    try {
      const moduleIds = collectModuleIds(planPayload.plan);
      const modToPanier = moduleToPanierIdMap(planPayload.plan);
      const assignments = moduleIds.map((mid) => {
        const panierId = modToPanier.get(mid);
        const pcs = panierCoursState[panierId] || { cours: "", allDepts: false };
        const coursId = pcs.cours ? Number(pcs.cours) : null;
        const ps = panierTpState[panierId] || { sameAsCours: false, tp: "" };
        const tpId = ps.sameAsCours ? coursId : ps.tp ? Number(ps.tp) : null;
        return {
          module_id: mid,
          professeur_cours_id: coursId,
          professeur_tp_id: tpId,
        };
      });
      await api.put("/plan-etudes/class-module-assignments", {
        class_id: selectedClass.id,
        annee_scolaire: selectedClass.annee_scolaire,
        assignments,
      });
      const refreshed = await api.get("/plan-etudes/class-module-assignments", {
        params: { class_id: selectedClass.id, annee_scolaire: selectedClass.annee_scolaire },
      });
      setPlanPayload(refreshed.data);
      initProfStateFromResponse(refreshed.data.plan, refreshed.data.assignments);
      setLoadOk(tr("Assignments saved.", "Affectations enregistrees."));
    } catch (e) {
      const msg = e.response?.data?.message;
      setLoadError(msg || tr("Save failed.", "Echec de l'enregistrement."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="admin-wrap">
      <StaffSidebar variant="directeur" />

      <main className="admin-main apa-page">
        <header className="admin-topbar">
          <div>
            <h1 className="admin-title">
              {tr("Professors — class & study plan", "Professeurs — classe et plan")}
            </h1>
            <p className="admin-subtitle">
              {tr(
                "Choose one course (cours) professor and one TP professor per subject (panier). The same assignment is stored on every module row for compatibility with grades and messaging.",
                "Choisissez un professeur de cours et un professeur de TP par matiere (panier). La meme affectation est enregistree sur chaque ligne module pour compatibilite avec les notes et la messagerie."
              )}
            </p>
          </div>
        </header>

        <section className="admin-card apa-toolbar">
          <div className="apa-toolbar-grid">
            <div className="apa-field">
              <label className="admin-label" htmlFor="apa-dept-select">
                {tr("Department", "Departement")}
              </label>
              <select
                id="apa-dept-select"
                className="apa-toolbar-select"
                value={selectedDepartment}
                onChange={(e) => {
                  setSelectedDepartment(e.target.value);
                  setSelectedClassId("");
                  setPlanPayload(null);
                  setPanierCoursState({});
                  setPanierTpState({});
                  setLoadError("");
                  setLoadOk("");
                }}
              >
                <option value="">{tr("Select department first…", "Choisir le departement…")}</option>
                {departmentOptions.list.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
                {departmentOptions.hasEmptyClass ? (
                  <option value="__empty__">
                    {tr("(Classes without department)", "(Classes sans departement)")}
                  </option>
                ) : null}
              </select>
            </div>

            <div className="apa-field">
              <label className="admin-label" htmlFor="apa-class-select">
                {tr("Class", "Classe")}
              </label>
              <select
                id="apa-class-select"
                className="apa-toolbar-select"
                value={selectedClassId}
                disabled={!selectedDepartment}
                onChange={(e) => {
                  setSelectedClassId(e.target.value);
                  setPlanPayload(null);
                  setPanierCoursState({});
                  setPanierTpState({});
                  setLoadError("");
                  setLoadOk("");
                }}
              >
                <option value="">
                  {!selectedDepartment
                    ? tr("Choose department above", "Choisissez le departement ci-dessus")
                    : tr("Select class…", "Choisir la classe…")}
                </option>
                {filteredClasses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({classLevelLabel(c.niveau, tr)} · {c.annee_scolaire || tr("no year", "sans annee")})
                  </option>
                ))}
              </select>
            </div>

            <div className="apa-field apa-field--actions">
              <div className="apa-actions">
                <button
                  type="button"
                  className="admin-primary-btn"
                  disabled={loading || !selectedDepartment || !selectedClassId}
                  onClick={loadContext}
                >
                  {loading ? tr("Loading…", "Chargement…") : tr("Load plan", "Charger le plan")}
                </button>
                <button
                  type="button"
                  className="admin-secondary-btn"
                  disabled={saving || !planPayload?.plan}
                  onClick={saveAll}
                >
                  {saving ? tr("Saving…", "Enregistrement…") : tr("Save assignments", "Enregistrer")}
                </button>
              </div>
            </div>
          </div>

          <label className="apa-check apa-check--inline">
            <input
              type="checkbox"
              checked={globalAllDepts}
              onChange={(e) => setGlobalAllDepts(e.target.checked)}
            />
            <span>
              {tr(
                "Show professors from all departments (default: only professors in the selected department).",
                "Afficher les professeurs de tous les departements (par defaut : uniquement le departement selectionne)."
              )}
            </span>
          </label>

          {loadError ? <p className="apa-alert apa-alert--err">{loadError}</p> : null}
          {loadOk ? <p className="apa-alert apa-alert--ok">{loadOk}</p> : null}
        </section>

        {planPayload?.plan ? (
          <section className="admin-card apa-plan-head">
            <div>
              <strong>{planPayload.plan.title || tr("Study plan", "Plan d'etudes")}</strong>
              <span className="apa-meta">
                {" "}
                · {planPayload.plan.specialite?.name} ({planPayload.plan.specialite?.departement}) ·{" "}
                {planPayload.plan.semestre?.label || `S${planPayload.plan.semestre?.number}`}
              </span>
            </div>
            <div className="apa-hint">
              {tr(
                "Evaluations (DS, exam, TP) are defined once per panier by the Director. Course and TP professors are chosen once per panier here.",
                "Les evaluations (DS, examen, TP) sont definies une fois par panier par le Directeur. Les professeurs de cours et de TP sont choisis une fois par panier ici."
              )}
            </div>
          </section>
        ) : null}

        {planPayload?.plan?.paniers?.map((panier) => {
          const pst = panierTpState[panier.id] || { sameAsCours: false, tp: "", allDepts: false };
          const pcs = panierCoursState[panier.id] || { cours: "", allDepts: false };
          const tpOptions = profOptionsForRow(pst.allDepts);
          const coursOptions = profOptionsForRow(pcs.allDepts);
          const tpClash = distinctStoredTpProfessorIds(panier, planPayload.assignments).size > 1;
          const coursClash = distinctStoredCoursProfessorIds(panier, planPayload.assignments).size > 1;
          return (
            <section key={panier.id} className="admin-card apa-panier">
              <h2 className="apa-panier-title">
                {tr("Panier", "Panier")}: {panier.name}
              </h2>

              <div className="apa-panier-eval-strip" style={{ marginBottom: "14px" }}>
                <div style={{ fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "8px" }}>
                  {tr("Evaluations (plan)", "Evaluations (plan)")}
                </div>
                <div className="apa-ev-tags">
                  {(panier.evaluations ?? []).length === 0 ? (
                    <span style={{ color: "#64748b", fontSize: "13px" }}>—</span>
                  ) : (
                    (panier.evaluations ?? []).map((ev) => (
                      <span key={ev.id} className="apa-ev-tag">
                        {ev.type}
                        {ev.weight != null ? ` (${ev.weight})` : ""}
                      </span>
                    ))
                  )}
                </div>
              </div>

              <div className="apa-panier-cours-bar">
                <div className="apa-panier-cours-label">
                  {tr("Course professor (whole subject / panier)", "Professeur de cours (toute la matiere / panier)")}
                </div>
                <div className="apa-panier-cours-controls">
                  <select
                    className="apa-select-input apa-panier-cours-select"
                    value={pcs.cours}
                    onChange={(e) => setPanierCoursField(panier.id, "cours", e.target.value)}
                    aria-label={tr("Course professor for panier", "Professeur de cours du panier")}
                  >
                    <option value="">{tr("— None —", "— Aucun —")}</option>
                    {coursOptions.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                        {p.departement ? ` (${p.departement})` : ""}
                      </option>
                    ))}
                  </select>
                  <label className="apa-check apa-check--compact apa-check--nowrap">
                    <input
                      type="checkbox"
                      checked={pcs.allDepts}
                      onChange={(e) => setPanierCoursField(panier.id, "allDepts", e.target.checked)}
                    />
                    <span>{tr("All depts (cours list)", "Tous dept. (liste cours)")}</span>
                  </label>
                </div>
                {coursClash ? (
                  <p className="apa-panier-cours-warn">
                    {tr(
                      "Saved data had different course professors on different modules. Pick one professor for the whole subject and save to align all modules.",
                      "Les donnees enregistrees avaient des professeurs de cours differents selon les modules. Choisissez un seul prof pour toute la matiere et enregistrez pour aligner tous les modules."
                    )}
                  </p>
                ) : null}
              </div>

              <div className="apa-panier-tp-bar">
                <div className="apa-panier-tp-label">{tr("TP professor (whole panier)", "Professeur TP (tout le panier)")}</div>
                <div className="apa-panier-tp-controls">
                  <label className="apa-check apa-check--compact">
                    <input
                      type="checkbox"
                      checked={pst.sameAsCours}
                      onChange={(e) => setPanierTpField(panier.id, "sameAsCours", e.target.checked)}
                    />
                    <span>
                      {tr(
                        "Same as course professor (subject panier)",
                        "Meme que le professeur de cours (matiere / panier)"
                      )}
                    </span>
                  </label>
                  <select
                    className="apa-select-input apa-panier-tp-select"
                    value={pst.tp}
                    disabled={pst.sameAsCours}
                    onChange={(e) => setPanierTpField(panier.id, "tp", e.target.value)}
                    aria-label={tr("TP professor for panier", "Professeur TP du panier")}
                  >
                    <option value="">{tr("— None —", "— Aucun —")}</option>
                    {tpOptions.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                        {p.departement ? ` (${p.departement})` : ""}
                      </option>
                    ))}
                  </select>
                  <label className="apa-check apa-check--compact apa-check--nowrap">
                    <input
                      type="checkbox"
                      checked={pst.allDepts}
                      onChange={(e) => setPanierTpField(panier.id, "allDepts", e.target.checked)}
                    />
                    <span>{tr("All depts (TP list)", "Tous dept. (liste TP)")}</span>
                  </label>
                </div>
                {tpClash ? (
                  <p className="apa-panier-tp-warn">
                    {tr(
                      'Saved data lists different TP professors on different modules in this panier. Choose one TP professor for the whole panier or enable "Same as course professor", then save.',
                      "Les donnees enregistrees indiquent des professeurs TP differents selon les modules. Choisissez un seul prof TP pour tout le panier ou cochez « Meme que le prof de cours », puis enregistrez."
                    )}
                  </p>
                ) : null}
              </div>

              <div className="apa-table-wrap">
                <table className="admin-table apa-table apa-table--modules-only">
                  <thead>
                    <tr>
                      <th scope="col">{tr("Modules in this subject (plan)", "Modules de cette matiere (plan)")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(panier.modules ?? []).length === 0 ? (
                      <tr>
                        <td className="admin-empty">
                          {tr("No modules in this panier.", "Aucun module dans ce panier.")}
                        </td>
                      </tr>
                    ) : (
                      panier.modules.map((m) => (
                        <tr key={m.id}>
                          <td className="apa-cell apa-cell--module">
                            <div className="apa-mod-name">{m.name}</div>
                            {m.code ? <div className="apa-mod-code">{m.code}</div> : null}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          );
        })}

        {!planPayload?.plan && !loading && selectedDepartment && selectedClassId ? (
          <p className="apa-muted apa-muted--padded">
            {tr('Click "Load plan" after selecting a class.', 'Cliquez sur « Charger le plan » apres avoir choisi une classe.')}
          </p>
        ) : null}
      </main>
    </div>
  );
}
