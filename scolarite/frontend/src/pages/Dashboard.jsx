import "./Dashboard.css";

export default function Dashboard() {
  const user = JSON.parse(localStorage.getItem("user"));

  return (
    <div className="dashboard-container">
      <h1>Welcome {user ? user.name : "Student"} 👋</h1>
      <p>Your university dashboard</p>

      {/* DASHBOARD CARDS */}
      <div className="dashboard-grid">
        <div className="card">
          <h3>📚 Courses</h3>
          <p>View your registered courses</p>
        </div>

        <div className="card">
          <h3>📝 Grades</h3>
          <p>Check your exam results</p>
        </div>

        <div className="card">
          <h3>💳 Payments</h3>
          <p>View tuition payments</p>
        </div>

        <div className="card">
          <h3>📄 Documents</h3>
          <p>Download certificates</p>
        </div>
      </div>
    </div>
  );
}
