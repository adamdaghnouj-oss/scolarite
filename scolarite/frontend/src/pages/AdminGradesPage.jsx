import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../api/axios";
import "./AdminPanel.css";
import { useLanguage } from "../i18n/LanguageContext";
import StaffSidebar from "../components/StaffSidebar";

export default function AdminGradesPage() {
  const { language } = useLanguage();
  const tr = (en, fr) => (language === "fr" ? fr : en);
  const classLevelLabel = (value) => {
    if (value === "first") return tr("First year", "1ere annee");
    if (value === "second") return tr("Second year", "2eme annee");
    if (value === "third_pfe") return tr("Third year (PFE)", "3eme annee (PFE)");
    return tr("Level not set", "Niveau non defini");
  };

  const [classes, setClasses] = useState([]);
  const [classesLoading, setClassesLoading] = useState(true);
  const [classesErr, setClassesErr] = useState("");

  const [classId, setClassId] = useState("");
  const [overview, setOverview] = useState(null);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [overviewErr, setOverviewErr] = useState("");

  const [panierId, setPanierId] = useState("");
  const [students, setStudents] = useState([]);
  const [studentsLoading, setStudentsLoading] = useState(false);

  const [gradesCtx, setGradesCtx] = useState(null);
  const [contextLoading, setContextLoading] = useState(false);
  const [contextErr, setContextErr] = useState("");

  const [draft, setDraft] = useState({});
  const [saveMsg, setSaveMsg] = useState("");
  const [saveErr, setSaveErr] = useState("");

  const [semester, setSemester] = useState(null);
  const [semesterLoading, setSemesterLoading] = useState(false);

  const activeClass = useMemo(() => classes.find((c) => String(c.id) === String(classId)) ?? null, [classes, classId]);
  const year = activeClass?.annee_scolaire ? String(activeClass.annee_scolaire) : "";

  const paniers = useMemo(() => {
    const list = [...(overview?.paniers ?? [])];
    list.sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0) || (a.id ?? 0) - (b.id ?? 0));
    return list;
  }, [overview]);

  const activePanier = useMemo(() => {
    if (!panierId) return null;
    return paniers.find((p) => String(p.id) === String(panierId)) ?? null;
  }, [paniers, panierId]);

  const fetchClasses = useCallback(async () => {
    setClassesLoading(true);
    setClassesErr("");
    try {
      const res = await api.get("/classes");
      setClasses(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      setClassesErr(err.response?.data?.message || tr("Could not load classes.", "Impossible de charger les classes."));
      setClasses([]);
    } finally {
      setClassesLoading(false);
    }
  }, [language]);

  useEffect(() => {
    fetchClasses();
  }, [fetchClasses]);

  useEffect(() => {
    if (classes.length === 0) {
      setClassId("");
      return;
    }
    if (!classId || !classes.some((c) => String(c.id) === String(classId))) {
      setClassId(String(classes[0].id));
    }
  }, [classes, classId]);

  useEffect(() => {
    if (!classId || !year) {
      setOverview(null);
      return;
    }
    let cancelled = false;
    setOverviewLoading(true);
    setOverviewErr("");
    (async () => {
      try {
        const res = await api.get(`/admin/classes/${classId}/grades-overview`, { params: { annee_scolaire: year } });
        if (!cancelled) setOverview(res.data);
      } catch (err) {
        if (!cancelled) {
          setOverview(null);
          setOverviewErr(err.response?.data?.message || tr("Could not load grade overview.", "Impossible de charger l'aperçu des notes."));
        }
      } finally {
        if (!cancelled) setOverviewLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [classId, year]);

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
    if (!classId) {
      setStudents([]);
      return;
    }
    let cancelled = false;
    setStudentsLoading(true);
    (async () => {
      try {
        const res = await api.get(`/classes/${classId}/students`);
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
  }, [classId]);

  useEffect(() => {
    if (!classId || !year || !panierId) {
      setGradesCtx(null);
      setDraft({});
      return;
    }
    let cancelled = false;
    setContextLoading(true);
    setContextErr("");
    (async () => {
      try {
        const res = await api.get(`/admin/paniers/${panierId}/grades-context`, {
          params: { class_id: classId, annee_scolaire: year },
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
  }, [classId, year, panierId, language]);

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
    if (!classId || !year) {
      setSemester(null);
      return;
    }
    let cancelled = false;
    setSemesterLoading(true);
    (async () => {
      try {
        const res = await api.get(`/admin/classes/${classId}/semester-summary`, { params: { annee_scolaire: year } });
        if (!cancelled) setSemester(res.data);
      } catch {
        if (!cancelled) setSemester(null);
      } finally {
        if (!cancelled) setSemesterLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [classId, year, gradesCtx]);

  useEffect(() => {
    setSaveMsg("");
    setSaveErr("");
  }, [classId, panierId]);

  function setCell(studentId, evalKey, value) {
    setDraft((prev) => ({
      ...prev,
      [studentId]: { ...(prev[studentId] || {}), [evalKey]: value },
    }));
  }

  async function refreshOverviewAndContext() {
    if (!classId || !year) return;
    const [ov, ctx] = await Promise.all([
      api.get(`/admin/classes/${classId}/grades-overview`, { params: { annee_scolaire: year } }),
      panierId
        ? api.get(`/admin/paniers/${panierId}/grades-context`, { params: { class_id: classId, annee_scolaire: year } })
        : Promise.resolve(null),
    ]);
    setOverview(ov.data);
    if (ctx) setGradesCtx(ctx.data);
    const sm = await api.get(`/admin/classes/${classId}/semester-summary`, { params: { annee_scolaire: year } });
    setSemester(sm.data);
  }

  async function saveAll() {
    if (!classId || !year || !panierId || !gradesCtx) return;
    const slots = gradesCtx.slots ?? [];
    const cells = [];
    for (const s of students) {
      for (const slot of slots) {
        const raw = (draft[s.id]?.[slot.key] ?? "").trim();
        if (raw === "") {
          cells.push({ student_id: s.id, evaluation_type: slot.key, note: null });
        } else {
          const n = Number(raw);
          if (Number.isNaN(n)) {
            setSaveErr(tr("Invalid grade value.", "Note invalide."));
            return;
          }
          cells.push({ student_id: s.id, evaluation_type: slot.key, note: n });
        }
      }
    }
    if (cells.length === 0) {
      setSaveErr(tr("Nothing to save.", "Rien à enregistrer."));
      return;
    }
    setSaveErr("");
    setSaveMsg("");
    try {
      await api.put(`/admin/paniers/${panierId}/grades`, {
        class_id: Number(classId),
        annee_scolaire: year,
        cells,
      });
      setSaveMsg(tr("Saved.", "Enregistré."));
      await refreshOverviewAndContext();
    } catch (err) {
      setSaveErr(err.response?.data?.message || tr("Save failed.", "Échec de l'enregistrement."));
    }
  }

  async function publishToggle(publish) {
    if (!classId || !year) return;
    setSaveErr("");
    setSaveMsg("");
    try {
      if (publish) {
        await api.post(`/admin/classes/${classId}/grades/publish`, { annee_scolaire: year });
        setSaveMsg(tr("Grades published for students.", "Notes publiées pour les étudiants."));
      } else {
        await api.post(`/admin/classes/${classId}/grades/unpublish`, { annee_scolaire: year });
        setSaveMsg(tr("Grades hidden from students.", "Notes masquées pour les étudiants."));
      }
      await refreshOverviewAndContext();
    } catch (err) {
      setSaveErr(err.response?.data?.message || tr("Update failed.", "Échec."));
    }
  }

  async function downloadPdfExport() {
    if (!classId || !year) return;
    setSaveErr("");
    try {
      const res = await api.get(`/admin/classes/${classId}/grades/export-pdf`, {
        params: { annee_scolaire: year },
        responseType: "blob",
      });
      const blob = new Blob([res.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      const className = (activeClass?.name || "class").replace(/[^a-z0-9_-]+/gi, "_");
      a.href = url;
      a.download = `grades_${className}_${year}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setSaveErr(err.response?.data?.message || tr("PDF export failed.", "Échec de l'export PDF."));
    }
  }

  const slots = gradesCtx?.slots ?? [];
  const studentMoyennes = gradesCtx?.student_moyennes ?? {};
  const published = overview?.grades_published ?? false;

  return (
    <div className="admin-wrap">
      <StaffSidebar variant="admin" />

      <main className="admin-main">
        <header className="admin-topbar">
          <div>
            <h1 className="admin-title">{tr("Grades (admin)", "Notes (administrateur)")}</h1>
            <p className="admin-subtitle">
              {tr(
                "Review and edit all subject (panier) grades entered by professors. Weights on the study plan drive the /20 subject average (LMD-style). Publish when students should see their results.",
                "Consultez et modifiez les notes par matière (panier) saisies par les professeurs. Les coefficients du plan d'études calculent la moyenne de matière sur 20 (logique LMD). Publiez lorsque les étudiants doivent voir leurs résultats.",
              )}
            </p>
          </div>
        </header>

        <section className="admin-card admin-card--padded" style={{ marginBottom: "20px" }}>
          {classesLoading && <p className="admin-subtitle">{tr("Loading…", "Chargement…")}</p>}
          {classesErr && <p className="auth-error">{classesErr}</p>}
          {!classesLoading && classes.length > 0 && (
            <>
              <div className="admin-field">
                <label className="admin-label" htmlFor="adm-notes-class">
                  {tr("Class", "Classe")}
                </label>
                <select
                  id="adm-notes-class"
                  className="admin-input admin-input--width-lg"
                  value={classId}
                  onChange={(e) => setClassId(e.target.value)}
                >
                  {classes.map((c) => (
                    <option key={c.id} value={String(c.id)}>
                      {c.name}
                      {` (${classLevelLabel(c.niveau)})`}
                      {c.annee_scolaire ? ` — ${c.annee_scolaire}` : ""}
                    </option>
                  ))}
                </select>
              </div>

              {!year && (
                <p className="auth-error">
                  {tr("This class has no school year set. Edit the class to set « année scolaire ».", "Cette classe n'a pas d'année scolaire. Modifiez la classe pour renseigner l'année scolaire.")}
                </p>
              )}

              {year && (
                <>
                  <div className="admin-field">
                    <label className="admin-label" htmlFor="adm-notes-panier">
                      {tr("Subject (panier)", "Matière (panier)")}
                    </label>
                    <select
                      id="adm-notes-panier"
                      className="admin-input admin-input--width-lg"
                      value={panierId}
                      onChange={(e) => setPanierId(e.target.value)}
                      disabled={paniers.length === 0}
                    >
                      {paniers.map((p) => (
                        <option key={p.id} value={String(p.id)}>
                          {p.name}
                          {p.coefficient_ue != null ? ` (coef. UE ${p.coefficient_ue})` : ""}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="admin-toolbar-inline" style={{ flexWrap: "wrap", gap: "12px" }}>
                    <span className="admin-subtitle" style={{ margin: 0 }}>
                      <strong>{tr("Student visibility", "Visibilité étudiants")}:</strong>{" "}
                      {published ? tr("Published", "Publié") : tr("Hidden", "Masqué")}
                    </span>
                    <button type="button" className="admin-secondary-btn" disabled={overviewLoading} onClick={downloadPdfExport}>
                      {tr("Download class grades (PDF)", "Télécharger les notes de la classe (PDF)")}
                    </button>
                    <button type="button" className="admin-primary-btn" disabled={overviewLoading} onClick={() => publishToggle(true)}>
                      {tr("Publish grades", "Publier les notes")}
                    </button>
                    <button type="button" className="admin-secondary-btn" disabled={overviewLoading} onClick={() => publishToggle(false)}>
                      {tr("Unpublish", "Dépublier")}
                    </button>
                  </div>
                </>
              )}
            </>
          )}
        </section>

        {overviewErr && <p className="auth-error">{overviewErr}</p>}
        {overviewLoading && year && <p className="admin-subtitle">{tr("Loading overview…", "Chargement…")}</p>}

        {gradesCtx?.lmd?.hint && (
          <section className="admin-card admin-card--padded" style={{ marginBottom: "20px" }}>
            <h2 className="admin-title" style={{ fontSize: "18px" }}>
              {tr("LMD /20 calculation", "Calcul LMD sur /20")}
            </h2>
            <p className="admin-subtitle" style={{ marginTop: "8px" }}>
              {tr(
                gradesCtx.lmd.hint,
                "Contrôle continu (DS, TP, etc.) et examen final sont pondérés selon les coefficients du plan (ex. CC×0,3 + EF×0,7). La moyenne de matière utilise les poids du plan lorsqu'ils sont renseignés.",
              )}
            </p>
            <p className="admin-hint" style={{ marginTop: "10px" }}>
              {tr(
                "Subject average in the table uses plan weights when present (e.g. 30 + 70 for CC and final exam). Semester line uses Σ(moyenne × UE coefficient) / Σ(coefficients).",
                "La moyenne de matière dans le tableau utilise les pondérations du plan (ex. 30 et 70 pour CC et examen final). La ligne semestre utilise Σ(moyenne × coef. UE) / Σ(coef.).",
              )}
            </p>
          </section>
        )}

        <section className="admin-card admin-card--padded" style={{ marginBottom: "20px" }}>
          <h2 className="admin-title" style={{ fontSize: "18px" }}>
            {tr("Semester averages (class)", "Moyennes semestrielles (classe)")}
          </h2>
          {semesterLoading && <p className="admin-subtitle">{tr("Loading…", "Chargement…")}</p>}
          {!semesterLoading && semester?.students?.length > 0 && (
            <div className="admin-table-wrap" style={{ marginTop: "12px" }}>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>{tr("Name", "Nom")}</th>
                    <th>{tr("Student ID", "Matricule")}</th>
                    <th>{tr("Semester avg.", "Moy. semestre")}</th>
                  </tr>
                </thead>
                <tbody>
                  {semester.students.map((row) => (
                    <tr key={row.student_id}>
                      <td>{row.name}</td>
                      <td>{row.matricule ?? "—"}</td>
                      <td>{row.moyenne_semestrielle != null ? row.moyenne_semestrielle : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {!semesterLoading && (!semester?.students || semester.students.length === 0) && (
            <p className="admin-subtitle">{tr("No students or no data.", "Aucun étudiant ou aucune donnée.")}</p>
          )}
        </section>

        <section className="admin-card admin-card--padded">
          {studentsLoading && <p className="admin-subtitle">{tr("Loading students…", "Chargement des étudiants…")}</p>}
          {contextLoading && <p className="admin-subtitle">{tr("Loading evaluations…", "Chargement des évaluations…")}</p>}
          {contextErr && <p className="auth-error">{contextErr}</p>}
          {saveErr && <p className="auth-error">{saveErr}</p>}
          {saveMsg && (
            <p className="admin-subtitle" style={{ color: "#15803d" }}>
              {saveMsg}
            </p>
          )}

          {activePanier && gradesCtx && (
            <p className="admin-hint">
              <strong>{tr("Subject", "Matière")}:</strong> {activePanier.name}
              {gradesCtx.coefficient_ue != null ? ` · ${tr("UE coeff.", "Coef. UE")}: ${gradesCtx.coefficient_ue}` : ""}
            </p>
          )}

          {!contextLoading && !contextErr && gradesCtx && slots.length === 0 && (
            <p className="admin-subtitle">
              {tr(
                "No evaluations configured for this subject. The director of studies must add them on the plan.",
                "Aucune évaluation pour cette matière. Le directeur des études doit les ajouter sur le plan.",
              )}
            </p>
          )}

          {!studentsLoading && year && students.length > 0 && slots.length > 0 && (
            <>
              <div className="admin-toolbar-inline">
                <button type="button" className="admin-primary-btn" onClick={saveAll}>
                  {tr("Save all grades", "Enregistrer toutes les notes")}
                </button>
                <span className="admin-subtitle" style={{ margin: 0 }}>
                  {tr("Empty cell removes that grade (also clears professor-entered value).", "Une case vide supprime la note (y compris celle saisie par un professeur).")}
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
                        </th>
                      ))}
                      <th>{tr("Subject avg.", "Moy. matière")}</th>
                      <th>{tr("Clear row", "Effacer ligne")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((s) => (
                      <tr key={s.id}>
                        <td>{s.name}</td>
                        <td>{s.matricule ?? "—"}</td>
                        {slots.map((slot) => (
                          <td key={slot.key}>
                            <input
                              className="admin-input"
                              style={{ maxWidth: "96px" }}
                              value={draft[s.id]?.[slot.key] ?? ""}
                              onChange={(e) => setCell(s.id, slot.key, e.target.value)}
                              inputMode="decimal"
                              placeholder="—"
                            />
                          </td>
                        ))}
                        <td>{studentMoyennes[String(s.id)]?.moyenne_matiere ?? "—"}</td>
                        <td>
                          <button
                            type="button"
                            className="admin-secondary-btn"
                            style={{ fontSize: "12px", padding: "6px 10px" }}
                            onClick={async () => {
                              if (!classId || !year || !panierId) return;
                              const cells = slots.map((sl) => ({ student_id: s.id, evaluation_type: sl.key, note: null }));
                              setSaveErr("");
                              try {
                                await api.put(`/admin/paniers/${panierId}/grades`, {
                                  class_id: Number(classId),
                                  annee_scolaire: year,
                                  cells,
                                });
                                setSaveMsg(tr("Row cleared.", "Ligne effacée."));
                                await refreshOverviewAndContext();
                              } catch (err) {
                                setSaveErr(err.response?.data?.message || tr("Clear failed.", "Échec."));
                              }
                            }}
                          >
                            {tr("Delete row grades", "Supprimer les notes")}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {!studentsLoading && classId && students.length === 0 && (
            <p className="admin-subtitle">{tr("No students in this class.", "Aucun étudiant dans cette classe.")}</p>
          )}
        </section>
      </main>
    </div>
  );
}
