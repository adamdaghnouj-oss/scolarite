import { useEffect, useState } from "react";
import { api } from "../api/axios";
import "./AdminPanel.css";
import StaffSidebar from "../components/StaffSidebar";

export default function AdminMessagesMonitorPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState({
    type: "all",
    student_id: "",
    class_id: "",
    course_thread_id: "",
  });

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await api.get("/admin/messages", { params: filters });
      setRows(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to load messages.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function removeMessage(type, id) {
    if (!window.confirm("Delete this message?")) return;
    setError("");
    try {
      await api.delete(`/admin/messages/${type}/${id}`);
      setRows((prev) => prev.filter((r) => !(r.type === type && r.id === id)));
    } catch (e) {
      setError(e?.response?.data?.message || "Delete failed.");
    }
  }

  return (
    <div className="admin-wrap">
      <StaffSidebar variant="admin" />

      <main className="admin-main">
        <header className="admin-topbar">
          <div>
            <h1 className="admin-title">Messages Monitor</h1>
            <p className="admin-subtitle">View/delete friend, class, and course messages.</p>
          </div>
          <button className="admin-primary-btn" onClick={load}>Refresh</button>
        </header>

        {error ? <p className="auth-error">{error}</p> : null}
        {loading ? <p className="admin-subtitle">Loading...</p> : null}

        <section className="admin-card admin-card--padded" style={{ marginBottom: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 8 }}>
            <select className="admin-input" value={filters.type} onChange={(e) => setFilters((p) => ({ ...p, type: e.target.value }))}>
              <option value="all">All</option>
              <option value="friend">Friend</option>
              <option value="class">Class</option>
              <option value="course">Course</option>
            </select>
            <input className="admin-input" placeholder="Student ID" value={filters.student_id} onChange={(e) => setFilters((p) => ({ ...p, student_id: e.target.value }))} />
            <input className="admin-input" placeholder="Class ID" value={filters.class_id} onChange={(e) => setFilters((p) => ({ ...p, class_id: e.target.value }))} />
            <input className="admin-input" placeholder="Course thread ID" value={filters.course_thread_id} onChange={(e) => setFilters((p) => ({ ...p, course_thread_id: e.target.value }))} />
          </div>
          <div style={{ marginTop: 8 }}>
            <button className="admin-primary-btn" onClick={load}>Apply Filters</button>
          </div>
        </section>

        <section className="admin-card admin-card--padded">
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Type</th>
                  <th>Sender</th>
                  <th>Receiver</th>
                  <th>Body</th>
                  <th>Class</th>
                  <th>Thread</th>
                  <th>Created</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={`${r.type}-${r.id}`}>
                    <td>#{r.id}</td>
                    <td>{r.type}</td>
                    <td>{r.sender_name || "—"}</td>
                    <td>{r.receiver_name || "—"}</td>
                    <td>{r.body || "—"}</td>
                    <td>{r.class_id || "—"}</td>
                    <td>{r.course_thread_id || "—"}</td>
                    <td>{r.created_at || "—"}</td>
                    <td>
                      <button
                        type="button"
                        className="admin-secondary-btn"
                        style={{ borderColor: "#ef4444", color: "#ef4444" }}
                        onClick={() => removeMessage(r.type, r.id)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
