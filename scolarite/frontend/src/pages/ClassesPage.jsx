import { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/axios";
import { clearAuth } from "../auth/auth";
import "./AdminPanel.css";
import { useLanguage } from "../i18n/LanguageContext";

const EMPTY_CLASS_FORM = { name: "", departement: "", annee_scolaire: "" };
const EMPTY_STUDENT_FORM = { name: "", email: "", password: "", matricule: "" };
const EMPTY_YEAR_FORM = { annee_scolaire: "" };
const EMPTY_DEPT_FORM = { departement: "" };

export default function ClassesPage() {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const tr = (en, fr) => (language === "fr" ? fr : en);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Selected class for viewing students
  const [selectedClass, setSelectedClass] = useState(null);
  const [students, setStudents] = useState([]);
  const [studentsLoading, setStudentsLoading] = useState(false);

  // Expanded years
  const [expandedYears, setExpandedYears] = useState({});

  // Class modal
  const [classModal, setClassModal] = useState(null); // null | 'add' | class object
  const [classForm, setClassForm] = useState(EMPTY_CLASS_FORM);
  const [classFormError, setClassFormError] = useState("");
  const [classFormLoading, setClassFormLoading] = useState(false);

  // Student modal
  const [studentModal, setStudentModal] = useState(null); // null | 'add' | student object
  const [studentForm, setStudentForm] = useState(EMPTY_STUDENT_FORM);
  const [studentFormError, setStudentFormError] = useState("");
  const [studentFormLoading, setStudentFormLoading] = useState(false);

  // Delete confirm
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  // Year and Department modals
  const [yearModal, setYearModal] = useState(false);
  const [yearForm, setYearForm] = useState(EMPTY_YEAR_FORM);
  const [yearFormError, setYearFormError] = useState("");
  const [yearFormLoading, setYearFormLoading] = useState(false);

  const [deptModal, setDeptModal] = useState(null); // null | { year: "2024-2025" }
  const [deptForm, setDeptForm] = useState(EMPTY_DEPT_FORM);
  const [deptFormError, setDeptFormError] = useState("");
  const [deptFormLoading, setDeptFormLoading] = useState(false);

  // Track which years have departments expanded
  const [expandedDepts, setExpandedDepts] = useState({});

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
    // Also expand departments when year is expanded
    setExpandedDepts((prev) => ({ ...prev, [year]: true }));
  }

  function toggleDept(year, dept) {
    setExpandedDepts((prev) => ({ ...prev, [`${year}-${dept}`]: !prev[`${year}-${dept}`] }));
  }

  // --- Year CRUD ---
  function openAddYear() {
    setYearForm(EMPTY_YEAR_FORM);
    setYearFormError("");
    setYearModal(true);
  }

  async function handleYearSubmit(e) {
    e.preventDefault();
    setYearFormError("");
    setYearFormLoading(true);
    try {
      // Create a dummy class with just the year to store it
      await api.post("/classes", { name: "YearPlaceholder", annee_scolaire: yearForm.annee_scolaire, departement: "__YEAR__" });
      setYearModal(false);
      fetchClasses();
    } catch (err) {
      const d = err.response?.data;
      setYearFormError(d?.message || (d?.errors ? Object.values(d.errors).flat().join(" ") : "Error adding year."));
    } finally {
      setYearFormLoading(false);
    }
  }

  // --- Department CRUD ---
  function openAddDept(year) {
    setDeptForm(EMPTY_DEPT_FORM);
    setDeptFormError("");
    setDeptModal({ year });
  }

  async function handleDeptSubmit(e) {
    e.preventDefault();
    setDeptFormError("");
    setDeptFormLoading(true);
    try {
      // Create a dummy class with just the year and department
      await api.post("/classes", { name: "DeptPlaceholder", annee_scolaire: deptModal.year, departement: deptForm.departement });
      setDeptModal(null);
      fetchClasses();
      // Expand the year
      setExpandedYears((prev) => ({ ...prev, [deptModal.year]: true }));
      setExpandedDepts((prev) => ({ ...prev, [deptModal.year]: true }));
    } catch (err) {
      const d = err.response?.data;
      setDeptFormError(d?.message || (d?.errors ? Object.values(d.errors).flat().join(" ") : "Error adding department."));
    } finally {
      setDeptFormLoading(false);
    }
  }

  // --- Class CRUD ---
  function openAddClass(prefillYear = "", prefillDept = "") {
    setClassForm({ ...EMPTY_CLASS_FORM, annee_scolaire: prefillYear, departement: prefillDept });
    setClassFormError("");
    setClassModal("add");
  }

  function openEditClass(cls) {
    setClassForm({ name: cls.name, departement: cls.departement || "", annee_scolaire: cls.annee_scolaire || "" });
    setClassFormError("");
    setClassModal(cls);
  }

  async function handleClassSubmit(e) {
    e.preventDefault();
    setClassFormError("");
    setClassFormLoading(true);
    try {
      if (classModal === "add") {
        const res = await api.post("/classes", classForm);
        setClasses((prev) => [...prev, { ...res.data, students_count: 0 }]);
        // Auto-expand the year
        if (res.data.annee_scolaire) {
          setExpandedYears((prev) => ({ ...prev, [res.data.annee_scolaire]: true }));
        }
      } else {
        const res = await api.put(`/classes/${classModal.id}`, classForm);
        setClasses((prev) => prev.map((c) => c.id === classModal.id ? { ...c, ...res.data } : c));
        if (selectedClass?.id === classModal.id) setSelectedClass((prev) => ({ ...prev, ...res.data }));
      }
      setClassModal(null);
    } catch (err) {
      const d = err.response?.data;
      setClassFormError(d?.message || (d?.errors ? Object.values(d.errors).flat().join(" ") : "Error saving class."));
    } finally {
      setClassFormLoading(false);
    }
  }

  async function handleDeleteClass(id) {
    try {
      await api.delete(`/classes/${id}`);
      setClasses((prev) => prev.filter((c) => c.id !== id));
      if (selectedClass?.id === id) setSelectedClass(null);
    } catch {
      alert("Failed to delete class.");
    }
    setDeleteConfirm(null);
  }

  // --- Student CRUD ---
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

  async function handleDeleteStudent(studentId) {
    try {
      await api.delete(`/classes/${selectedClass.id}/students/${studentId}`);
      setStudents((prev) => prev.filter((s) => s.id !== studentId));
      setClasses((prev) => prev.map((c) => c.id === selectedClass.id ? { ...c, students_count: Math.max(0, (c.students_count || 1) - 1) } : c));
    } catch {
      alert("Failed to delete student.");
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
            <div className="admin-brand-subtitle">Administration</div>
          </div>
        </div>
        <nav className="admin-nav">
          <Link className="admin-nav-item" to="/">{tr("Home", "Accueil")}</Link>
          <Link className="admin-nav-item" to="/admin">{tr("User management", "Gestion des utilisateurs")}</Link>
          <Link className="admin-nav-item admin-nav-item--active" to="/classes">{tr("Classes", "Classes")}</Link>
          <Link className="admin-nav-item" to="/admin/prof-assignments">{tr("Prof. — modules", "Profs / modules")}</Link>
          <Link className="admin-nav-item" to="/accounts">{tr("Accounts", "Comptes")}</Link>
          <Link className="admin-nav-item" to="/change-password">{tr("Change password", "Changer le mot de passe")}</Link>
        </nav>
        <div className="admin-sidebar-footer">
          <button type="button" className="admin-secondary-btn" style={{ width: "100%" }} onClick={handleLogout}>
            {tr("Logout", "Deconnexion")}
          </button>
        </div>
      </aside>

      <main className="admin-main">
        <header className="admin-topbar">
          <div>
            <h1 className="admin-title">{tr("Classes", "Classes")}</h1>
            <p className="admin-subtitle">{tr("Manage classes by academic year and department", "Gerer les classes par annee scolaire et departement")}</p>
          </div>
          <button type="button" className="admin-primary-btn" onClick={openAddYear}>+ {tr("Add Academic Year", "Ajouter annee scolaire")}</button>
        </header>

        {error && <p style={{ color: "red", padding: "0 24px" }}>{error}</p>}

        <div style={{ display: "grid", gridTemplateColumns: selectedClass ? "1fr 1fr" : "1fr", gap: "20px", padding: "0 24px 24px" }}>
          {/* Classes panel */}
          <section className="admin-card" style={{ padding: "0" }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid #e6ecf5", fontWeight: 700, fontSize: "0.95rem" }}>
              All Classes
            </div>
            {loading ? (
              <p style={{ padding: "1rem", textAlign: "center" }}>Loading...</p>
            ) : sortedYears.length === 0 ? (
              <p style={{ padding: "1rem", textAlign: "center", color: "#64748b" }}>No academic years yet. Add one to get started!</p>
            ) : (
              sortedYears.map((year) => (
                <div key={year}>
                  {/* Year header */}
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
                    <button
                      type="button"
                      style={{ background: "rgba(255,255,255,0.2)", border: "none", color: "white", borderRadius: "8px", padding: "4px 10px", cursor: "pointer", fontSize: "0.8rem", fontWeight: 600 }}
                      onClick={(e) => { e.stopPropagation(); openAddDept(year); }}
                    >
                      + Add Department
                    </button>
                  </div>

                  {/* Departments within year */}
                  {expandedYears[year] !== false && Object.entries(byYear[year]).map(([dept, deptClasses]) => {
                    // Skip the __YEAR__ placeholder
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
                          <button
                            type="button"
                            style={{ background: "#e2e8f0", border: "none", color: "#475569", borderRadius: "6px", padding: "3px 8px", cursor: "pointer", fontSize: "0.75rem", fontWeight: 600 }}
                            onClick={(e) => { e.stopPropagation(); openAddClass(year, dept); }}
                          >
                            + Add Class
                          </button>
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
                              <div style={{ fontSize: "0.78rem", color: "#64748b" }}>{cls.students_count ?? 0} students</div>
                            </div>
                            <div style={{ display: "flex", gap: "6px" }} onClick={(e) => e.stopPropagation()}>
                              <button type="button" className="admin-icon-btn" onClick={() => openEditClass(cls)} title="Edit">✎</button>
                              <button type="button" className="admin-icon-btn" style={{ color: "#ef4444" }} onClick={() => setDeleteConfirm({ type: "class", id: cls.id })} title="Delete">🗑</button>
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

          {/* Students panel */}
          {selectedClass && (
            <section className="admin-card" style={{ padding: "0" }}>
              <div style={{ padding: "16px 20px", borderBottom: "1px solid #e6ecf5", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: "0.95rem" }}>{selectedClass.name}</div>
                  <div style={{ fontSize: "0.78rem", color: "#64748b" }}>
                    {selectedClass.annee_scolaire && <span>{selectedClass.annee_scolaire} · </span>}
                    {selectedClass.departement || "No department"}
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
                          <button type="button" className="admin-icon-btn" style={{ color: "#ef4444" }} onClick={() => setDeleteConfirm({ type: "student", id: s.id })} title="Delete">🗑</button>
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

      {/* Year modal */}
      {yearModal && (
        <div className="admin-modal-overlay" onClick={() => setYearModal(false)}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h2 className="admin-modal-title">Add Academic Year</h2>
              <button type="button" className="admin-modal-close" onClick={() => setYearModal(false)}>✕</button>
            </div>
            <form className="admin-modal-form" onSubmit={handleYearSubmit}>
              {yearFormError && <p className="auth-error">{yearFormError}</p>}
              <label className="admin-label">Academic Year *</label>
              <input className="admin-input" value={yearForm.annee_scolaire} onChange={(e) => setYearForm({ ...yearForm, annee_scolaire: e.target.value })} required placeholder="e.g. 2024-2025" />
              <div className="admin-modal-actions">
                <button type="button" className="admin-secondary-btn" onClick={() => setYearModal(false)}>Cancel</button>
                <button type="submit" className="admin-primary-btn" disabled={yearFormLoading}>{yearFormLoading ? "Adding..." : "Add Year"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Department modal */}
      {deptModal !== null && (
        <div className="admin-modal-overlay" onClick={() => setDeptModal(null)}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h2 className="admin-modal-title">Add Department</h2>
              <button type="button" className="admin-modal-close" onClick={() => setDeptModal(null)}>✕</button>
            </div>
            <form className="admin-modal-form" onSubmit={handleDeptSubmit}>
              {deptFormError && <p className="auth-error">{deptFormError}</p>}
              <label className="admin-label">Academic Year</label>
              <input className="admin-input" value={deptModal.year} disabled style={{ background: "#f1f5f9" }} />
              <label className="admin-label">Department Name *</label>
              <input className="admin-input" value={deptForm.departement} onChange={(e) => setDeptForm({ ...deptForm, departement: e.target.value })} required placeholder="e.g. Computer Science" />
              <div className="admin-modal-actions">
                <button type="button" className="admin-secondary-btn" onClick={() => setDeptModal(null)}>Cancel</button>
                <button type="submit" className="admin-primary-btn" disabled={deptFormLoading}>{deptFormLoading ? "Adding..." : "Add Department"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Class modal */}
      {classModal !== null && (
        <div className="admin-modal-overlay" onClick={() => setClassModal(null)}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h2 className="admin-modal-title">{classModal === "add" ? "Add Class" : "Edit Class"}</h2>
              <button type="button" className="admin-modal-close" onClick={() => setClassModal(null)}>✕</button>
            </div>
            <form className="admin-modal-form" onSubmit={handleClassSubmit}>
              {classFormError && <p className="auth-error">{classFormError}</p>}
              <label className="admin-label">Academic Year *</label>
              <input className="admin-input" value={classForm.annee_scolaire} onChange={(e) => setClassForm({ ...classForm, annee_scolaire: e.target.value })} required placeholder="e.g. 2024-2025" style={classForm.departement ? { background: "#f1f5f9" } : {}} disabled={!!classForm.departement} />
              <label className="admin-label">Department *</label>
              <input className="admin-input" value={classForm.departement} onChange={(e) => setClassForm({ ...classForm, departement: e.target.value })} required placeholder="e.g. Computer Science" style={classForm.departement ? { background: "#f1f5f9" } : {}} disabled={!!classForm.departement} />
              <label className="admin-label">Class Name *</label>
              <input className="admin-input" value={classForm.name} onChange={(e) => setClassForm({ ...classForm, name: e.target.value })} required placeholder="e.g. L2 Informatique" />
              <div className="admin-modal-actions">
                <button type="button" className="admin-secondary-btn" onClick={() => setClassModal(null)}>Cancel</button>
                <button type="submit" className="admin-primary-btn" disabled={classFormLoading}>{classFormLoading ? "Saving..." : "Save"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

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

      {/* Delete confirm */}
      {deleteConfirm && (
        <div className="admin-modal-overlay" onClick={() => setDeleteConfirm(null)}>
          <div className="admin-modal" style={{ maxWidth: 380 }} onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h2 className="admin-modal-title">Confirm Delete</h2>
              <button type="button" className="admin-modal-close" onClick={() => setDeleteConfirm(null)}>✕</button>
            </div>
            <p style={{ color: "#475569", marginBottom: "20px" }}>
              {deleteConfirm.type === "class"
                ? "Are you sure you want to delete this class? Students will be unassigned."
                : "Are you sure you want to permanently delete this student?"}
            </p>
            <div className="admin-modal-actions">
              <button type="button" className="admin-secondary-btn" onClick={() => setDeleteConfirm(null)}>Cancel</button>
              <button
                type="button"
                className="admin-primary-btn"
                style={{ background: "#ef4444" }}
                onClick={() => deleteConfirm.type === "class" ? handleDeleteClass(deleteConfirm.id) : handleDeleteStudent(deleteConfirm.id)}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
