import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/axios";
import { clearAuth } from "../auth/auth";
import "./AdminPanel.css";
import { useLanguage } from "../i18n/LanguageContext";

function selectionKey(classId, year) {
  return `${classId}|${year}`;
}

export default function ProfessorNotesPage() {
  const navigate = useNavigate();
  const { language, t } = useLanguage();
  const tr = (en, fr) => (language === "fr" ? fr : en);

  const [payload, setPayload] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedKey, setSelectedKey] = useState("");
  const [panierId, setPanierId] = useState("");

  const [students, setStudents] = useState([]);
  const [studentsLoading, setStudentsLoading] = useState(false);

  /** @type {{ slots: Array<{key: string, label: string, weight?: number|null, scope: string, editable: boolean}>, roles: {cours: boolean, tp: boolean}, grades: Record<string, Record<string, number|null>> } | null} */
  const [gradesCtx, setGradesCtx] = useState(null);
  const [contextLoading, setContextLoading] = useState(false);
  const [contextErr, setContextErr] = useState("");

  /** studentId -> evalKey -> string input */
  const [draft, setDraft] = useState({});
  const [saveMsg, setSaveMsg] = useState("");
  const [saveErr, setSaveErr] = useState("");

  const [dcRows, setDcRows] = useState([]);
  const [dcLoading, setDcLoading] = useState(false);
  const [dcErr, setDcErr] = useState("");
  const [dcWorkingId, setDcWorkingId] = useState(null);
  const [dcNoteById, setDcNoteById] = useState({});

  const classes = payload?.classes ?? [];

  const selected = useMemo(() => {
    if (!selectedKey) return null;
    return classes.find((c) => selectionKey(c.class_id, c.annee_scolaire) === selectedKey) ?? null;
  }, [classes, selectedKey]);

  const paniers = useMemo(() => {
    const list = [...(selected?.paniers ?? [])];
    list.sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0) || (a.id ?? 0) - (b.id ?? 0));
    return list;
  }, [selected]);

  const activePanier = useMemo(() => {
    if (!panierId) return null;
    return paniers.find((p) => String(p.id) === String(panierId)) ?? null;
  }, [paniers, panierId]);

  const fetchTeaching = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const res = await api.get("/professeur/teaching");
      setPayload(res.data);
    } catch (err) {
      const msg = err.response?.data?.message;
      setLoadError(msg || tr("Could not load teaching assignments.", "Impossible de charger vos affectations."));
      setPayload(null);
    } finally {
      setLoading(false);
    }
  }, [language]);

  useEffect(() => {
    fetchTeaching();
  }, [fetchTeaching]);

  const loadDoubleCorrections = useCallback(async () => {
    setDcLoading(true);
    setDcErr("");
    try {
      const res = await api.get("/professeur/double-corrections");
      setDcRows(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      setDcRows([]);
      setDcErr(e.response?.data?.message || tr("Could not load requests.", "Impossible de charger les demandes."));
    } finally {
      setDcLoading(false);
    }
  }, [language]);

  useEffect(() => {
    loadDoubleCorrections();
  }, [loadDoubleCorrections]);

  useEffect(() => {
    if (classes.length === 0) {
      setSelectedKey("");
      return;
    }
    if (!selectedKey || !classes.some((c) => selectionKey(c.class_id, c.annee_scolaire) === selectedKey)) {
      const first = classes[0];
      setSelectedKey(selectionKey(first.class_id, first.annee_scolaire));
    }
  }, [classes, selectedKey]);

  useEffect(() => {
    if (paniers.length === 0) {
      setPanierId("");
      return;
    }
    if (!panierId || !paniers.some((p) => String(p.id) === String(panierId))) {
      setPanierId(String(paniers[0].id));
    }
  }, [paniers, panierId]);

  useEffect(() => {
    if (!selected) {
      setStudents([]);
      return;
    }
    let cancelled = false;
    setStudentsLoading(true);
    (async () => {
      try {
        const res = await api.get(`/professeur/classes/${selected.class_id}/students`, {
          params: { annee_scolaire: selected.annee_scolaire },
        });
        if (!cancelled) setStudents(Array.isArray(res.data) ? res.data : []);
      } catch {
        if (!cancelled) setStudents([]);
      } finally {
        if (!cancelled) setStudentsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selected]);

  useEffect(() => {
    if (!selected || !panierId) {
      setGradesCtx(null);
      setDraft({});
      return;
    }
    let cancelled = false;
    setContextLoading(true);
    setContextErr("");
    (async () => {
      try {
        const res = await api.get(`/professeur/paniers/${panierId}/grades-context`, {
          params: { class_id: selected.class_id, annee_scolaire: selected.annee_scolaire },
        });
        if (!cancelled) setGradesCtx(res.data);
      } catch (err) {
        if (!cancelled) {
          setGradesCtx(null);
          setContextErr(err.response?.data?.message || tr("Could not load grading context.", "Impossible de charger les évaluations."));
        }
      } finally {
        if (!cancelled) setContextLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selected, panierId, language]);

  useEffect(() => {
    if (!gradesCtx || !students.length) {
      setDraft({});
      return;
    }
    const slots = gradesCtx.slots ?? [];
    const grades = gradesCtx.grades ?? {};
    const next = {};
    for (const s of students) {
      next[s.id] = {};
      for (const slot of slots) {
        const v = grades[String(s.id)]?.[slot.key];
        next[s.id][slot.key] = v != null && v !== "" ? String(v) : "";
      }
    }
    setDraft(next);
  }, [gradesCtx, students]);

  useEffect(() => {
    setSaveMsg("");
    setSaveErr("");
  }, [selectedKey, panierId]);

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

  async function decideDc(id, decision) {
    setDcWorkingId(id);
    setDcErr("");
    try {
      await api.post(`/professeur/double-corrections/${id}/decision`, {
        decision,
        decision_note: (dcNoteById[id] || "").trim() || null,
      });
      await loadDoubleCorrections();
      setDcNoteById((p) => ({ ...p, [id]: "" }));
    } catch (e) {
      setDcErr(e.response?.data?.message || tr("Failed to save decision.", "Échec de l'enregistrement."));
    } finally {
      setDcWorkingId(null);
    }
  }

  function setCell(studentId, evalKey, value) {
    setDraft((prev) => ({
      ...prev,
      [studentId]: { ...(prev[studentId] || {}), [evalKey]: value },
    }));
  }

  async function saveAll() {
    if (!selected || !panierId || !gradesCtx) return;
    const slots = gradesCtx.slots ?? [];
    const cells = [];
    for (const s of students) {
      for (const slot of slots) {
        if (!slot.editable) continue;
        const raw = (draft[s.id]?.[slot.key] ?? "").trim();
        if (raw === "") {
          cells.push({ student_id: s.id, evaluation_type: slot.key, note: null });
          continue;
        }
        const n = Number(raw);
        if (Number.isNaN(n)) {
          setSaveErr(tr("Invalid grade value.", "Note invalide."));
          return;
        }
        cells.push({ student_id: s.id, evaluation_type: slot.key, note: n });
      }
    }
    if (cells.length === 0) {
      setSaveErr(tr("No editable columns for your role.", "Aucune colonne modifiable pour votre rôle."));
      return;
    }
    setSaveErr("");
    setSaveMsg("");
    try {
      await api.put(`/professeur/paniers/${panierId}/grades`, {
        class_id: selected.class_id,
        annee_scolaire: selected.annee_scolaire,
        cells,
      });
      setSaveMsg(tr("Saved.", "Enregistré."));
      const res = await api.get(`/professeur/paniers/${panierId}/grades-context`, {
        params: { class_id: selected.class_id, annee_scolaire: selected.annee_scolaire },
      });
      setGradesCtx(res.data);
    } catch (err) {
      setSaveErr(err.response?.data?.message || tr("Save failed.", "Échec de l'enregistrement."));
    }
  }

  const slots = gradesCtx?.slots ?? [];

  return (
    <div className="admin-wrap">
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <div className="admin-brand-mark" aria-hidden="true">
            P
          </div>
          <div className="admin-brand-text">
            <div className="admin-brand-title">Scolarité</div>
            <div className="admin-brand-subtitle">{tr("Professor", "Professeur")}</div>
          </div>
        </div>

        <nav className="admin-nav">
          <p className="admin-nav-section-label">{tr("Menu", "Menu")}</p>
          <Link className="admin-nav-item" to="/">
            {tr("Home", "Accueil")}
          </Link>
          <p className="admin-nav-section-label">{tr("Teaching", "Enseignement")}</p>
          <Link className="admin-nav-item" to="/professeur">
            {tr("My classes", "Mes classes")}
          </Link>
          <Link className="admin-nav-item admin-nav-item--active" to="/professeur/notes">
            {tr("Grades", "Notes")}
          </Link>
          <Link className="admin-nav-item" to="/professeur/absences">
            {tr("Absences", "Absences")}
          </Link>
          <Link className="admin-nav-item" to="/professeur/attendance-certificates">
            {t("menuAttendanceCert")}
          </Link>
          <Link className="admin-nav-item" to="/professeur/timetable">
            {tr("Timetable", "Emploi du temps")}
          </Link>
          <Link className="admin-nav-item" to="/professeur/exam-surveillance">
            {tr("Exam surveillance", "Surveillance examens")}
          </Link>
          <p className="admin-nav-section-label">{tr("Campus", "Campus")}</p>
          <Link className="admin-nav-item" to="/student/posts">
            {tr("Posts", "Publications")}
          </Link>
          <Link className="admin-nav-item" to="/student/friends">
            {tr("Friends", "Reseau")}
          </Link>
          <Link className="admin-nav-item" to="/messages/panier">
            {tr("Panier messages", "Messages panier")}
          </Link>
          <p className="admin-nav-section-label">{tr("Account", "Compte")}</p>
          <Link className="admin-nav-item" to="/profile">
            {tr("Profile", "Profil")}
          </Link>
          <Link className="admin-nav-item" to="/change-password">
            {tr("Change password", "Changer le mot de passe")}
          </Link>
        </nav>

        <div className="admin-sidebar-footer">
          <button type="button" className="admin-secondary-btn" style={{ width: "100%" }} onClick={handleLogout}>
            {tr("Logout", "Déconnexion")}
          </button>
        </div>
      </aside>

      <main className="admin-main admin-main--professor">
        <header className="admin-topbar">
          <div>
            <h1 className="admin-title">{tr("Subject grades", "Notes par matière")}</h1>
            <p className="admin-subtitle">
              {tr(
                "Evaluations (DS, exam, TP) are defined by the director of studies on the study plan. You enter one grade per student for the whole subject. Course professors edit DS/Exam; TP professor edits TP.",
                "Les évaluations (DS, examen, TP) sont définies par le directeur des études sur le plan. Vous saisissez une note par étudiant pour toute la matière. Le professeur de cours saisit DS/Examen ; le professeur de TP saisit le TP.",
              )}
            </p>
          </div>
        </header>

        <section className="admin-card admin-card--padded" style={{ marginBottom: "20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            <div>
              <h2 className="admin-card-heading" style={{ marginBottom: 6 }}>
                {tr("Double correction requests", "Demandes de double correction")}
              </h2>
              <p className="admin-subtitle" style={{ margin: 0 }}>
                {tr("Students request a review for a subject (panier). Accept or reject.", "Les étudiants demandent une révision pour une matière (panier). Acceptez ou refusez.")}
              </p>
            </div>
            <button type="button" className="admin-secondary-btn" onClick={loadDoubleCorrections} disabled={dcLoading}>
              {dcLoading ? tr("Loading…", "Chargement…") : tr("Refresh", "Actualiser")}
            </button>
          </div>

          {dcErr ? <p className="auth-error" style={{ marginTop: 10 }}>{dcErr}</p> : null}

          <div className="admin-table-wrap" style={{ marginTop: 12 }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>{tr("Student", "Étudiant")}</th>
                  <th>{tr("Class", "Classe")}</th>
                  <th>{tr("Subject", "Matière")}</th>
                  <th>{tr("Status", "Statut")}</th>
                  <th>{tr("Reason", "Motif")}</th>
                  <th>{tr("Decision note", "Note")}</th>
                  <th style={{ textAlign: "right" }}>{tr("Actions", "Actions")}</th>
                </tr>
              </thead>
              <tbody>
                {dcLoading ? (
                  <tr><td colSpan={7} className="admin-empty">{tr("Loading…", "Chargement…")}</td></tr>
                ) : dcRows.length === 0 ? (
                  <tr><td colSpan={7} className="admin-empty">{tr("No requests.", "Aucune demande.")}</td></tr>
                ) : dcRows.map((r) => (
                  <tr key={r.id}>
                    <td style={{ fontWeight: 900 }}>{r.student?.name || "—"}</td>
                    <td>{r.classe?.name || "—"}{r.classe?.annee_scolaire ? ` — ${r.classe.annee_scolaire}` : ""}</td>
                    <td>{r.panier?.name || "—"}</td>
                    <td style={{ textTransform: "capitalize" }}>{r.status}</td>
                    <td style={{ maxWidth: 260, whiteSpace: "pre-wrap" }}>{r.reason || "—"}</td>
                    <td style={{ minWidth: 220 }}>
                      <input
                        className="admin-input"
                        value={dcNoteById[r.id] ?? ""}
                        onChange={(e) => setDcNoteById((p) => ({ ...p, [r.id]: e.target.value }))}
                        placeholder={tr("Optional note…", "Note optionnelle…")}
                      />
                    </td>
                    <td>
                      <div className="admin-actions" style={{ justifyContent: "flex-end" }}>
                        <button
                          type="button"
                          className="admin-secondary-btn"
                          disabled={dcWorkingId === r.id || r.status !== "pending"}
                          onClick={() => decideDc(r.id, "accepted")}
                        >
                          {tr("Accept", "Accepter")}
                        </button>
                        <button
                          type="button"
                          className="admin-secondary-btn"
                          style={{ borderColor: "#ef4444", color: "#ef4444" }}
                          disabled={dcWorkingId === r.id || r.status !== "pending"}
                          onClick={() => decideDc(r.id, "rejected")}
                        >
                          {tr("Reject", "Refuser")}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="admin-card admin-card--padded" style={{ marginBottom: "20px" }}>
          {loading && <p className="admin-subtitle">{tr("Loading…", "Chargement…")}</p>}
          {loadError && <p className="auth-error">{loadError}</p>}
          {!loading && classes.length > 0 && (
            <>
              <div className="admin-field">
                <label className="admin-label" htmlFor="notes-class-year">
                  {tr("Class & school year", "Classe et année scolaire")}
                </label>
                <select
                  id="notes-class-year"
                  className="admin-input admin-input--width-md"
                  value={selectedKey}
                  onChange={(e) => setSelectedKey(e.target.value)}
                >
                  {classes.map((c) => {
                    const key = selectionKey(c.class_id, c.annee_scolaire);
                    const label = `${c.classe?.name ?? "—"} — ${c.annee_scolaire}`;
                    return (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="admin-field">
                <label className="admin-label" htmlFor="notes-panier">
                  {tr("Subject (panier)", "Matière (panier)")}
                </label>
                <select
                  id="notes-panier"
                  className="admin-input admin-input--width-lg"
                  value={panierId}
                  onChange={(e) => setPanierId(e.target.value)}
                >
                  {paniers.map((p) => (
                    <option key={p.id} value={String(p.id)}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              {activePanier && gradesCtx?.roles && (
                <p className="admin-hint">
                  <strong>{tr("Subject", "Matière")}:</strong> {activePanier.name}
                  {" · "}
                  <strong>{tr("Your roles", "Vos rôles")}:</strong>{" "}
                  {[
                    gradesCtx.roles.cours ? tr("Lecture (cours)", "Cours") : null,
                    gradesCtx.roles.tp ? "TP" : null,
                  ]
                    .filter(Boolean)
                    .join(" · ") || "—"}
                </p>
              )}
            </>
          )}
        </section>

        <section className="admin-card admin-card--padded">
          {studentsLoading && <p className="admin-subtitle">{tr("Loading students…", "Chargement des étudiants…")}</p>}
          {contextLoading && <p className="admin-subtitle">{tr("Loading evaluations…", "Chargement des évaluations…")}</p>}
          {contextErr && <p className="auth-error">{contextErr}</p>}
          {saveErr && <p className="auth-error">{saveErr}</p>}
          {saveMsg && <p className="admin-subtitle" style={{ color: "#15803d" }}>{saveMsg}</p>}

          {!contextLoading && !contextErr && gradesCtx && slots.length === 0 && (
            <p className="admin-subtitle">
              {tr(
                "No evaluations are configured for this subject yet. The director of studies must add DS / Exam / TP on the plan (panier).",
                "Aucune évaluation n'est configurée pour cette matière. Le directeur des études doit ajouter DS / Examen / TP sur le panier du plan.",
              )}
            </p>
          )}

          {!studentsLoading && selected && students.length > 0 && slots.length > 0 && (
            <>
              <div className="admin-toolbar-inline">
                <button type="button" className="admin-primary-btn" onClick={saveAll}>
                  {tr("Save grades", "Enregistrer les notes")}
                </button>
                <span className="admin-subtitle" style={{ margin: 0 }}>
                  {tr("Empty cell clears that grade. Only columns you are allowed to edit are saved.", "Une case vide efface la note. Seules les colonnes autorisées sont enregistrées.")}
                </span>
              </div>
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>{tr("Name", "Nom")}</th>
                      <th>{tr("Student ID", "Matricule")}</th>
                      {slots.map((slot) => (
                        <th key={slot.key} style={{ minWidth: "100px" }}>
                          {slot.label}
                          {slot.weight != null ? ` (${slot.weight})` : ""}
                          {!slot.editable ? (
                            <span style={{ display: "block", fontSize: "10px", fontWeight: 600, color: "#94a3b8" }}>
                              {tr("read-only", "lecture")}
                            </span>
                          ) : null}
                        </th>
                      ))}
                      <th>{tr("Row clear", "Effacer")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((s) => (
                      <tr key={s.id}>
                        <td>{s.name}</td>
                        <td>{s.matricule ?? "—"}</td>
                        {slots.map((slot) => (
                          <td key={slot.key}>
                            {slot.editable ? (
                              <input
                                className="admin-input"
                                style={{ maxWidth: "96px" }}
                                value={draft[s.id]?.[slot.key] ?? ""}
                                onChange={(e) => setCell(s.id, slot.key, e.target.value)}
                                inputMode="decimal"
                                placeholder="—"
                              />
                            ) : (
                              <span>{draft[s.id]?.[slot.key] || "—"}</span>
                            )}
                          </td>
                        ))}
                        <td>
                          {slots.some((sl) => sl.editable) ? (
                            <button
                              type="button"
                              className="admin-secondary-btn"
                              style={{ fontSize: "12px", padding: "6px 10px" }}
                              onClick={async () => {
                                if (!selected || !panierId) return;
                                const cells = slots
                                  .filter((sl) => sl.editable)
                                  .map((sl) => ({ student_id: s.id, evaluation_type: sl.key, note: null }));
                                if (cells.length === 0) return;
                                setSaveErr("");
                                try {
                                  await api.put(`/professeur/paniers/${panierId}/grades`, {
                                    class_id: selected.class_id,
                                    annee_scolaire: selected.annee_scolaire,
                                    cells,
                                  });
                                  setDraft((prev) => {
                                    const row = { ...(prev[s.id] || {}) };
                                    for (const sl of slots) {
                                      if (sl.editable) row[sl.key] = "";
                                    }
                                    return { ...prev, [s.id]: row };
                                  });
                                  setSaveMsg(tr("Row cleared.", "Ligne effacée."));
                                  const res = await api.get(`/professeur/paniers/${panierId}/grades-context`, {
                                    params: { class_id: selected.class_id, annee_scolaire: selected.annee_scolaire },
                                  });
                                  setGradesCtx(res.data);
                                } catch (err) {
                                  setSaveErr(err.response?.data?.message || tr("Clear failed.", "Échec."));
                                }
                              }}
                            >
                              {tr("Clear my grades", "Effacer mes notes")}
                            </button>
                          ) : (
                            "—"
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {!studentsLoading && selected && students.length === 0 && (
            <p className="admin-subtitle">{tr("No students in this class.", "Aucun étudiant dans cette classe.")}</p>
          )}
        </section>
      </main>
    </div>
  );
}
