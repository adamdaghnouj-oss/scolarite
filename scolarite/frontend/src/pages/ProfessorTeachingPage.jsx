import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../api/axios";
import "./AdminPanel.css";
import { useLanguage } from "../i18n/LanguageContext";
import StaffSidebar from "../components/StaffSidebar";

function toDateInputValue(isoLike) {
  if (!isoLike) return "";
  const d = new Date(isoLike);
  if (Number.isNaN(d.getTime())) return "";
  const yyyy = String(d.getFullYear());
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function selectionKey(classId, year) {
  return `${classId}|${year}`;
}

export default function ProfessorTeachingPage() {
  const { language } = useLanguage();
  const tr = (en, fr) => (language === "fr" ? fr : en);

  const [payload, setPayload] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);

  const [selectedKey, setSelectedKey] = useState("");
  const [students, setStudents] = useState([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [studentsError, setStudentsError] = useState("");

  const fetchTeaching = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const res = await api.get("/professeur/teaching");
      setPayload(res.data);
    } catch (err) {
      const msg = err.response?.data?.message;
      setLoadError(
        msg
          || (language === "fr"
            ? "Impossible de charger vos affectations."
            : "Could not load your teaching assignments."),
      );
      setPayload(null);
    } finally {
      setLoading(false);
    }
  }, [language]);

  useEffect(() => {
    fetchTeaching();
  }, [fetchTeaching]);

  const classes = payload?.classes ?? [];

  const selected = useMemo(() => {
    if (!selectedKey) return null;
    return classes.find((c) => selectionKey(c.class_id, c.annee_scolaire) === selectedKey) ?? null;
  }, [classes, selectedKey]);

  useEffect(() => {
    if (classes.length === 0) {
      setSelectedKey("");
      setStudents([]);
      return;
    }
    if (!selectedKey || !classes.some((c) => selectionKey(c.class_id, c.annee_scolaire) === selectedKey)) {
      const first = classes[0];
      setSelectedKey(selectionKey(first.class_id, first.annee_scolaire));
    }
  }, [classes, selectedKey]);

  useEffect(() => {
    if (!selected) {
      setStudents([]);
      return;
    }
    let cancelled = false;
    setStudentsLoading(true);
    setStudentsError("");
    (async () => {
      try {
        const res = await api.get(`/professeur/classes/${selected.class_id}/students`, {
          params: { annee_scolaire: selected.annee_scolaire },
        });
        if (!cancelled) setStudents(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        const msg = err.response?.data?.message;
        if (!cancelled) {
          setStudents([]);
          setStudentsError(
            msg || (language === "fr" ? "Impossible de charger les etudiants." : "Could not load students."),
          );
        }
      } finally {
        if (!cancelled) setStudentsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selected, language]);

  function planLabel(c) {
    const p = c?.plan;
    if (!p) return tr("(No plan linked)", "(Aucun plan rattache)");
    if (p.title) return p.title;
    const sp = p.specialite?.name;
    if (sp) return sp;
    return tr("Study plan", "Plan d'etudes") + ` #${p.id}`;
  }

  function moduleRoles(m) {
    const bits = [];
    if (m.role_cours) bits.push(tr("Lecture", "Cours"));
    if (m.role_tp) bits.push(tr("Lab (TP)", "TP"));
    return bits.join(" · ") || "—";
  }

  return (
    <div className="admin-wrap">
      <StaffSidebar variant="professeur" />

      <main className="admin-main admin-main--professor">
        <header className="admin-topbar">
          <div>
            <h1 className="admin-title">{tr("Classes you teach", "Classes que vous enseignez")}</h1>
            <p className="admin-subtitle">
              {tr(
                "Read-only: modules and baskets come from the study plan linked to each class (as assigned by the administration). Pick a class to see enrolled students.",
                "Consultation seule : les modules et paniers viennent du plan d'etudes rattache a la classe (affectations administrateur). Choisissez une classe pour voir les etudiants inscrits.",
              )}
            </p>
          </div>
        </header>

        <section className="admin-card admin-card--padded" style={{ marginBottom: "20px" }}>
          {loading && <p className="admin-subtitle">{tr("Loading…", "Chargement…")}</p>}
          {loadError && <p className="auth-error">{loadError}</p>}
          {!loading && !loadError && classes.length === 0 && (
            <p className="admin-subtitle">
              {tr(
                "You have no module assignments yet. The administrator must assign you to each subject (panier: cours + TP) for a class in “Profs / subjects (panier)”.",
                "Vous n'avez pas encore d'affectation. L'administrateur doit vous assigner a chaque matiere (panier : cours + TP) dans « Profs / matieres (panier) ».",
              )}
            </p>
          )}

          {!loading && classes.length > 0 && (
            <>
              <div className="admin-field">
                <label className="admin-label" htmlFor="prof-class-year">
                  {tr("Class & school year", "Classe et annee scolaire")}
                </label>
                <select
                  id="prof-class-year"
                  className="admin-input admin-input--width-md"
                  value={selectedKey}
                  onChange={(e) => setSelectedKey(e.target.value)}
                >
                {classes.map((c) => {
                  const key = selectionKey(c.class_id, c.annee_scolaire);
                  const label = `${c.classe?.name ?? "—"} — ${c.annee_scolaire}${c.classe?.departement ? ` (${c.classe.departement})` : ""}`;
                  return (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  );
                })}
                </select>
              </div>

              {selected && (
                <>
                  <p className="admin-hint">
                    <strong>{tr("Linked plan", "Plan rattache")}:</strong> {planLabel(selected)}
                  </p>
                  <div className="admin-table-wrap">
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th scope="col">{tr("Basket (panier)", "Panier")}</th>
                          <th scope="col">{tr("Module", "Module")}</th>
                          <th scope="col">{tr("Your role", "Votre role")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selected.paniers?.flatMap((panier) =>
                          (panier.modules ?? []).map((m) => (
                            <tr key={`${panier.id}-${m.id}`}>
                              <td>{panier.name}</td>
                              <td>
                                {m.code ? `${m.code} — ` : ""}
                                {m.name}
                              </td>
                              <td>{moduleRoles(m)}</td>
                            </tr>
                          )),
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </>
          )}
        </section>

        <section className="admin-card admin-card--padded">
          <h2 className="admin-card-heading">
            {tr("Student roster (read-only)", "Liste des etudiants (lecture seule)")}
          </h2>
          {studentsError && <p className="auth-error">{studentsError}</p>}
          {studentsLoading && <p className="admin-subtitle">{tr("Loading students…", "Chargement des etudiants…")}</p>}
          {!studentsLoading && selected && students.length === 0 && !studentsError && (
            <p className="admin-subtitle">{tr("No students in this class yet.", "Aucun etudiant dans cette classe pour l'instant.")}</p>
          )}
          {!studentsLoading && students.length > 0 && (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th scope="col">{tr("Name", "Nom")}</th>
                    <th scope="col">{tr("Email", "E-mail")}</th>
                    <th scope="col">{tr("Student ID", "Matricule")}</th>
                    <th scope="col">{tr("Registered", "Inscription")}</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((s) => (
                    <tr key={s.id}>
                      <td>{s.name}</td>
                      <td>{s.email}</td>
                      <td>{s.matricule ?? "—"}</td>
                      <td>{toDateInputValue(s.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
