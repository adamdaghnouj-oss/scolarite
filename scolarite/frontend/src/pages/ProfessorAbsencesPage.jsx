import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../api/axios";
import "./AdminPanel.css";
import { useLanguage } from "../i18n/LanguageContext";
import StaffSidebar from "../components/StaffSidebar";

function selectionKey(classId, year) {
  return `${classId}|${year}`;
}

export default function ProfessorAbsencesPage() {
  const { language } = useLanguage();
  const tr = (en, fr) => (language === "fr" ? fr : en);

  const [payload, setPayload] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedKey, setSelectedKey] = useState("");
  const [panierId, setPanierId] = useState("");

  const [students, setStudents] = useState([]);
  const [studentsLoading, setStudentsLoading] = useState(false);

  const [filterName, setFilterName] = useState("");
  const [filterMinAbs, setFilterMinAbs] = useState("");

  const [overview, setOverview] = useState(null);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [overviewErr, setOverviewErr] = useState("");

  const [sessionDate, setSessionDate] = useState("");
  const [timeStart, setTimeStart] = useState("08:00");
  const [timeEnd, setTimeEnd] = useState("10:00");
  const [draftAttendance, setDraftAttendance] = useState({});
  const [sessionMsg, setSessionMsg] = useState("");
  const [sessionErr, setSessionErr] = useState("");

  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState(null);

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

  const rosterIds = useMemo(() => students.map((s) => s.id).join(","), [students]);
  const attendanceContextSig =
    selected && panierId ? `${selected.class_id}|${selected.annee_scolaire}|${panierId}|${rosterIds}` : "";

  useEffect(() => {
    if (!students.length) {
      setDraftAttendance({});
      return;
    }
    setDraftAttendance(() => {
      const next = {};
      for (const s of students) {
        next[s.id] = "present";
      }
      return next;
    });
  }, [attendanceContextSig]);

  const loadOverview = useCallback(async () => {
    if (!selected || !panierId) return;
    setOverviewLoading(true);
    setOverviewErr("");
    try {
      const params = {
        class_id: selected.class_id,
        annee_scolaire: selected.annee_scolaire,
      };
      const n = filterName.trim();
      if (n) params.name = n;
      const m = filterMinAbs.trim();
      if (m !== "" && !Number.isNaN(Number(m))) params.min_absences = Number(m);

      const res = await api.get(`/professeur/paniers/${panierId}/absences`, { params });
      setOverview(res.data);
    } catch (err) {
      setOverview(null);
      setOverviewErr(err.response?.data?.message || tr("Could not load absences.", "Impossible de charger les absences."));
    } finally {
      setOverviewLoading(false);
    }
  }, [selected, panierId, filterName, filterMinAbs, language]);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  function setStatusFor(studentId, status) {
    setDraftAttendance((prev) => ({ ...prev, [studentId]: status }));
  }

  async function submitSession(e) {
    e.preventDefault();
    if (!selected || !panierId) return;
    setSessionErr("");
    setSessionMsg("");
    const attendance = students.map((s) => ({
      student_id: s.id,
      status: draftAttendance[s.id] === "absent" ? "absent" : "present",
    }));
    try {
      await api.post(`/professeur/paniers/${panierId}/sessions`, {
        class_id: selected.class_id,
        annee_scolaire: selected.annee_scolaire,
        session_date: sessionDate,
        time_start: timeStart,
        time_end: timeEnd,
        attendance,
      });
      setSessionMsg(tr("Session saved.", "Séance enregistrée."));
      await loadOverview();
    } catch (err) {
      setSessionErr(err.response?.data?.message || tr("Save failed.", "Échec de l'enregistrement."));
    }
  }

  async function deleteSession(id) {
    if (!selected || !panierId) return;
    if (!window.confirm(tr("Delete this session?", "Supprimer cette séance ?"))) return;
    try {
      await api.delete(`/professeur/paniers/${panierId}/sessions/${id}`, {
        params: { class_id: selected.class_id, annee_scolaire: selected.annee_scolaire },
      });
      await loadOverview();
    } catch (err) {
      window.alert(err.response?.data?.message || tr("Delete failed.", "Suppression impossible."));
    }
  }

  async function dismissElimination(studentId) {
    if (!selected || !panierId) return;
    try {
      await api.post(`/professeur/paniers/${panierId}/students/${studentId}/dismiss-elimination`, {
        class_id: selected.class_id,
        annee_scolaire: selected.annee_scolaire,
      });
      await loadOverview();
    } catch (err) {
      window.alert(err.response?.data?.message || tr("Action failed.", "Action impossible."));
    }
  }

  function startEdit(sess) {
    setEditingId(sess.id);
    const att = {};
    for (const row of sess.attendance ?? []) {
      att[row.student_id] = row.status;
    }
    setEditDraft({
      session_date: sess.session_date,
      time_start: sess.time_start,
      time_end: sess.time_end,
      attendance: att,
    });
  }

  async function saveEdit() {
    if (!selected || !panierId || !editingId || !editDraft) return;
    const attendance = students.map((s) => ({
      student_id: s.id,
      status: editDraft.attendance[s.id] === "absent" ? "absent" : "present",
    }));
    try {
      await api.put(`/professeur/paniers/${panierId}/sessions/${editingId}`, {
        class_id: selected.class_id,
        annee_scolaire: selected.annee_scolaire,
        session_date: editDraft.session_date,
        time_start: editDraft.time_start,
        time_end: editDraft.time_end,
        attendance,
      });
      setEditingId(null);
      setEditDraft(null);
      await loadOverview();
    } catch (err) {
      window.alert(err.response?.data?.message || tr("Update failed.", "Mise à jour impossible."));
    }
  }

  const overviewStudents = overview?.students ?? [];
  const sessions = overview?.sessions ?? [];
  return (
    <div className="admin-wrap">
      <StaffSidebar variant="professeur" />

      <main className="admin-main admin-main--professor">
        <header className="admin-topbar">
          <div>
            <h1 className="admin-title">{tr("Absences & elimination", "Absences et élimination")}</h1>
            <p className="admin-subtitle">
              {tr(
                "Pick class and subject (panier). Record each session (date, start, end) and mark present or absent for the whole subject. From 3 absences, the student is eliminated unless you dismiss it.",
                "Choisissez la classe et la matière (panier). Enregistrez chaque séance (date, début, fin) et marquez présent/absent pour toute la matière. À partir de 3 absences, l'étudiant est éliminé sauf si vous levez.",
              )}
            </p>
          </div>
        </header>

        <section className="admin-card admin-card--padded" style={{ marginBottom: "20px" }}>
          {loading && <p className="admin-subtitle">{tr("Loading…", "Chargement…")}</p>}
          {loadError && <p className="auth-error">{loadError}</p>}
          {!loading && classes.length > 0 && (
            <>
              <div className="admin-field">
                <label className="admin-label" htmlFor="abs-class-year">
                  {tr("Class & school year", "Classe et année scolaire")}
                </label>
                <select
                  id="abs-class-year"
                  className="admin-input admin-input--width-md"
                  value={selectedKey}
                  onChange={(e) => setSelectedKey(e.target.value)}
                >
                {classes.map((c) => {
                  const key = selectionKey(c.class_id, c.annee_scolaire);
                  return (
                    <option key={key} value={key}>
                      {c.classe?.name ?? "—"} — {c.annee_scolaire}
                    </option>
                  );
                })}
                </select>
              </div>

              <div className="admin-field" style={{ maxWidth: "none" }}>
                <label className="admin-label" htmlFor="abs-panier">
                  {tr("Subject (panier)", "Matière (panier)")}
                </label>
                <select
                  id="abs-panier"
                  className="admin-input admin-input--width-md"
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

              {activePanier && (
                <p className="admin-hint">
                  <strong>{tr("Subject", "Matière")}:</strong> {activePanier.name}
                </p>
              )}

              <div className="admin-field-row">
                <div className="admin-field">
                  <label className="admin-label" htmlFor="abs-filter-name">
                    {tr("Filter name", "Filtrer nom")}
                  </label>
                  <input
                    id="abs-filter-name"
                    className="admin-input"
                    value={filterName}
                    onChange={(e) => setFilterName(e.target.value)}
                    placeholder={tr("Student name", "Nom étudiant")}
                  />
                </div>
                <div className="admin-field">
                  <label className="admin-label" htmlFor="abs-filter-min">
                    {tr("Min. absences", "Absences min.")}
                  </label>
                  <input
                    id="abs-filter-min"
                    className="admin-input"
                    style={{ maxWidth: "140px" }}
                    value={filterMinAbs}
                    onChange={(e) => setFilterMinAbs(e.target.value)}
                    inputMode="numeric"
                    placeholder="0"
                  />
                </div>
                <div className="admin-field--action">
                  <button
                    type="button"
                    className="admin-secondary-btn"
                    onClick={loadOverview}
                    aria-label={tr("Refresh list", "Actualiser la liste")}
                  >
                    {tr("Refresh", "Actualiser")}
                  </button>
                </div>
              </div>
            </>
          )}
        </section>

        <section className="admin-card admin-card--padded" style={{ marginBottom: "20px" }}>
          <h2 className="admin-card-heading">
            {tr("Students", "Étudiants")}
          </h2>
          {overviewErr && <p className="auth-error">{overviewErr}</p>}
          {overviewLoading && <p className="admin-subtitle">{tr("Loading…", "Chargement…")}</p>}
          {!overviewLoading && overviewStudents.length > 0 && (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>{tr("Name", "Nom")}</th>
                    <th>{tr("Absences", "Absences")}</th>
                    <th>{tr("Eliminated", "Éliminé")}</th>
                    <th>{tr("Actions", "Actions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {overviewStudents.map((row) => (
                    <tr key={row.student_id}>
                      <td>{row.name}</td>
                      <td>{row.absence_count}</td>
                      <td>{row.eliminated ? tr("Yes", "Oui") : tr("No", "Non")}</td>
                      <td>
                        {row.eliminated && (
                          <button
                            type="button"
                            className="admin-secondary-btn"
                            onClick={() => dismissElimination(row.student_id)}
                          >
                            {tr("Dismiss elimination", "Lever l'élimination")}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="admin-card admin-card--padded" style={{ marginBottom: "20px" }}>
          <h2 className="admin-card-heading">
            {tr("New session", "Nouvelle séance")}
          </h2>
          {sessionErr && <p className="auth-error">{sessionErr}</p>}
          {sessionMsg && <p className="admin-subtitle" style={{ color: "#15803d" }}>{sessionMsg}</p>}
          <form className="prof-attendance-form" onSubmit={submitSession}>
            <div className="admin-field-row">
              <div className="admin-field">
                <label className="admin-label" htmlFor="abs-session-date">
                  {tr("Date", "Date")}
                </label>
                <input
                  id="abs-session-date"
                  className="admin-input admin-input--time"
                  type="date"
                  required
                  value={sessionDate}
                  onChange={(e) => setSessionDate(e.target.value)}
                />
              </div>
              <div className="admin-field">
                <label className="admin-label" htmlFor="abs-time-start">
                  {tr("Start", "Début")}
                </label>
                <input
                  id="abs-time-start"
                  className="admin-input admin-input--time"
                  type="time"
                  required
                  value={timeStart}
                  onChange={(e) => setTimeStart(e.target.value)}
                />
              </div>
              <div className="admin-field">
                <label className="admin-label" htmlFor="abs-time-end">
                  {tr("End", "Fin")}
                </label>
                <input
                  id="abs-time-end"
                  className="admin-input admin-input--time"
                  type="time"
                  required
                  value={timeEnd}
                  onChange={(e) => setTimeEnd(e.target.value)}
                />
              </div>
            </div>
            {studentsLoading && <p className="admin-subtitle">{tr("Loading students…", "Chargement…")}</p>}
            {!studentsLoading && students.length > 0 && (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>{tr("Student", "Étudiant")}</th>
                      <th>{tr("Status", "Statut")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((s) => (
                      <tr key={s.id}>
                        <td>{s.name}</td>
                        <td>
                          <select
                            className="admin-input admin-input--time"
                            value={draftAttendance[s.id] ?? "present"}
                            onChange={(e) => setStatusFor(s.id, e.target.value)}
                          >
                            <option value="present">{tr("Present", "Présent")}</option>
                            <option value="absent">{tr("Absent", "Absent")}</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <button type="submit" className="admin-primary-btn" disabled={!students.length}>
              {tr("Save session", "Enregistrer la séance")}
            </button>
          </form>
        </section>

        <section className="admin-card admin-card--padded">
          <h2 className="admin-card-heading">
            {tr("Past sessions", "Séances passées")}
          </h2>
          {sessions.length === 0 && <p className="admin-subtitle">{tr("No sessions yet.", "Aucune séance pour l'instant.")}</p>}
          {sessions.map((sess) => (
            <div key={sess.id} className="prof-session-card">
              <div className="prof-session-card__head">
                <p className="prof-session-time">
                  {sess.session_date} · {sess.time_start}–{sess.time_end}
                </p>
                <div className="prof-session-card__actions">
                  <button type="button" className="admin-secondary-btn" onClick={() => startEdit(sess)}>
                    {tr("Edit", "Modifier")}
                  </button>
                  <button type="button" className="admin-secondary-btn" onClick={() => deleteSession(sess.id)}>
                    {tr("Delete", "Supprimer")}
                  </button>
                </div>
              </div>
              {editingId === sess.id && editDraft && (
                <div style={{ marginTop: "16px" }}>
                  <div className="admin-field-row" style={{ marginBottom: "12px" }}>
                    <div className="admin-field">
                      <label className="admin-label">{tr("Date", "Date")}</label>
                      <input
                        className="admin-input admin-input--time"
                        type="date"
                        value={editDraft.session_date}
                        onChange={(e) => setEditDraft({ ...editDraft, session_date: e.target.value })}
                      />
                    </div>
                    <div className="admin-field">
                      <label className="admin-label">{tr("Start", "Début")}</label>
                      <input
                        className="admin-input admin-input--time"
                        type="time"
                        value={editDraft.time_start}
                        onChange={(e) => setEditDraft({ ...editDraft, time_start: e.target.value })}
                      />
                    </div>
                    <div className="admin-field">
                      <label className="admin-label">{tr("End", "Fin")}</label>
                      <input
                        className="admin-input admin-input--time"
                        type="time"
                        value={editDraft.time_end}
                        onChange={(e) => setEditDraft({ ...editDraft, time_end: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="admin-table-wrap">
                    <table className="admin-table">
                      <tbody>
                        {students.map((s) => (
                          <tr key={s.id}>
                            <td>{s.name}</td>
                            <td>
                              <select
                                className="admin-input"
                                value={editDraft.attendance[s.id] === "absent" ? "absent" : "present"}
                                onChange={(e) =>
                                  setEditDraft({
                                    ...editDraft,
                                    attendance: { ...editDraft.attendance, [s.id]: e.target.value },
                                  })
                                }
                              >
                                <option value="present">{tr("Present", "Présent")}</option>
                                <option value="absent">{tr("Absent", "Absent")}</option>
                              </select>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <button type="button" className="admin-primary-btn" style={{ marginTop: "10px" }} onClick={saveEdit}>
                    {tr("Save changes", "Enregistrer")}
                  </button>
                  <button
                    type="button"
                    className="admin-secondary-btn"
                    style={{ marginTop: "10px", marginLeft: "8px" }}
                    onClick={() => {
                      setEditingId(null);
                      setEditDraft(null);
                    }}
                  >
                    {tr("Cancel", "Annuler")}
                  </button>
                </div>
              )}
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}
