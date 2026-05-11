import { useState, useEffect, useCallback } from "react";
import { api } from "../api/axios";
import "./AdminPanel.css";
import { useLanguage } from "../i18n/LanguageContext";
import StaffSidebar from "../components/StaffSidebar";

const EMPTY_STUDENT_FORM = { name: "", email: "", password: "", matricule: "" };

function toDateInputValue(isoLike) {
  if (!isoLike) return "";
  const d = new Date(isoLike);
  if (Number.isNaN(d.getTime())) return "";
  const yyyy = String(d.getFullYear());
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export default function DirecteurClassesPage() {
  const { language } = useLanguage();
  const tr = (en, fr) => (language === "fr" ? fr : en);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [selectedClass, setSelectedClass] = useState(null);
  const [students, setStudents] = useState([]);
  const [studentsLoading, setStudentsLoading] = useState(false);

  const [expandedYears, setExpandedYears] = useState({});
  const [expandedDepts, setExpandedDepts] = useState({});
  const levelOptions = [
    { value: "first", label: tr("First year", "1ere annee") },
    { value: "second", label: tr("Second year", "2eme annee") },
    { value: "third_pfe", label: tr("Third year (PFE)", "3eme annee (PFE)") },
  ];
  const levelLabel = (value) => levelOptions.find((o) => o.value === value)?.label || tr("Not set", "Non defini");

  const [studentModal, setStudentModal] = useState(null); // null | 'add' | student object
  const [studentForm, setStudentForm] = useState(EMPTY_STUDENT_FORM);
  const [studentFormError, setStudentFormError] = useState("");
  const [studentFormLoading, setStudentFormLoading] = useState(false);

  const [deleteConfirm, setDeleteConfirm] = useState(null); // { type: 'removeStudent', id }

  const fetchClasses = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.get("/classes");
      setClasses(res.data);
    } catch {
      setError(tr("Failed to load classes.", "Echec du chargement des classes."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchClasses(); }, [fetchClasses]);

  const fetchStudents = useCallback(async (classId) => {
    setStudentsLoading(true);
    try {
      const res = await api.get(`/classes/${classId}/students`);
      setStudents(res.data);
    } catch {
      setStudents([]);
    } finally {
      setStudentsLoading(false);
    }
  }, []);

  function openClass(cls) {
    setSelectedClass(cls);
    fetchStudents(cls.id);
  }

  function toggleYear(year) {
    setExpandedYears((prev) => ({ ...prev, [year]: !prev[year] }));
    setExpandedDepts((prev) => ({ ...prev, [year]: true }));
  }

  function toggleDept(year, dept) {
    setExpandedDepts((prev) => ({ ...prev, [`${year}-${dept}`]: !prev[`${year}-${dept}`] }));
  }

  // --- Student CRUD (allowed for Directeur des Etudes) ---
  function openAddStudent() {
    setStudentForm(EMPTY_STUDENT_FORM);
    setStudentFormError("");
    setStudentModal("add");
  }

  function openEditStudent(s) {
    setStudentForm({ name: s.name, email: s.email, password: "", matricule: s.matricule });
    setStudentFormError("");
    setStudentModal(s);
  }

  async function handleStudentSubmit(e) {
    e.preventDefault();
    setStudentFormError("");
    setStudentFormLoading(true);
    try {
      if (studentModal === "add") {
        const res = await api.post(`/classes/${selectedClass.id}/students`, studentForm);
        setStudents((prev) => [...prev, res.data]);
        setClasses((prev) => prev.map((c) => c.id === selectedClass.id ? { ...c, students_count: (c.students_count || 0) + 1 } : c));
      } else {
        const payload = { name: studentForm.name, email: studentForm.email, matricule: studentForm.matricule };
        const res = await api.put(`/classes/${selectedClass.id}/students/${studentModal.id}`, payload);
        setStudents((prev) => prev.map((s) => s.id === studentModal.id ? res.data : s));
      }
      setStudentModal(null);
    } catch (err) {
      const d = err.response?.data;
      setStudentFormError(d?.message || (d?.errors ? Object.values(d.errors).flat().join(" ") : "Error saving student."));
    } finally {
      setStudentFormLoading(false);
    }
  }

  async function handleRemoveStudent(studentId) {
    try {
      await api.delete(`/classes/${selectedClass.id}/students/${studentId}/remove`);
      setStudents((prev) => prev.filter((s) => s.id !== studentId));
      setClasses((prev) => prev.map((c) => c.id === selectedClass.id ? { ...c, students_count: Math.max(0, (c.students_count || 1) - 1) } : c));
    } catch {
      alert("Failed to remove student from class.");
    }
    setDeleteConfirm(null);
  }

  // Group classes: year → department → classes
  const byYear = classes.reduce((acc, cls) => {
    const year = cls.annee_scolaire || "No Year";
    if (!acc[year]) acc[year] = {};
    const dept = cls.departement || "No Department";
    if (!acc[year][dept]) acc[year][dept] = [];
    acc[year][dept].push(cls);
    return acc;
  }, {});

  const sortedYears = Object.keys(byYear).sort((a, b) => b.localeCompare(a));

  return (
    <div className="admin-wrap">
      <StaffSidebar variant="directeur" />

      <main className="admin-main">
        <header className="admin-topbar">
          <div>
            <h1 className="admin-title">{tr("Classes", "Classes")}</h1>
            <p className="admin-subtitle">{tr("View classes and manage students (no class creation/deletion)", "Voir les classes et gerer les etudiants (pas de creation/suppression de classe)")}</p>
          </div>
        </header>

        {error && <p style={{ color: "red", padding: "0 24px" }}>{error}</p>}

        <div style={{ display: "grid", gridTemplateColumns: selectedClass ? "1fr 1fr" : "1fr", gap: "20px", padding: "0 24px 24px" }}>
          {/* Classes panel (read-only) */}
          <section className="admin-card" style={{ padding: "0" }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid #e6ecf5", fontWeight: 700, fontSize: "0.95rem" }}>
              All Classes
            </div>
            {loading ? (
              <p style={{ padding: "1rem", textAlign: "center" }}>Loading...</p>
            ) : sortedYears.length === 0 ? (
              <p style={{ padding: "1rem", textAlign: "center", color: "#64748b" }}>No classes found.</p>
            ) : (
              sortedYears.map((year) => (
                <div key={year}>
                  <div
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "12px 20px", background: "#2563eb", color: "white",
                      cursor: "pointer", userSelect: "none"
                    }}
                    onClick={() => toggleYear(year)}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <span style={{ fontSize: "1rem" }}>{expandedYears[year] === false ? "▶" : "▼"}</span>
                      <span style={{ fontWeight: 700, fontSize: "0.95rem" }}>📅 {year}</span>
                      <span style={{ fontSize: "0.78rem", opacity: 0.85 }}>
                        ({Object.values(byYear[year]).flat().length} classes)
                      </span>
                    </div>
                  </div>

                  {expandedYears[year] !== false && Object.entries(byYear[year]).map(([dept, deptClasses]) => {
                    if (dept === "__YEAR__") return null;
                    const deptKey = `${year}-${dept}`;
                    const isDeptExpanded = expandedDepts[deptKey] !== false;
                    return (
                      <div key={dept}>
                        <div
                          style={{
                            display: "flex", alignItems: "center", justifyContent: "space-between",
                            padding: "8px 20px 8px 36px", background: "#f1f5f9", fontSize: "0.78rem", fontWeight: 700,
                            color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em", cursor: "pointer"
                          }}
                          onClick={() => toggleDept(year, dept)}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <span>{isDeptExpanded ? "▼" : "▶"}</span>
                            <span>🏛 {dept}</span>
                            <span style={{ fontWeight: 400, textTransform: "none" }}>({deptClasses.length} classes)</span>
                          </div>
                        </div>
                        {isDeptExpanded && deptClasses.map((cls) => (
                          <div
                            key={cls.id}
                            style={{
                              display: "flex", alignItems: "center", justifyContent: "space-between",
                              padding: "11px 20px 11px 56px", borderBottom: "1px solid #f1f5f9", cursor: "pointer",
                              background: selectedClass?.id === cls.id ? "#eff6ff" : "white",
                              transition: "background 0.15s"
                            }}
                            onClick={() => openClass(cls)}
                          >
                            <div>
                              <div style={{ fontWeight: 600, color: "#0f172a" }}>{cls.name}</div>
                              <div style={{ fontSize: "0.78rem", color: "#64748b" }}>
                                {levelLabel(cls.niveau)} · {cls.students_count ?? 0} students
                              </div>
                            </div>
                            <div style={{ fontSize: "0.78rem", color: "#64748b" }}>
                              {toDateInputValue(cls.created_at)}
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              ))
            )}
          </section>

          {/* Students panel (editable) */}
          {selectedClass && (
            <section className="admin-card" style={{ padding: "0" }}>
              <div style={{ padding: "16px 20px", borderBottom: "1px solid #e6ecf5", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: "0.95rem" }}>{selectedClass.name}</div>
                  <div style={{ fontSize: "0.78rem", color: "#64748b" }}>
                    {selectedClass.annee_scolaire && <span>{selectedClass.annee_scolaire} · </span>}
                    {selectedClass.departement || "No department"} · {levelLabel(selectedClass.niveau)}
                  </div>
                </div>
                <div style={{ display: "flex", gap: "8px" }}>
                  <button type="button" className="admin-primary-btn" style={{ padding: "7px 12px", fontSize: "0.82rem" }} onClick={openAddStudent}>+ Add Student</button>
                  <button type="button" className="admin-icon-btn" onClick={() => setSelectedClass(null)} title="Close">✕</button>
                </div>
              </div>
              {studentsLoading ? (
                <p style={{ padding: "1rem", textAlign: "center" }}>Loading students...</p>
              ) : students.length === 0 ? (
                <p style={{ padding: "1rem", textAlign: "center", color: "#64748b" }}>No students in this class.</p>
              ) : (
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Matricule</th>
                      <th>Email</th>
                      <th className="admin-actions-col">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((s) => (
                      <tr key={s.id}>
                        <td className="admin-name-cell">
                          <div className="admin-avatar">{String(s.name).slice(0, 1).toUpperCase()}</div>
                          <div className="admin-name-block">
                            <div className="admin-name">{s.name}</div>
                          </div>
                        </td>
                        <td>{s.matricule}</td>
                        <td>{s.email}</td>
                        <td className="admin-actions">
                          <button type="button" className="admin-icon-btn" onClick={() => openEditStudent(s)} title="Edit">✎</button>
                          <button
                            type="button"
                            className="admin-icon-btn"
                            style={{ color: "#ef4444" }}
                            onClick={() => setDeleteConfirm({ type: "removeStudent", id: s.id })}
                            title="Remove from class"
                          >
                            ⛔
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
          )}
        </div>
      </main>

      {/* Student modal */}
      {studentModal !== null && (
        <div className="admin-modal-overlay" onClick={() => setStudentModal(null)}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h2 className="admin-modal-title">{studentModal === "add" ? "Add Student" : "Edit Student"}</h2>
              <button type="button" className="admin-modal-close" onClick={() => setStudentModal(null)}>✕</button>
            </div>
            <form className="admin-modal-form" onSubmit={handleStudentSubmit}>
              {studentFormError && <p className="auth-error">{studentFormError}</p>}
              <label className="admin-label">Name *</label>
              <input className="admin-input" value={studentForm.name} onChange={(e) => setStudentForm({ ...studentForm, name: e.target.value })} required placeholder="Full name" />
              <label className="admin-label">Email *</label>
              <input className="admin-input" type="email" value={studentForm.email} onChange={(e) => setStudentForm({ ...studentForm, email: e.target.value })} required placeholder="email@example.com" />
              {studentModal === "add" && (
                <>
                  <label className="admin-label">Password *</label>
                  <input className="admin-input" type="password" value={studentForm.password} onChange={(e) => setStudentForm({ ...studentForm, password: e.target.value })} required placeholder="Min 8 characters" />
                </>
              )}
              <label className="admin-label">Matricule *</label>
              <input className="admin-input" value={studentForm.matricule} onChange={(e) => setStudentForm({ ...studentForm, matricule: e.target.value })} required placeholder="2025-0001" />
              <div className="admin-modal-actions">
                <button type="button" className="admin-secondary-btn" onClick={() => setStudentModal(null)}>Cancel</button>
                <button type="submit" className="admin-primary-btn" disabled={studentFormLoading}>{studentFormLoading ? "Saving..." : "Save"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Remove confirm */}
      {deleteConfirm && (
        <div className="admin-modal-overlay" onClick={() => setDeleteConfirm(null)}>
          <div className="admin-modal" style={{ maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h2 className="admin-modal-title">Confirm</h2>
              <button type="button" className="admin-modal-close" onClick={() => setDeleteConfirm(null)}>✕</button>
            </div>
            <p style={{ color: "#475569", marginBottom: "20px" }}>
              Remove this student from the class? (The student account will not be deleted.)
            </p>
            <div className="admin-modal-actions">
              <button type="button" className="admin-secondary-btn" onClick={() => setDeleteConfirm(null)}>Cancel</button>
              <button
                type="button"
                className="admin-primary-btn"
                style={{ background: "#ef4444" }}
                onClick={() => handleRemoveStudent(deleteConfirm.id)}
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

