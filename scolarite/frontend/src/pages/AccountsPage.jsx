import { useMemo, useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/axios";
import { clearAuth } from "../auth/auth";
import "./AdminPanel.css";
import { useLanguage } from "../i18n/LanguageContext";

const API_BASE_URL =
  import.meta.env.VITE_API_URL
  || (import.meta.env.DEV ? "http://127.0.0.1:8000/api" : null)
  || api.defaults.baseURL
  || "/api";
const BACKEND_BASE_URL = (() => {
  try {
    const apiUrl = new URL(API_BASE_URL, window.location.origin).toString();
    return apiUrl.replace(/\/api\/?$/i, "").replace(/\/$/, "");
  } catch {
    return window.location.origin;
  }
})();

const INFO_CATEGORIES = [
  { id: "personnel_info", label: "Personnel Information" },
  { id: "academic_info", label: "Academic Information" },
  { id: "payment_proof", label: "Payment Proof" },
  { id: "certificate_achievement", label: "Certificate of Achievement" },
  { id: "academic_transcript", label: "Academic Transcript" },
  { id: "father_info", label: "Father Information" },
  { id: "mother_info", label: "Mother Information" },
  { id: "parents_relationship", label: "Parent's Relationship" },
];

function toDateInputValue(isoLike) {
  if (!isoLike) return "";
  const d = new Date(isoLike);
  if (Number.isNaN(d.getTime())) return "";
  const yyyy = String(d.getFullYear());
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function getStatusBadge(status, tr) {
  const styles = {
    pending: { bg: "#fff3cd", color: "#856404", text: tr("Pending", "En attente") },
    accepted: { bg: "#d4edda", color: "#155724", text: tr("Accepted", "Accepte") },
    rejected: { bg: "#f8d7da", color: "#721c24", text: tr("Rejected", "Rejete") },
    in_progress: { bg: "#cce5ff", color: "#004085", text: tr("In Progress", "En cours") },
  };
  const s = styles[status] || styles.pending;
  return (
    <span style={{ background: s.bg, color: s.color, padding: "2px 8px", borderRadius: "4px", fontSize: "12px", fontWeight: "500" }}>
      {s.text}
    </span>
  );
}

export default function AccountsPage() {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const tr = (en, fr) => (language === "fr" ? fr : en);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [studentDetails, setStudentDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState("");
  const [filterName, setFilterName] = useState("");
  const [editingComment, setEditingComment] = useState(null); // { category, currentComment }
  const [commentText, setCommentText] = useState("");

  const fetchStudents = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.get("/accounts/students");
      setStudents(res.data);
    } catch {
      setError(tr("Failed to load student accounts.", "Echec du chargement des comptes etudiants."));
    } finally {
      setLoading(false);
    }
  }, []);

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

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  const fetchStudentDetails = useCallback(async (id) => {
    setDetailsLoading(true);
    try {
      const res = await api.get(`/accounts/students/${id}`);
      setStudentDetails(res.data);
    } catch {
      alert("Failed to load student details.");
    } finally {
      setDetailsLoading(false);
    }
  }, []);

  const handleStudentClick = (student) => {
    setSelectedStudent(student);
    fetchStudentDetails(student.id);
  };

  const handleStatusUpdate = async (category, status, comment = "") => {
    if (!selectedStudent) return;
    try {
      await api.put(`/accounts/students/${selectedStudent.id}/status`, {
        category,
        status,
        comment,
      });
      // Refresh details
      fetchStudentDetails(selectedStudent.id);
      // Refresh list
      fetchStudents();
    } catch {
      alert("Failed to update status.");
    }
  };

  const handleApproveProfile = async () => {
    if (!selectedStudent) return;
    try {
      await api.post(`/profiles/${selectedStudent.id}/approve`);
      // Refresh details
      fetchStudentDetails(selectedStudent.id);
      // Refresh list
      fetchStudents();
      alert("Profile approved successfully!");
    } catch {
      alert("Failed to approve profile.");
    }
  };

  const handleRejectProfile = async () => {
    if (!selectedStudent) return;
    const comment = prompt("Enter rejection reason (optional):");
    if (comment === null) return; // User cancelled
    try {
      await api.post(`/profiles/${selectedStudent.id}/reject`, { comment });
      // Refresh details
      fetchStudentDetails(selectedStudent.id);
      // Refresh list
      fetchStudents();
      alert("Profile rejected.");
    } catch {
      alert("Failed to reject profile.");
    }
  };

  // Open comment editor for a category
  const openCommentEditor = (category, currentComment = "") => {
    setEditingComment({ category, currentComment });
    setCommentText(currentComment);
  };

  // Close comment editor
  const closeCommentEditor = () => {
    setEditingComment(null);
    setCommentText("");
  };

  // Save comment
  const saveComment = async () => {
    if (!editingComment || !selectedStudent) return;
    try {
      await api.put(`/accounts/students/${selectedStudent.id}/status`, {
        category: editingComment.category,
        status: 'rejected',
        comment: commentText.trim(),
      });
      fetchStudentDetails(selectedStudent.id);
      fetchStudents();
      closeCommentEditor();
    } catch {
      alert("Failed to save comment.");
    }
  };

  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      const name = (s.name || "").toLowerCase();
      
      if (filterName && !name.includes(filterName.toLowerCase())) return false;
      if (filterStatus && s.overall_status !== filterStatus) return false;
      return true;
    });
  }, [students, filterName, filterStatus]);

  const renderFileLink = (path, label) => {
    if (!path) return <span style={{ color: "#999" }}>Not uploaded</span>;
    const href = toPublicFileUrl(path);
    return (
      <a 
        href={href || "#"} 
        target="_blank" 
        rel="noopener noreferrer"
        style={{ color: "#0d6efd", textDecoration: "underline" }}
      >
        {label || "View File"}
      </a>
    );
  };

  const toPublicFileUrl = (pathOrUrl) => {
    if (!pathOrUrl || typeof pathOrUrl !== "string") return null;
    const normalized = pathOrUrl.replace(/\\/g, "/").trim();
    if (!normalized) return null;
    if (/^https?:\/\//i.test(normalized)) return normalized;
    const storageIdx = normalized.indexOf("/storage/");
    if (storageIdx >= 0) return `${BACKEND_BASE_URL}${normalized.slice(storageIdx)}`;
    if (normalized.startsWith("storage/")) return `${BACKEND_BASE_URL}/${normalized}`;
    if (normalized.startsWith("/")) return `${BACKEND_BASE_URL}${normalized}`;
    return `${BACKEND_BASE_URL}/storage/${normalized}`;
  };

  const renderCategorySection = (category) => {
    if (!studentDetails) return null;
    
    let content = null;
    let status = null;
    let comment = "";

    switch (category.id) {
      case "personnel_info": {
        const p = studentDetails.personnel_info;
        status = p.status;
        comment = p.comment || "";
        content = (
          <div className="info-grid">
            <div className="info-item">
              <label>Phone:</label>
              <span>{p.phone || "—"}</span>
            </div>
            <div className="info-item">
              <label>Address:</label>
              <span>{p.address || "—"}</span>
            </div>
            <div className="info-item">
              <label>Postal Code:</label>
              <span>{p.postal_code || "—"}</span>
            </div>
            <div className="info-item">
              <label>City:</label>
              <span>{p.city || "—"}</span>
            </div>
            <div className="info-item">
              <label>Country:</label>
              <span>{p.country || "—"}</span>
            </div>
            <div className="info-item">
              <label>Date of Birth:</label>
              <span>{toDateInputValue(p.date_of_birth) || "—"}</span>
            </div>
            <div className="info-item">
              <label>Place of Birth:</label>
              <span>{p.place_of_birth || "—"}</span>
            </div>
            <div className="info-item">
              <label>Gender:</label>
              <span>{p.gender || "—"}</span>
            </div>
          </div>
        );
        break;
      }
      case "academic_info": {
        const a = studentDetails.academic_info;
        status = a.status;
        comment = a.comment || "";
        content = (
          <div className="info-grid">
            <div className="info-item">
              <label>Admission Status:</label>
              <span>{a.admission_status || "—"}</span>
            </div>
            <div className="info-item">
              <label>Class:</label>
              <span>{a.class_name || "—"}</span>
            </div>
          </div>
        );
        break;
      }
      case "payment_proof": {
        const pay = studentDetails.payment_proof;
        status = pay.status;
        comment = pay.comment || "";
        content = (
          <div className="info-grid">
            <div className="info-item" style={{ gridColumn: "1 / -1" }}>
              <label>File:</label>
              <div>{renderFileLink(pay.file, "View Payment Proof")}</div>
            </div>
          </div>
        );
        break;
      }
      case "certificate_achievement": {
        const cert = studentDetails.certificate_achievement;
        status = cert.status;
        comment = cert.comment || "";
        content = (
          <div className="info-grid">
            <div className="info-item" style={{ gridColumn: "1 / -1" }}>
              <label>File:</label>
              <div>{renderFileLink(cert.file, "View Certificate")}</div>
            </div>
          </div>
        );
        break;
      }
      case "academic_transcript": {
        const trans = studentDetails.academic_transcript;
        status = trans.status;
        comment = trans.comment || "";
        content = (
          <div className="info-grid">
            <div className="info-item" style={{ gridColumn: "1 / -1" }}>
              <label>File:</label>
              <div>{renderFileLink(trans.file, "View Transcript")}</div>
            </div>
          </div>
        );
        break;
      }
      case "father_info": {
        const f = studentDetails.father_info;
        status = f.status;
        comment = f.comment || "";
        content = (
          <div className="info-grid">
            <div className="info-item">
              <label>First Name:</label>
              <span>{f.first_name || "—"}</span>
            </div>
            <div className="info-item">
              <label>Last Name:</label>
              <span>{f.last_name || "—"}</span>
            </div>
            <div className="info-item">
              <label>Phone:</label>
              <span>{f.phone || "—"}</span>
            </div>
            <div className="info-item">
              <label>Email:</label>
              <span>{f.email || "—"}</span>
            </div>
            <div className="info-item">
              <label>Address:</label>
              <span>{f.address || "—"}</span>
            </div>
            <div className="info-item">
              <label>City:</label>
              <span>{f.city || "—"}</span>
            </div>
            <div className="info-item">
              <label>Country:</label>
              <span>{f.country || "—"}</span>
            </div>
            <div className="info-item">
              <label>Date of Birth:</label>
              <span>{toDateInputValue(f.date_of_birth) || "—"}</span>
            </div>
            <div className="info-item">
              <label>Job:</label>
              <span>{f.job || "—"}</span>
            </div>
            <div className="info-item">
              <label>Place of Job:</label>
              <span>{f.place_of_job || "—"}</span>
            </div>
            <div className="info-item">
              <label>Condition:</label>
              <span>{f.condition || "—"}</span>
            </div>
            <div className="info-item">
              <label>Date of Death:</label>
              <span>{toDateInputValue(f.date_of_death) || "—"}</span>
            </div>
          </div>
        );
        break;
      }
      case "mother_info": {
        const m = studentDetails.mother_info;
        status = m.status;
        comment = m.comment || "";
        content = (
          <div className="info-grid">
            <div className="info-item">
              <label>First Name:</label>
              <span>{m.first_name || "—"}</span>
            </div>
            <div className="info-item">
              <label>Last Name:</label>
              <span>{m.last_name || "—"}</span>
            </div>
            <div className="info-item">
              <label>Phone:</label>
              <span>{m.phone || "—"}</span>
            </div>
            <div className="info-item">
              <label>Email:</label>
              <span>{m.email || "—"}</span>
            </div>
            <div className="info-item">
              <label>Address:</label>
              <span>{m.address || "—"}</span>
            </div>
            <div className="info-item">
              <label>City:</label>
              <span>{m.city || "—"}</span>
            </div>
            <div className="info-item">
              <label>Country:</label>
              <span>{m.country || "—"}</span>
            </div>
            <div className="info-item">
              <label>Date of Birth:</label>
              <span>{toDateInputValue(m.date_of_birth) || "—"}</span>
            </div>
            <div className="info-item">
              <label>Job:</label>
              <span>{m.job || "—"}</span>
            </div>
            <div className="info-item">
              <label>Place of Job:</label>
              <span>{m.place_of_job || "—"}</span>
            </div>
            <div className="info-item">
              <label>Condition:</label>
              <span>{m.condition || "—"}</span>
            </div>
            <div className="info-item">
              <label>Date of Death:</label>
              <span>{toDateInputValue(m.date_of_death) || "—"}</span>
            </div>
          </div>
        );
        break;
      }
      case "parents_relationship": {
        const pr = studentDetails.parents_relationship;
        status = pr.status;
        comment = pr.comment || "";
        content = (
          <div className="info-grid">
            <div className="info-item">
              <label>Relationship:</label>
              <span>{pr.relationship || "—"}</span>
            </div>
          </div>
        );
        break;
      }
      default:
        break;
    }

    return (
      <div className="category-section">
        <div className="category-header">
          <h3>{category.label}</h3>
          {getStatusBadge(status, tr)}
        </div>
        <div className="category-content">{content}</div>
        {comment && (
          <div className="category-comment">
            <strong>Rejection Comment:</strong> {comment}
            <button
              type="button"
              style={{
                marginLeft: '10px',
                padding: '2px 8px',
                fontSize: '11px',
                background: '#6b7280',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
              onClick={() => openCommentEditor(category.id, comment)}
            >
              Edit
            </button>
          </div>
        )}
        <div className="category-actions">
          <button
            className="admin-primary-btn"
            onClick={() => handleStatusUpdate(category.id, "accepted", comment)}
            disabled={status === "accepted"}
            style={status === "accepted" ? {opacity: 0.6} : {}}
          >
            {status === "accepted" ? "✓ Accepted" : "Accept"}
          </button>
          <button
            className="admin-secondary-btn"
            onClick={() => openCommentEditor(category.id)}
            disabled={status === "rejected"}
            style={status === "rejected" ? { background: '#fecaca', borderColor: '#f87171', color: '#dc2626' } : {}}
          >
            {status === "rejected" ? "✓ Rejected" : "Reject"}
          </button>
          {comment ? (
            <button
              className="admin-secondary-btn"
              onClick={() => handleStatusUpdate(category.id, "pending", "")}
              style={{ background: '#fef2f2', borderColor: '#fecaca', color: '#991b1b' }}
            >
              Remove Comment
            </button>
          ) : null}
        </div>
      </div>
    );
  };

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
          <Link className="admin-nav-item" to="/classes">{tr("Classes", "Classes")}</Link>
          <Link className="admin-nav-item" to="/admin/prof-assignments">{tr("Prof. — modules", "Profs / modules")}</Link>
          <Link className="admin-nav-item admin-nav-item--active" to="/accounts">{tr("Accounts", "Comptes")}</Link>
          <Link className="admin-nav-item" to="/admin/student-contacts">{tr("Student contacts", "Contacts etudiants")}</Link>
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
            <h1 className="admin-title">{tr("Student Accounts Management", "Gestion des comptes etudiants")}</h1>
            <p className="admin-subtitle">{tr("Review and approve student information", "Reviser et approuver les informations des etudiants")}</p>
          </div>
          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <button
              type="button"
              className="admin-secondary-btn"
              onClick={() => {
                setFilterName("");
                setFilterStatus("");
              }}
            >
              {tr("Reset filters", "Reinitialiser les filtres")}
            </button>
            <button type="button" className="admin-primary-btn" onClick={fetchStudents}>
              {tr("Refresh", "Actualiser")}
            </button>
          </div>
        </header>

        <div style={{ display: "flex", gap: "20px", height: "calc(100vh - 180px)" }}>
          {/* Student List */}
          <div style={{ width: "350px", flexShrink: 0, display: "flex", flexDirection: "column" }}>
            <div className="admin-card" style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
              <div className="admin-filters" style={{ marginBottom: "10px" }}>
                <div className="admin-filter">
                  <label className="admin-label">{tr("Name", "Nom")}</label>
                  <input 
                    className="admin-input" 
                    value={filterName} 
                    onChange={(e) => setFilterName(e.target.value)} 
                    placeholder={tr("Filter by name", "Filtrer par nom")} 
                  />
                </div>
                <div className="admin-filter">
                  <label className="admin-label">{tr("Status", "Statut")}</label>
                  <select 
                    className="admin-input" 
                    value={filterStatus} 
                    onChange={(e) => setFilterStatus(e.target.value)}
                  >
                    <option value="">{tr("All", "Tous")}</option>
                    <option value="pending">{tr("Pending", "En attente")}</option>
                    <option value="in_progress">{tr("In Progress", "En cours")}</option>
                    <option value="accepted">{tr("Accepted", "Accepte")}</option>
                    <option value="rejected">{tr("Rejected", "Rejete")}</option>
                  </select>
                </div>
              </div>

              <div className="admin-table-wrap" style={{ flex: 1, overflow: "auto" }}>
                {loading ? (
                  <p style={{ padding: "1rem", textAlign: "center" }}>Loading...</p>
                ) : error ? (
                  <p style={{ padding: "1rem", color: "red", textAlign: "center" }}>{error}</p>
                ) : filteredStudents.length === 0 ? (
                  <p style={{ padding: "1rem", textAlign: "center" }}>No students found.</p>
                ) : (
                  <div className="student-list">
                    {filteredStudents.map((student) => (
                      <div
                        key={student.id}
                        className={`student-list-item ${selectedStudent?.id === student.id ? "selected" : ""}`}
                        onClick={() => handleStudentClick(student)}
                        style={{
                          padding: "12px",
                          borderBottom: "1px solid #eee",
                          cursor: "pointer",
                          background: selectedStudent?.id === student.id ? "#e3f2fd" : "white",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          {toPublicFileUrl(student.profile_picture) ? (
                            <img
                              src={toPublicFileUrl(student.profile_picture)}
                              alt=""
                              style={{ width: "40px", height: "40px", borderRadius: "50%", objectFit: "cover" }}
                              onError={(e) => {
                                e.currentTarget.style.display = "none";
                              }}
                            />
                          ) : (
                            <div style={{ 
                              width: "40px", 
                              height: "40px", 
                              borderRadius: "50%", 
                              background: "#0d6efd", 
                              color: "white", 
                              display: "flex", 
                              alignItems: "center", 
                              justifyContent: "center",
                              fontWeight: "bold"
                            }}>
                              {(student.name || "S").slice(0, 1).toUpperCase()}
                            </div>
                          )}
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: "500" }}>{student.name}</div>
                            <div style={{ fontSize: "12px", color: "#666" }}>{student.matricule}</div>
                          </div>
                          {getStatusBadge(student.overall_status || "pending", tr)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Student Details */}
          <div style={{ flex: 1, overflow: "auto" }}>
            <div className="admin-card">
              {!selectedStudent ? (
                <p style={{ padding: "2rem", textAlign: "center", color: "#666" }}>
                  Select a student to view their information
                </p>
              ) : detailsLoading ? (
                <p style={{ padding: "2rem", textAlign: "center" }}>Loading details...</p>
              ) : (
                <>
                  <div className="student-details-header">
                    <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                      {toPublicFileUrl(
                        (studentDetails?.profile_picture && typeof studentDetails.profile_picture === "object")
                          ? (studentDetails.profile_picture.url || studentDetails.profile_picture.path || studentDetails.profile_picture.file)
                          : studentDetails?.profile_picture
                      ) ? (
                        <img
                          src={toPublicFileUrl(
                            (studentDetails?.profile_picture && typeof studentDetails.profile_picture === "object")
                              ? (studentDetails.profile_picture.url || studentDetails.profile_picture.path || studentDetails.profile_picture.file)
                              : studentDetails?.profile_picture
                          )}
                          alt=""
                          style={{ width: 54, height: 54, borderRadius: 999, objectFit: "cover", border: "1px solid #e5e7eb" }}
                          onError={(e) => {
                            e.currentTarget.style.display = "none";
                          }}
                        />
                      ) : (
                        <div style={{
                          width: 54,
                          height: 54,
                          borderRadius: 999,
                          background: "#0d6efd",
                          color: "white",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontWeight: "bold",
                          flexShrink: 0,
                        }}>
                          {(studentDetails?.name || "S").slice(0, 1).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <h2 style={{ margin: 0 }}>{studentDetails?.name}</h2>
                        <p style={{ margin: 0 }}>{studentDetails?.email} • {studentDetails?.matricule}</p>
                      </div>
                    </div>
                    <p>Class: {studentDetails?.class_name || studentDetails?.classe || "—"}</p>
                    {studentDetails?.status === 'pending' && (
                      <div style={{ marginTop: "15px", display: "flex", gap: "10px" }}>
                        <button
                          type="button"
                          className="admin-primary-btn"
                          onClick={handleApproveProfile}
                          style={{ background: "#10b981", borderColor: "#10b981" }}
                        >
                          ✓ Approve Profile
                        </button>
                        <button
                          type="button"
                          className="admin-secondary-btn"
                          onClick={handleRejectProfile}
                          style={{ background: "#fef2f2", borderColor: "#fecaca", color: "#991b1b" }}
                        >
                          ✗ Reject Profile
                        </button>
                      </div>
                    )}
                    {studentDetails?.status === 'approved' && (
                      <div style={{ marginTop: "10px", padding: "8px 12px", background: "#d1fae5", borderRadius: "6px", color: "#065f46", fontSize: "14px" }}>
                        ✓ Profile Approved on {toDateInputValue(studentDetails?.approved_at)}
                      </div>
                    )}
                    {studentDetails?.status === 'rejected' && (
                      <div style={{ marginTop: "10px", padding: "8px 12px", background: "#fee2e2", borderRadius: "6px", color: "#991b1b", fontSize: "14px" }}>
                        ✗ Profile Rejected
                      </div>
                    )}
                  </div>

                  <div className="info-categories">
                    {INFO_CATEGORIES.map((category) => (
                      <div key={category.id} className="category-card">
                        {renderCategorySection(category)}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </main>
      
      {/* Comment Modal */}
      {editingComment && (
        <div className="admin-modal-overlay" onClick={closeCommentEditor}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div className="admin-modal-header">
              <h2 className="admin-modal-title">Add Comment</h2>
              <button type="button" className="admin-modal-close" onClick={closeCommentEditor}>✕</button>
            </div>
            <div style={{ padding: '0 4px 20px' }}>
              <p style={{ color: '#64748b', marginBottom: '16px' }}>
                Enter a comment explaining why this information is rejected:
              </p>
              <textarea
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Write your comment here..."
                style={{
                  width: '100%',
                  minHeight: '150px',
                  padding: '12px',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0',
                  fontSize: '14px',
                  fontFamily: 'inherit',
                  resize: 'vertical',
                  marginBottom: '20px',
                  boxSizing: 'border-box'
                }}
                autoFocus
              />
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button 
                  type="button" 
                  className="admin-secondary-btn" 
                  onClick={closeCommentEditor}
                >
                  Cancel
                </button>
                <button 
                  type="button" 
                  className="admin-primary-btn" 
                  onClick={saveComment}
                  disabled={!commentText.trim()}
                >
                  Save Comment
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
