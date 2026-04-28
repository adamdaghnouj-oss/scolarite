import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/axios";
import { clearAuth } from "../auth/auth";
import "./AdminPanel.css";
import "./AdminProfAssignmentsPage.css";
import { useLanguage } from "../i18n/LanguageContext";

function norm(s) {
  return String(s ?? "").trim().toLowerCase();
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

export default function AdminProfAssignmentsPage() {
  const navigate = useNavigate();
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

  /** moduleId -> { cours: string id or "", tp: string id or "", sameTp: bool, allDepts: bool } */
  const [assignMap, setAssignMap] = useState({});
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

  function initAssignMapFromResponse(plan, assignments) {
    const byMod = {};
    const fromApi = {};
    for (const a of assignments ?? []) {
      fromApi[a.module_id] = a;
    }
    for (const panier of plan?.paniers ?? []) {
      for (const m of panier.modules ?? []) {
        const a = fromApi[m.id];
        const c = a?.professeur_cours_id != null ? String(a.professeur_cours_id) : "";
        const t = a?.professeur_tp_id != null ? String(a.professeur_tp_id) : "";
        const sameTp = Boolean(c && (!t || c === t));
        byMod[m.id] = {
          cours: c,
          tp: sameTp ? c : t,
          sameTp,
          allDepts: false,
        };
      }
    }
    setAssignMap(byMod);
  }

  async function loadContext() {
    setLoadError("");
    setLoadOk("");
    setPlanPayload(null);
    setAssignMap({});
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
      initAssignMapFromResponse(res.data.plan, res.data.assignments);
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

  function setRowField(moduleId, field, value) {
    setAssignMap((prev) => {
      const cur = prev[moduleId] || { cours: "", tp: "", sameTp: false, allDepts: false };
      const next = { ...cur, [field]: value };
      if (field === "cours" && next.sameTp) next.tp = value;
      if (field === "sameTp" && value) next.tp = next.cours;
      return { ...prev, [moduleId]: next };
    });
  }

  async function saveAll() {
    if (!planPayload?.plan || !selectedClass) return;
    setSaving(true);
    setLoadError("");
    setLoadOk("");
    try {
      const moduleIds = collectModuleIds(planPayload.plan);
      const assignments = moduleIds.map((mid) => {
        const row = assignMap[mid] || { cours: "", tp: "", sameTp: false };
        const coursId = row.cours ? Number(row.cours) : null;
        const tpId = row.sameTp ? coursId : row.tp ? Number(row.tp) : null;
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
      setLoadOk(tr("Assignments saved.", "Affectations enregistrees."));
    } catch (e) {
      const msg = e.response?.data?.message;
      setLoadError(msg || tr("Save failed.", "Echec de l'enregistrement."));
    } finally {
      setSaving(false);
    }
  }

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
    <div className="admin-wrap">
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <div className="admin-brand-mark" aria-hidden="true">S</div>
          <div className="admin-brand-text">
            <div className="admin-brand-title">Scolarité</div>
            <div className="admin-brand-subtitle">{tr("Administration", "Administration")}</div>
          </div>
        </div>

        <nav className="admin-nav">
          <Link className="admin-nav-item" to="/">{tr("Home", "Accueil")}</Link>
          <Link className="admin-nav-item" to="/admin">{tr("Management", "Gestion")}</Link>
          <Link className="admin-nav-item" to="/classes">{tr("Classes", "Classes")}</Link>
          <Link className="admin-nav-item admin-nav-item--active" to="/admin/prof-assignments">
            {tr("Prof. — modules", "Profs / modules")}
          </Link>
          <Link className="admin-nav-item" to="/accounts">{tr("Accounts", "Comptes")}</Link>
          <Link className="admin-nav-item" to="/change-password">{tr("Change password", "Changer le mot de passe")}</Link>
        </nav>

        <div className="admin-sidebar-footer">
          <button type="button" className="admin-secondary-btn" style={{ width: "100%" }} onClick={handleLogout}>
            {tr("Logout", "Deconnexion")}
          </button>
        </div>
      </aside>

      <main className="admin-main apa-page">
        <header className="admin-topbar">
          <div>
            <h1 className="admin-title">
              {tr("Professors per module (class)", "Professeurs par module (classe)")}
            </h1>
            <p className="admin-subtitle">
              {tr(
                "Modules come from the study plan (paniers) linked to the class by the Director of Studies. Assign one professor for cours and optionally a different one for TP.",
                "Les modules viennent du plan d'etudes (paniers) rattache a la classe par le Directeur des etudes. Affectez un professeur pour le cours et eventuellement un autre pour le TP."
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
                  setAssignMap({});
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
                  setAssignMap({});
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
                    {c.name} ({c.annee_scolaire || tr("no year", "sans annee")})
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
                "Panier = module group from the Director. Each row is one subject (module) with cours / TP professors.",
                "Panier = groupe de modules defini par le Directeur. Chaque ligne est une matiere (module) avec profs cours / TP."
              )}
            </div>
          </section>
        ) : null}

        {planPayload?.plan?.paniers?.map((panier) => (
          <section key={panier.id} className="admin-card apa-panier">
            <h2 className="apa-panier-title">
              {tr("Panier", "Panier")}: {panier.name}
            </h2>
            <div className="apa-table-wrap">
              <table className="admin-table apa-table">
                <colgroup>
                  <col className="apa-col apa-col--module" />
                  <col className="apa-col apa-col--eval" />
                  <col className="apa-col apa-col--prof" />
                  <col className="apa-col apa-col--check" />
                  <col className="apa-col apa-col--prof" />
                  <col className="apa-col apa-col--check" />
                </colgroup>
                <thead>
                  <tr>
                    <th scope="col">{tr("Module", "Module")}</th>
                    <th scope="col">{tr("Evaluations", "Evaluations")}</th>
                    <th scope="col">{tr("Professor (cours)", "Professeur (cours)")}</th>
                    <th scope="col">{tr("Same for TP", "Meme pour TP")}</th>
                    <th scope="col">{tr("Professor (TP)", "Professeur (TP)")}</th>
                    <th scope="col">{tr("All depts (row)", "Tous dept. (ligne)")}</th>
                  </tr>
                </thead>
                <tbody>
                  {(panier.modules ?? []).length === 0 ? (
                    <tr>
                      <td colSpan={6} className="admin-empty">
                        {tr("No modules in this panier.", "Aucun module dans ce panier.")}
                      </td>
                    </tr>
                  ) : (
                    panier.modules.map((m) => {
                      const row = assignMap[m.id] || { cours: "", tp: "", sameTp: false, allDepts: false };
                      const options = profOptionsForRow(row.allDepts);
                      return (
                        <tr key={m.id}>
                          <td className="apa-cell apa-cell--module">
                            <div className="apa-mod-name">{m.name}</div>
                            {m.code ? <div className="apa-mod-code">{m.code}</div> : null}
                          </td>
                          <td className="apa-cell apa-cell--eval">
                            <div className="apa-ev-tags">
                              {(m.evaluations ?? []).map((ev) => (
                                <span key={ev.id} className="apa-ev-tag">
                                  {ev.type}
                                  {ev.weight != null ? ` (${ev.weight})` : ""}
                                </span>
                              ))}
                              {(m.evaluations ?? []).length === 0 ? "—" : null}
                            </div>
                          </td>
                          <td className="apa-cell apa-cell--prof">
                            <select
                              className="apa-select-input"
                              value={row.cours}
                              onChange={(e) => setRowField(m.id, "cours", e.target.value)}
                            >
                              <option value="">{tr("— None —", "— Aucun —")}</option>
                              {options.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.name}
                                  {p.departement ? ` (${p.departement})` : ""}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="apa-cell apa-cell--check">
                            <input
                              type="checkbox"
                              className="apa-checkbox"
                              checked={row.sameTp}
                              onChange={(e) => setRowField(m.id, "sameTp", e.target.checked)}
                              aria-label={tr("Same professor for TP", "Meme professeur pour le TP")}
                            />
                          </td>
                          <td className="apa-cell apa-cell--prof">
                            <select
                              className="apa-select-input"
                              value={row.sameTp ? row.cours : row.tp}
                              disabled={row.sameTp}
                              onChange={(e) => setRowField(m.id, "tp", e.target.value)}
                            >
                              <option value="">{tr("— None —", "— Aucun —")}</option>
                              {options.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.name}
                                  {p.departement ? ` (${p.departement})` : ""}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="apa-cell apa-cell--check">
                            <input
                              type="checkbox"
                              className="apa-checkbox"
                              checked={row.allDepts}
                              onChange={(e) => setRowField(m.id, "allDepts", e.target.checked)}
                              title={tr(
                                "For this module only, list professors from every department.",
                                "Pour ce module seulement, lister les professeurs de tous les departements."
                              )}
                              aria-label={tr("All departments for this row", "Tous les departements pour cette ligne")}
                            />
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>
        ))}

        {!planPayload?.plan && !loading && selectedDepartment && selectedClassId ? (
          <p className="apa-muted apa-muted--padded">
            {tr('Click "Load plan" after selecting a class.', 'Cliquez sur « Charger le plan » apres avoir choisi une classe.')}
          </p>
        ) : null}
      </main>
    </div>
  );
}
