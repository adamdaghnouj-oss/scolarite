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

function resolvePublicFileUrl(pathOrUrl) {
  if (!pathOrUrl || typeof pathOrUrl !== "string") return null;
  const normalized = pathOrUrl.replace(/\\/g, "/").trim();
  if (!normalized) return null;
  if (/^https?:\/\//i.test(normalized)) return normalized;
  const storageIdx = normalized.indexOf("/storage/");
  if (storageIdx >= 0) return `${BACKEND_BASE_URL}${normalized.slice(storageIdx)}`;
  if (normalized.startsWith("storage/")) return `${BACKEND_BASE_URL}/${normalized}`;
  if (normalized.startsWith("/")) return `${BACKEND_BASE_URL}${normalized}`;
  return `${BACKEND_BASE_URL}/storage/${normalized}`;
}

function toDateInputValue(isoLike) {
  if (!isoLike) return "";
  const d = new Date(isoLike);
  if (Number.isNaN(d.getTime())) return "";
  const yyyy = String(d.getFullYear());
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function normalize(s) {
  return String(s ?? "").trim().toLowerCase();
}

function inDateRange(createdAt, from, to) {
  const created = new Date(createdAt);
  if (Number.isNaN(created.getTime())) return false;
  if (from) {
    const dFrom = new Date(`${from}T00:00:00`);
    if (!Number.isNaN(dFrom.getTime()) && created < dFrom) return false;
  }
  if (to) {
    const dTo = new Date(`${to}T23:59:59`);
    if (!Number.isNaN(dTo.getTime()) && created > dTo) return false;
  }
  return true;
}

const EMPTY_FORM = { name: "", email: "", password: "", matricule: "", classe: "", departement: "" };

export default function AdminPanel() {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const tr = (en, fr) => (language === "fr" ? fr : en);
  const [tab, setTab] = useState("students");
  const [data, setData] = useState({ students: [], professeurs: [], "directeurs-etudes": [], administrateurs: [] });
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState("");

  const [q, setQ] = useState("");
  const [filterName, setFilterName] = useState("");
  const [filterClasse, setFilterClasse] = useState("");
  const [filterEmail, setFilterEmail] = useState("");
  const [createdFrom, setCreatedFrom] = useState("");
  const [createdTo, setCreatedTo] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState("");
  const [formLoading, setFormLoading] = useState(false);
  const [deptOptions, setDeptOptions] = useState([]);
  const [deptListLoading, setDeptListLoading] = useState(false);

  const fetchTab = useCallback(async (tabId) => {
    setLoading(true);
    setFetchError("");
    try {
      const res = await api.get(`/${tabId}`);
      setData((prev) => ({ ...prev, [tabId]: res.data }));
    } catch {
      setFetchError(tr("Failed to load data from server.", "Echec du chargement des donnees."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTab(tab);
  }, [tab, fetchTab]);

  useEffect(() => {
    if (!showModal || tab !== "professeurs") {
      setDeptOptions([]);
      return;
    }
    let cancelled = false;
    setDeptListLoading(true);
    (async () => {
      try {
        const res = await api.get("/departements");
        const list = Array.isArray(res.data) ? res.data : [];
        if (!cancelled) setDeptOptions(list);
      } catch {
        if (!cancelled) setDeptOptions([]);
      } finally {
        if (!cancelled) setDeptListLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [showModal, tab]);

  const items = data[tab] ?? [];
  const counts = {
    students: (data.students ?? []).length,
    professeurs: (data.professeurs ?? []).length,
    "directeurs-etudes": (data["directeurs-etudes"] ?? []).length,
    administrateurs: (data.administrateurs ?? []).length,
  };

  const filtered = useMemo(() => {
    const nq = normalize(q);
    const nName = normalize(filterName);
    const nClasse = normalize(filterClasse);
    const nEmail = normalize(filterEmail);

    return items.filter((it) => {
      const name = normalize(it.name);
      const email = normalize(it.email);
      const classe = normalize(it.classe ?? it.departement ?? "");

      if (nq && !(name.includes(nq) || email.includes(nq))) return false;
      if (nName && !name.includes(nName)) return false;
      if (nEmail && !email.includes(nEmail)) return false;
      if (nClasse && !classe.includes(nClasse)) return false;
      if ((createdFrom || createdTo) && !inDateRange(it.created_at, createdFrom, createdTo)) return false;
      return true;
    });
  }, [items, q, filterName, filterClasse, filterEmail, createdFrom, createdTo]);

  const actionLabel =
    tab === "students"
      ? "Add student"
      : tab === "professeurs"
        ? tr("Add professor", "Ajouter professeur")
        : tab === "directeurs-etudes"
          ? tr("Add Director of Studies", "Ajouter Directeur des Etudes")
          : tab === "administrateurs"
            ? tr("Add administrator", "Ajouter administrateur")
            : "";
  const tabs = [
    { id: "students", label: tr("Students", "Etudiants") },
    { id: "professeurs", label: tr("Professors", "Professeurs") },
    { id: "directeurs-etudes", label: tr("Directors of Studies", "Directeurs des Etudes") },
    { id: "administrateurs", label: tr("Administrators", "Administrateurs") },
  ];

  function openModal() {
    setForm(EMPTY_FORM);
    setFormError("");
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setFormError("");
  }

  async function handleFormSubmit(e) {
    e.preventDefault();
    setFormError("");
    setFormLoading(true);
    try {
      const payload = { name: form.name, email: form.email, password: form.password };
      if (tab === "students") {
        payload.matricule = form.matricule;
        payload.classe = form.classe;
      } else if (tab === "professeurs") {
        payload.matricule = form.matricule || null;
        payload.departement = form.departement || null;
      } else if (tab === "directeurs-etudes") {
        payload.matricule = form.matricule || null;
        payload.departement = form.departement || null;
      } else {
        payload.departement = form.departement || null;
      }
      const res = await api.post(`/${tab}`, payload);
      setData((prev) => ({ ...prev, [tab]: [...prev[tab], res.data] }));
      closeModal();
    } catch (err) {
      const data = err.response?.data;
      const msg = data?.message
        || (data?.errors ? Object.values(data.errors).flat().join(" ") : null)
        || "Failed to create user.";
      setFormError(msg);
    } finally {
      setFormLoading(false);
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
            <div className="admin-brand-subtitle">Administration</div>
          </div>
        </div>

        <nav className="admin-nav">
          <Link className="admin-nav-item" to="/">{tr("Home", "Accueil")}</Link>
          <Link className="admin-nav-item admin-nav-item--active" to="/admin">{tr("Management", "Gestion")}</Link>
          <Link className="admin-nav-item" to="/classes">{tr("Classes", "Classes")}</Link>
          <Link className="admin-nav-item" to="/accounts">{tr("Accounts", "Comptes")}</Link>
          <Link className="admin-nav-item" to="/admin/student-contacts">{tr("Student contacts", "Contacts etudiants")}</Link>
          <Link className="admin-nav-item" to="/admin/messages">{tr("Messages monitor", "Surveillance messages")}</Link>
          <Link className="admin-nav-item" to="/admin/grades">{tr("Grades control", "Controle des notes")}</Link>
          <Link className="admin-nav-item" to="/admin/attendance-certificates">{tr("Attendance certificates", "Attestations de presence")}</Link>
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
            <h1 className="admin-title">{tr("User Management", "Gestion des utilisateurs")}</h1>
            <p className="admin-subtitle">{tr("Manage students, professors, directors of studies, and administrators", "Gerer etudiants, professeurs, directeurs des etudes et administrateurs")}</p>
          </div>
          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <button
              type="button"
              className="admin-secondary-btn"
              onClick={() => {
                setQ("");
                setFilterName("");
                setFilterClasse("");
                setFilterEmail("");
                setCreatedFrom("");
                setCreatedTo("");
              }}
            >
              {tr("Reset filters", "Reinitialiser les filtres")}
            </button>
            <button type="button" className="admin-primary-btn" onClick={openModal}>{actionLabel}</button>
          </div>
        </header>

        <section className="admin-stats">
          <div className="admin-stat-card">
            <div className="admin-stat-label">{tr("Students", "Etudiants")}</div>
            <div className="admin-stat-value">{counts.students}</div>
          </div>
          <div className="admin-stat-card">
            <div className="admin-stat-label">Professeurs</div>
            <div className="admin-stat-value">{counts.professeurs}</div>
          </div>
          <div className="admin-stat-card">
            <div className="admin-stat-label">{tr("Directors of Studies", "Directeurs des Etudes")}</div>
            <div className="admin-stat-value">{counts["directeurs-etudes"]}</div>
          </div>
          <div className="admin-stat-card">
            <div className="admin-stat-label">Administrateurs</div>
            <div className="admin-stat-value">{counts.administrateurs}</div>
          </div>
        </section>

        <section className="admin-card">
          <div className="admin-tabs">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`admin-tab ${tab === t.id ? "admin-tab--active" : ""}`}
                onClick={() => setTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="admin-toolbar">
            <div className="admin-search">
              <span className="admin-search-icon" aria-hidden="true">⌕</span>
              <input
                className="admin-input admin-input--search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={tr("Search by name or email...", "Recherche par nom ou email...")}
              />
            </div>

            <div className="admin-date-search">
              <label className="admin-mini-label">{tr("Date", "Date")}</label>
              <input
                className="admin-input admin-input--date"
                type="date"
                value={createdFrom}
                onChange={(e) => setCreatedFrom(e.target.value)}
                aria-label="Date de début"
              />
              <span className="admin-date-sep">→</span>
              <input
                className="admin-input admin-input--date"
                type="date"
                value={createdTo}
                onChange={(e) => setCreatedTo(e.target.value)}
                aria-label="Date de fin"
              />
            </div>
          </div>

          <div className="admin-filters">
            <div className="admin-filter">
              <label className="admin-label">{tr("Name", "Nom")}</label>
              <input className="admin-input" value={filterName} onChange={(e) => setFilterName(e.target.value)} placeholder={tr("Filter by name", "Filtrer par nom")} />
            </div>
            <div className="admin-filter">
              <label className="admin-label">{tab === "students" ? tr("Class", "Classe") : tr("Service / Department", "Service / Departement")}</label>
              <input className="admin-input" value={filterClasse} onChange={(e) => setFilterClasse(e.target.value)} placeholder={tab === "students" ? tr("Filter by class", "Filtrer par classe") : tr("Filter by department", "Filtrer par departement")} />
            </div>
            <div className="admin-filter">
              <label className="admin-label">{tr("Email", "E-mail")}</label>
              <input className="admin-input" value={filterEmail} onChange={(e) => setFilterEmail(e.target.value)} placeholder={tr("Filter by email", "Filtrer par e-mail")} />
            </div>
          </div>

          <div className="admin-table-wrap">
            {loading ? (
              <p style={{ padding: "1rem", textAlign: "center" }}>Loading...</p>
            ) : fetchError ? (
              <p style={{ padding: "1rem", color: "red", textAlign: "center" }}>{fetchError}</p>
            ) : (
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>{tab === "students" ? "Class" : "Service"}</th>
                    <th>Created</th>
                    <th className="admin-actions-col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="admin-empty">
                        No results. Try changing your filters.
                      </td>
                    </tr>
                  ) : (
                    filtered.map((it) => {
                      const avatarSrc = resolvePublicFileUrl(it.profile_picture);
                      return (
                      <tr key={it.id}>
                        <td className="admin-name-cell">
                          {avatarSrc ? (
                            <img 
                              src={avatarSrc} 
                              alt={it.name} 
                              className="admin-avatar admin-avatar--image" 
                            />
                          ) : (
                            <div className="admin-avatar" aria-hidden="true">{String(it.name).slice(0, 1).toUpperCase()}</div>
                          )}
                          <div className="admin-name-block">
                            <div className="admin-name">{it.name}</div>
                            <div className="admin-id">id: {it.id}</div>
                          </div>
                        </td>
                        <td>{it.email}</td>
                        <td>{it.classe ?? it.departement ?? "—"}</td>
                        <td>{toDateInputValue(it.created_at)}</td>
                        <td className="admin-actions">
                          <button type="button" className="admin-icon-btn" aria-label="Edit">✎</button>
                          <button type="button" className="admin-icon-btn" aria-label="Delete">🗑</button>
                          <button type="button" className="admin-icon-btn" aria-label="More">⋯</button>
                        </td>
                      </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </main>

      {showModal && (
        <div className="admin-modal-overlay" onClick={closeModal}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h2 className="admin-modal-title">{actionLabel}</h2>
              <button type="button" className="admin-modal-close" onClick={closeModal}>✕</button>
            </div>
            <form className="admin-modal-form" onSubmit={handleFormSubmit}>
              {formError && <p className="auth-error">{formError}</p>}

              <label className="admin-label">Name *</label>
              <input className="admin-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required placeholder="Full name" />

              <label className="admin-label">Email *</label>
              <input className="admin-input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required placeholder="email@example.com" />

              <label className="admin-label">Password *</label>
              <input className="admin-input" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required placeholder="Min 8 characters" />

              {tab === "students" && (
                <>
                  <label className="admin-label">Matricule *</label>
                  <input className="admin-input" value={form.matricule} onChange={(e) => setForm({ ...form, matricule: e.target.value })} required placeholder="2025-0001" />
                  <label className="admin-label">Classe *</label>
                  <input className="admin-input" value={form.classe} onChange={(e) => setForm({ ...form, classe: e.target.value })} required placeholder="L2 Informatique" />
                </>
              )}

              {tab === "professeurs" && (
                <>
                  <label className="admin-label">Matricule (optional)</label>
                  <input className="admin-input" value={form.matricule} onChange={(e) => setForm({ ...form, matricule: e.target.value })} placeholder="Matricule" />
                  <label className="admin-label">{tr("Department (optional)", "Département (optionnel)")}</label>
                  <select
                    className="admin-input"
                    value={form.departement}
                    onChange={(e) => setForm({ ...form, departement: e.target.value })}
                    disabled={deptListLoading}
                  >
                    <option value="">{tr("— Select —", "— Choisir —")}</option>
                    {deptOptions.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                  {deptListLoading && (
                    <p className="admin-subtitle" style={{ marginTop: "6px" }}>
                      {tr("Loading departments…", "Chargement des départements…")}
                    </p>
                  )}
                  {!deptListLoading && deptOptions.length === 0 && (
                    <p className="admin-subtitle" style={{ marginTop: "6px" }}>
                      {tr(
                        "No departments yet. Add years and departments under Classes first.",
                        "Aucun département pour l’instant. Ajoutez années et départements dans Classes d’abord.",
                      )}
                    </p>
                  )}
                </>
              )}

              {tab === "directeurs-etudes" && (
                <>
                  <label className="admin-label">Matricule (optional)</label>
                  <input className="admin-input" value={form.matricule} onChange={(e) => setForm({ ...form, matricule: e.target.value })} placeholder="Matricule" />
                  <label className="admin-label">Département (optional)</label>
                  <input className="admin-input" value={form.departement} onChange={(e) => setForm({ ...form, departement: e.target.value })} placeholder="Département" />
                </>
              )}

              {tab === "administrateurs" && (
                <>
                  <label className="admin-label">Département (optional)</label>
                  <input className="admin-input" value={form.departement} onChange={(e) => setForm({ ...form, departement: e.target.value })} placeholder="Département" />
                </>
              )}

              <div className="admin-modal-actions">
                <button type="button" className="admin-secondary-btn" onClick={closeModal}>Cancel</button>
                <button type="submit" className="admin-primary-btn" disabled={formLoading}>
                  {formLoading ? "Saving..." : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
