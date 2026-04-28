import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/axios";
import { clearAuth, getStoredRole } from "../auth/auth";
import "./StudentProfile.css";
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

function withCacheBust(urlOrPath) {
  if (!urlOrPath || typeof urlOrPath !== "string") return urlOrPath;
  const sep = urlOrPath.includes("?") ? "&" : "?";
  return `${urlOrPath}${sep}v=${Date.now()}`;
}

function StatusBadge({ status, t }) {
  if (!status || status === 'pending') {
    return (
      <span style={{ 
        background: '#fff3cd', 
        color: '#856404', 
        border: '1px solid rgba(133, 100, 4, 0.35)',
        padding: '2px 8px', 
        borderRadius: '4px', 
        fontSize: '11px', 
        fontWeight: '500',
        marginLeft: 'auto'
      }}>
        ⏳ {t("spPendingReview")}
      </span>
    );
  }
  if (status === 'accepted') {
    return (
      <span style={{ 
        background: '#dcfce7', 
        color: '#052e16',
        border: '1px solid rgba(5, 46, 22, 0.25)',
        padding: '2px 8px', 
        borderRadius: '4px', 
        fontSize: '11px', 
        fontWeight: '700',
        marginLeft: 'auto'
      }}>
        ✓ {t("spAccepted")}
      </span>
    );
  }
  if (status === 'rejected') {
    return (
      <span style={{ 
        background: '#f8d7da', 
        color: '#721c24', 
        border: '1px solid rgba(114, 28, 36, 0.30)',
        padding: '2px 8px', 
        borderRadius: '4px', 
        fontSize: '11px', 
        fontWeight: '700',
        marginLeft: 'auto'
      }}>
        ✗ {t("spRejected")}
      </span>
    );
  }
  return null;
}

function Section({ icon, title, children, status = null, comment = "", defaultOpen = false, t }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="sp-section">
      <div className="sp-section-header" onClick={() => setOpen(!open)}>
        <span className="sp-section-icon">{icon}</span>
        <span className="sp-section-title">{title}</span>
        <StatusBadge status={status} comment={comment} t={t} />
        <span className={`sp-section-chevron ${open ? "sp-section-chevron--open" : ""}`}>▼</span>
      </div>
      {open && (
        <div className="sp-section-body">
          {comment && status === 'rejected' && (
            <div style={{ 
              background: '#fef2f2', 
              border: '1px solid #fecaca', 
              borderRadius: '8px', 
              padding: '12px', 
              marginBottom: '16px',
              color: '#991b1b',
              fontSize: '13px'
            }}>
              <strong>📝 {t("spRejectionReason")}:</strong><br />
              {comment}
            </div>
          )}
          {children}
        </div>
      )}
    </div>
  );
}

function FileUpload({ label, field, currentPath, onUploaded, accept = "image/*,.pdf", t }) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef();

  async function handleChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await api.post(`/student/profile/upload/${field}`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      onUploaded(field, res.data.url, res.data.path);
    } catch {
      alert(t("spUploadFailed"));
    } finally {
      setUploading(false);
    }
  }

  const fileName = currentPath ? currentPath.replace(/\\/g, "/").split("/").pop() : null;

  return (
    <div className="sp-field">
      <label className="sp-label">{label}</label>
      <div className="sp-file-zone" onClick={() => inputRef.current.click()}>
        <div className="sp-file-zone-icon">
          {currentPath ? (currentPath.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? "🖼️" : "📄") : "📎"}
        </div>
        <div className="sp-file-zone-text">
          {uploading ? t("spUploading") : t("spClickToUpload")}
        </div>
        {fileName && <div className="sp-file-zone-name">{fileName}</div>}
        {currentPath && currentPath.match(/\.(jpg|jpeg|png|gif|webp)$/i) && (
          <img
            src={resolvePublicFileUrl(currentPath)}
            alt="preview"
            style={{ maxHeight: 80, marginTop: 8, borderRadius: 8, objectFit: "cover" }}
          />
        )}
      </div>
      <input ref={inputRef} type="file" accept={accept} style={{ display: "none" }} onChange={handleChange} />
    </div>
  );
}

const EMPTY_FORM = {
  // Personal
  phone: "", address: "", postal_code: "", city: "", country: "",
  date_of_birth: "", place_of_birth: "", gender: "",
  // Academic
  class_id: "", admission_status: "",
  // Father
  father_first_name: "", father_last_name: "", father_phone: "", father_email: "",
  father_address: "", father_postal_code: "", father_city: "", father_country: "",
  father_date_of_birth: "", father_job: "", father_place_of_job: "",
  father_condition: "", father_date_of_death: "",
  // Mother
  mother_first_name: "", mother_last_name: "", mother_phone: "", mother_email: "",
  mother_address: "", mother_postal_code: "", mother_city: "", mother_country: "",
  mother_date_of_birth: "", mother_job: "", mother_place_of_job: "",
  mother_condition: "", mother_date_of_death: "",
  // Relationship
  parents_relationship: "",
};

export default function StudentProfile() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const isProf = getStoredRole() === "professeur";
  const [student, setStudent] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [docs, setDocs] = useState({
    profile_picture: null,
    cover_photo: null,
    payment_proof: null,
    certificate_achievement: null,
    academic_transcript: null,
  });
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState(null);
  const [statuses, setStatuses] = useState({
    personnel_info: { status: 'pending', comment: '' },
    academic_info: { status: 'pending', comment: '' },
    payment_proof: { status: 'pending', comment: '' },
    certificate_achievement: { status: 'pending', comment: '' },
    academic_transcript: { status: 'pending', comment: '' },
    father_info: { status: 'pending', comment: '' },
    mother_info: { status: 'pending', comment: '' },
    parents_relationship: { status: 'pending', comment: '' },
  });
  const [profileStatus, setProfileStatus] = useState('pending'); // 'pending' or 'approved'
  const [editTab, setEditTab] = useState('personal'); // personal | academic | docs | family
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [alert, setAlert] = useState(null); // {type, msg}
  const [myPosts, setMyPosts] = useState([]);

  useEffect(() => {
    async function load() {
      try {
        const profileRes = await api.get("/student/profile");
        const { student: s, profile, status } = profileRes.data;
        const profRole = profileRes.data?.role === "professeur";
        setStudent(s);
        // Set profile status (pending or approved)
        setProfileStatus(profRole ? "approved" : (status || "pending"));
        if (profile) {
          const f = { ...EMPTY_FORM };
          Object.keys(EMPTY_FORM).forEach((k) => {
            if (profile[k] !== null && profile[k] !== undefined) {
              f[k] = profile[k] ?? "";
            }
          });
          // Format dates
          ["date_of_birth", "father_date_of_birth", "father_date_of_death",
           "mother_date_of_birth", "mother_date_of_death"].forEach((dk) => {
            if (f[dk]) f[dk] = f[dk].split("T")[0];
          });
          setForm(f);
          setDocs({
            profile_picture: withCacheBust(profile.profile_picture_url || profile.profile_picture || null),
            cover_photo: withCacheBust(profile.cover_photo_url || profile.cover_photo || null),
            payment_proof: profile.payment_proof || null,
            certificate_achievement: profile.certificate_achievement || null,
            academic_transcript: profile.academic_transcript || null,
          });
          // Load statuses (professors: no admin review workflow)
          const acceptedAll = {
            personnel_info: { status: "accepted", comment: "" },
            academic_info: { status: "accepted", comment: "" },
            payment_proof: { status: "accepted", comment: "" },
            certificate_achievement: { status: "accepted", comment: "" },
            academic_transcript: { status: "accepted", comment: "" },
            father_info: { status: "accepted", comment: "" },
            mother_info: { status: "accepted", comment: "" },
            parents_relationship: { status: "accepted", comment: "" },
          };
          if (profRole) {
            setStatuses(acceptedAll);
          } else {
            setStatuses({
              personnel_info: {
                status: profile.personnel_info_status || profile.personal_info_status || "pending",
                comment: profile.personnel_info_comment || profile.personal_info_comment || "",
              },
              academic_info: {
                status: profile.academic_info_status || "pending",
                comment: profile.academic_info_comment || "",
              },
              payment_proof: {
                status: profile.payment_proof_status || "pending",
                comment: profile.payment_proof_comment || "",
              },
              certificate_achievement: {
                status: profile.certificate_achievement_status || "pending",
                comment: profile.certificate_achievement_comment || "",
              },
              academic_transcript: {
                status: profile.academic_transcript_status || "pending",
                comment: profile.academic_transcript_comment || "",
              },
              father_info: {
                status: profile.father_info_status || "pending",
                comment: profile.father_info_comment || "",
              },
              mother_info: {
                status: profile.mother_info_status || "pending",
                comment: profile.mother_info_comment || "",
              },
              parents_relationship: {
                status: profile.parents_relationship_status || "pending",
                comment: profile.parents_relationship_comment || "",
              },
            });
          }
        }
        try {
          const classesRes = await api.get("/classes");
          setClasses(classesRes.data);
        } catch {
          setClasses([]);
        }
        try {
          const postsRes = await api.get("/posts/my");
          setMyPosts(Array.isArray(postsRes.data) ? postsRes.data : []);
        } catch {
          setMyPosts([]);
        }
      } catch {
        setAlert({ type: "error", msg: t("spFailedLoad") });
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [t, isProf]);

  useEffect(() => {
    return () => {
      if (avatarPreviewUrl) URL.revokeObjectURL(avatarPreviewUrl);
    };
  }, [avatarPreviewUrl]);

  useEffect(() => {
    if (isProf) setEditTab("personal");
  }, [isProf]);

  function set(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleDocUploaded(field, url, path) {
    // Prefer API-provided public URL when available (works across different hosts/ports).
    setDocs((prev) => ({ ...prev, [field]: url || path }));
    setAlert({ type: "success", msg: t("spUploadedSuccess") });
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setAlert(null);
    try {
      const payload = isProf ? { ...form, name: student?.name, email: student?.email } : form;
      await api.post("/student/profile", payload);
      setAlert({ type: "success", msg: isProf ? t("spProfileSavedProf") : t("spProfileSaved") });
      if (isProf) setProfileStatus("approved");
    } catch (err) {
      const d = err.response?.data;
      setAlert({ type: "error", msg: d?.message || (d?.errors ? Object.values(d.errors).flat().join(" ") : t("spFailedSave")) });
    } finally {
      setSaving(false);
    }
  }

  function handleLogout() {
    clearAuth();
    navigate("/login");
  }

  const avatarUrl = avatarPreviewUrl || resolvePublicFileUrl(docs.profile_picture);

  const profilePicInputRef = useRef();

  async function handleAvatarChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    // Instant preview while uploading.
    setAvatarPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await api.post("/student/profile/upload/profile_picture", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setDocs((prev) => ({ ...prev, profile_picture: withCacheBust(res.data.url || res.data.path) }));
      setAlert({ type: "success", msg: t("spProfilePictureUploaded") });
    } catch {
      alert(t("spAvatarUploadFailed"));
      setAvatarPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
    }
  }

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", fontFamily: "Inter, sans-serif" }}>
        <p>{t("spLoadingProfile")}</p>
      </div>
    );
  }

  function ApprovedProfileView() {
    const [section, setSection] = useState("profile"); // profile | academic | family | docs | posts
    const coverInputRef = useRef();

    const selectedClass = classes.find((c) => String(c.id) === String(form.class_id));
    const effectiveCover = resolvePublicFileUrl(docs.cover_photo) || avatarUrl || "";
    const coverStyle = effectiveCover ? { backgroundImage: `url(${effectiveCover})` } : {};

    async function handleCoverChange(e) {
      const file = e.target.files?.[0];
      if (!file) return;
      const fd = new FormData();
      fd.append("file", file);
      try {
        const res = await api.post("/student/profile/upload/cover_photo", fd, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        setDocs((prev) => ({ ...prev, cover_photo: withCacheBust(res.data.url || res.data.path) }));
      } catch {
        alert(t("spUploadFailed"));
      }
    }

    return (
      <div className="sp3-wrap">
        <header className="sp3-topnav">
          <div className="sp3-topnav-left">
            <div className="sp3-logo">Scolarité</div>
            <div className="sp3-toplinks">
              <button type="button" className="sp3-link" onClick={() => setSection("profile")}>{t("profile")}</button>
                {!isProf ? (
                  <>
                    <button type="button" className="sp3-link" onClick={() => setSection("academic")}>{t("spAcademic")}</button>
                    <button type="button" className="sp3-link" onClick={() => setSection("docs")}>{t("spDocuments")}</button>
                    <button type="button" className="sp3-link" onClick={() => setSection("posts")}>My Post</button>
                  </>
                ) : null}
            </div>
          </div>
          <div className="sp3-topnav-right">
            <div className="sp3-pill">{t("spProfileAccepted")}</div>
            <div className="sp3-mini-avatar">
              {avatarUrl ? <img src={avatarUrl} alt="avatar" /> : (student?.name?.slice(0, 1)?.toUpperCase() || "S")}
            </div>
          </div>
        </header>

        <div className="sp3-body">
          <aside className="sp3-side">
            <div className="sp3-side-card">
              <div className="sp3-side-title">{t("spPersonal")}</div>
              <button type="button" className={`sp3-side-item ${section === "profile" ? "is-active" : ""}`} onClick={() => setSection("profile")}>{t("profile")}</button>
              {!isProf ? (
                <>
                  <button type="button" className={`sp3-side-item ${section === "family" ? "is-active" : ""}`} onClick={() => setSection("family")}>{t("spFamily")}</button>
                  <button type="button" className={`sp3-side-item ${section === "posts" ? "is-active" : ""}`} onClick={() => setSection("posts")}>My Post</button>
                </>
              ) : null}
            </div>
            {!isProf ? (
              <div className="sp3-side-card">
                <div className="sp3-side-title">{t("spAcademic")}</div>
                <button type="button" className={`sp3-side-item ${section === "academic" ? "is-active" : ""}`} onClick={() => setSection("academic")}>{t("spClassInfo")}</button>
              </div>
            ) : null}
            <div className="sp3-side-card">
              <div className="sp3-side-title">{t("spOther")}</div>
              <Link className="sp3-side-item" to="/">{t("spHomePage")}</Link>
              <button type="button" className="sp3-side-item sp3-side-item--danger" onClick={handleLogout}>{t("logout")}</button>
              <button type="button" className="sp3-side-item sp3-side-item--primary" onClick={() => setProfileStatus("pending")}>
                {t("spModifyProfile")}
              </button>
            </div>
          </aside>

          <main className="sp3-main">
            <section className="sp3-card sp3-profile">
              <div className="sp3-cover" style={coverStyle}>
                <div className="sp3-cover-actions">
                  <input
                    ref={coverInputRef}
                    type="file"
                    accept="image/*"
                    style={{ display: "none" }}
                    onChange={handleCoverChange}
                  />
                  <input
                    ref={profilePicInputRef}
                    type="file"
                    accept="image/*"
                    style={{ display: "none" }}
                    onChange={handleAvatarChange}
                  />
                  <button type="button" className="sp3-btn" onClick={() => coverInputRef.current?.click()}>
                    {t("spChangeCover")}
                  </button>
                </div>
              </div>

              <div className="sp3-profile-head">
                <div
                  className="sp3-avatar"
                  onClick={() => profilePicInputRef.current?.click()}
                  title={t("spChangePhoto")}
                  style={{ cursor: "pointer" }}
                >
                  {avatarUrl ? <img src={avatarUrl} alt="avatar" /> : (student?.name?.slice(0, 1)?.toUpperCase() || "S")}
                </div>
                <div className="sp3-profile-id">
                  <div className="sp3-name">{student?.name || t("spStudent")}</div>
                  <div className="sp3-sub">{student?.email || "—"}</div>
                </div>
              </div>

              <div className="sp3-rows">
                {section === "profile" && (
                  <>
                    <div className="sp3-row"><div className="sp3-row-k">Matricule</div><div className="sp3-row-v">{student?.matricule || "—"}</div></div>
                <div className="sp3-row"><div className="sp3-row-k">{t("spPhone")}</div><div className="sp3-row-v">{form.phone || "—"}</div></div>
                <div className="sp3-row"><div className="sp3-row-k">{t("spAddress")}</div><div className="sp3-row-v">{form.address || "—"}</div></div>
                <div className="sp3-row"><div className="sp3-row-k">{t("spCity")}</div><div className="sp3-row-v">{form.city || "—"}</div></div>
                <div className="sp3-row"><div className="sp3-row-k">{t("spCountry")}</div><div className="sp3-row-v">{form.country || "—"}</div></div>
                  </>
                )}

                {section === "academic" && (
                  <>
                    <div className="sp3-row"><div className="sp3-row-k">{t("spClass")}</div><div className="sp3-row-v">{selectedClass?.name || "—"}</div></div>
                    <div className="sp3-row"><div className="sp3-row-k">{t("spAcademicYear")}</div><div className="sp3-row-v">{selectedClass?.annee_scolaire || "—"}</div></div>
                    <div className="sp3-row"><div className="sp3-row-k">{t("spDepartment")}</div><div className="sp3-row-v">{selectedClass?.departement || "—"}</div></div>
                    <div className="sp3-row"><div className="sp3-row-k">{t("spAdmission")}</div><div className="sp3-row-v">{form.admission_status || "—"}</div></div>
                  </>
                )}

                {section === "family" && (
                  <>
                    <div className="sp3-row"><div className="sp3-row-k">Father</div><div className="sp3-row-v">{form.father_first_name || "—"} {form.father_last_name || ""}</div></div>
                    <div className="sp3-row"><div className="sp3-row-k">Father phone</div><div className="sp3-row-v">{form.father_phone || "—"}</div></div>
                    <div className="sp3-row"><div className="sp3-row-k">Mother</div><div className="sp3-row-v">{form.mother_first_name || "—"} {form.mother_last_name || ""}</div></div>
                    <div className="sp3-row"><div className="sp3-row-k">Mother phone</div><div className="sp3-row-v">{form.mother_phone || "—"}</div></div>
                    <div className="sp3-row"><div className="sp3-row-k">Relationship</div><div className="sp3-row-v">{form.parents_relationship || "—"}</div></div>
                  </>
                )}

                {section === "docs" && (
                  <>
                    <div className="sp3-row"><div className="sp3-row-k">Payment proof</div><div className="sp3-row-v">{docs.payment_proof ? "✓ Uploaded" : "—"}</div></div>
                    <div className="sp3-row"><div className="sp3-row-k">Certificate</div><div className="sp3-row-v">{docs.certificate_achievement ? "✓ Uploaded" : "—"}</div></div>
                    <div className="sp3-row"><div className="sp3-row-k">Transcript</div><div className="sp3-row-v">{docs.academic_transcript ? "✓ Uploaded" : "—"}</div></div>
                  </>
                )}

                {section === "posts" && (
                  <div className="sp3-posts">
                    {myPosts.length === 0 ? (
                      <div className="sp3-post-empty">{t("postNoPosts")}</div>
                    ) : (
                      myPosts.map((post) => (
                        <article key={post.id} className="sp3-post-item sp3-post-card">
                          <div className="sp3-post-head">
                            <div className="sp3-post-author-avatar">
                              {avatarUrl ? <img src={avatarUrl} alt={student?.name || "Student"} /> : (student?.name?.slice(0, 1)?.toUpperCase() || "S")}
                            </div>
                            <div className="sp3-post-author-meta">
                              <div className="sp3-post-author-name">{student?.name || "Student"}</div>
                              <div className="sp3-post-author-sub">
                                {(form.classe || "IT11")} · {post.created_at ? new Date(post.created_at).toLocaleString() : ""}
                              </div>
                            </div>
                            <button type="button" className="sp3-post-more">•••</button>
                          </div>
                          {post.body ? <p className="sp3-post-body">{post.body}</p> : null}
                          {post.image_url ? <img src={post.image_url} alt="post" className="sp3-post-image" /> : null}
                          <div className="sp3-post-actions">
                            <button type="button">❤ {Number(post.likes_count || 0)}</button>
                            <button type="button">💬 {Number(post.comments_count || 0)}</button>
                            <button type="button">➤</button>
                          </div>
                          <div className="sp3-post-comment">
                            <span className="sp3-post-comment-avatar">
                              {avatarUrl ? <img src={avatarUrl} alt={student?.name || "Student"} /> : (student?.name?.slice(0, 1)?.toUpperCase() || "S")}
                            </span>
                            <input type="text" placeholder={t("postWriteComment")} disabled />
                            <button type="button" className="sp3-post-send">{t("smSend")}</button>
                          </div>
                        </article>
                      ))
                    )}
                  </div>
                )}
              </div>
            </section>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="sp4-wrap">
      {profileStatus === "approved" ? (
        <ApprovedProfileView />
      ) : (
        <>
          <header className="sp4-topbar">
            <div className="sp4-top-left">
              <div className="sp4-brand">🎓 Scolarité</div>
              <div className="sp4-search">
                <span className="sp4-search-ic">⌕</span>
                <input className="sp4-search-input" placeholder={t("spSearch")} />
              </div>
            </div>
            <div className="sp4-top-right">
              <button type="button" className="sp4-btn sp4-btn--primary" onClick={handleSave} disabled={saving}>
                {saving ? t("spSaving") : t("spSave")}
              </button>
              <button type="button" className="sp4-btn" onClick={handleLogout}>{t("logout")}</button>
            </div>
          </header>

          <div className="sp4-body">
            <aside className="sp4-side">
              <input
                ref={profilePicInputRef}
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={handleAvatarChange}
              />
              <div className="sp4-usercard">
                <div
                  className="sp4-uc-avatar"
                  onClick={() => profilePicInputRef.current?.click()}
                  title={t("spChangePhoto")}
                  style={{ cursor: "pointer" }}
                >
                  {avatarUrl ? <img src={avatarUrl} alt="avatar" /> : (student?.name?.slice(0, 1)?.toUpperCase() || "S")}
                </div>
                <div className="sp4-uc-name">{student?.name || t("spStudent")}</div>
                <div className="sp4-uc-meta">{student?.email || "—"}</div>
                <div className="sp4-uc-pill">{isProf ? "Professeur" : `${t("spProfile")}: ${profileStatus}`}</div>
              </div>

              <div className="sp4-nav">
                <button type="button" className={`sp4-nav-item ${editTab === "personal" ? "is-active" : ""}`} onClick={() => setEditTab("personal")}>{t("spPersonal")}</button>
                {!isProf ? (
                  <>
                    <button type="button" className={`sp4-nav-item ${editTab === "academic" ? "is-active" : ""}`} onClick={() => setEditTab("academic")}>{t("spAcademic")}</button>
                    <button type="button" className={`sp4-nav-item ${editTab === "docs" ? "is-active" : ""}`} onClick={() => setEditTab("docs")}>{t("spDocuments")}</button>
                    <button type="button" className={`sp4-nav-item ${editTab === "family" ? "is-active" : ""}`} onClick={() => setEditTab("family")}>{t("spFamily")}</button>
                  </>
                ) : null}
              </div>
            </aside>

            <main className="sp4-main">
              {alert && (
                <div className={`sp-alert sp-alert--${alert.type}`}>{alert.msg}</div>
              )}

              <form onSubmit={handleSave}>
          {/* Personal Information */}
          {editTab === 'personal' && (
          <Section icon="👤" title={t("spPersonalInformation")} status={isProf ? "accepted" : statuses.personnel_info.status} comment={isProf ? "" : statuses.personnel_info.comment} defaultOpen={true} t={t}>
            <div className="sp-grid">
              <div className="sp-field">
                <label className="sp-label">{t("spFullName")}</label>
                <input
                  className="sp-input"
                  value={student?.name || ""}
                  disabled={!isProf}
                  onChange={isProf ? (e) => setStudent((prev) => ({ ...prev, name: e.target.value })) : undefined}
                />
              </div>
              <div className="sp-field">
                <label className="sp-label">Email</label>
                <input
                  className="sp-input"
                  type="email"
                  value={student?.email || ""}
                  disabled={!isProf}
                  onChange={isProf ? (e) => setStudent((prev) => ({ ...prev, email: e.target.value })) : undefined}
                />
              </div>
              <div className="sp-field">
                <label className="sp-label">{t("spPhoneNumber")}</label>
                <input className="sp-input" type="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+213 555 000 000" />
              </div>
              <div className="sp-field">
                <label className="sp-label">{t("spDateOfBirth")}</label>
                <input className="sp-input" type="date" value={form.date_of_birth} onChange={(e) => set("date_of_birth", e.target.value)} />
              </div>
              <div className="sp-field">
                <label className="sp-label">Place of Birth</label>
                <input className="sp-input" value={form.place_of_birth} onChange={(e) => set("place_of_birth", e.target.value)} placeholder="City, Country" />
              </div>
              <div className="sp-field">
                <label className="sp-label">Gender</label>
                <select className="sp-select" value={form.gender} onChange={(e) => set("gender", e.target.value)}>
                  <option value="">Select gender</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
              </div>
              <div className="sp-field sp-full">
                <label className="sp-label">Address</label>
                <input className="sp-input" value={form.address} onChange={(e) => set("address", e.target.value)} placeholder="Street address" />
              </div>
              <div className="sp-field">
                <label className="sp-label">Postal Code</label>
                <input className="sp-input" value={form.postal_code} onChange={(e) => set("postal_code", e.target.value)} placeholder="16000" />
              </div>
              <div className="sp-field">
                <label className="sp-label">City</label>
                <input className="sp-input" value={form.city} onChange={(e) => set("city", e.target.value)} placeholder="Algiers" />
              </div>
              <div className="sp-field">
                <label className="sp-label">Country</label>
                <input className="sp-input" value={form.country} onChange={(e) => set("country", e.target.value)} placeholder="Algeria" />
              </div>
            </div>
          </Section>
          )}

          {/* Academic Information */}
          {!isProf && editTab === 'academic' && (
          <Section icon="📚" title={t("spAcademicInformation")} status={statuses.academic_info.status} comment={statuses.academic_info.comment} defaultOpen={true} t={t}>
            <div className="sp-grid">
              <div className="sp-field">
                <label className="sp-label">Class (select from available)</label>
                <select className="sp-select" value={form.class_id} onChange={(e) => set("class_id", e.target.value)}>
                  <option value="">— Select your class —</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.annee_scolaire ? `[${c.annee_scolaire}] ` : ""}{c.name}{c.departement ? ` (${c.departement})` : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div className="sp-field">
                <label className="sp-label">Last Year Status</label>
                <select className="sp-select" value={form.admission_status} onChange={(e) => set("admission_status", e.target.value)}>
                  <option value="">Select status</option>
                  <option value="first_year">First Year (new student)</option>
                  <option value="admis">Admis (passed)</option>
                  <option value="refused">Refused / Failed</option>
                </select>
              </div>
            </div>
          </Section>
          )}

          {/* Documents */}
          {!isProf && editTab === 'docs' && (
          <Section icon="📎" title={t("spDocuments")} status={statuses.payment_proof.status} comment={statuses.payment_proof.comment} t={t}>
            <div className="sp-grid">
              <FileUpload
                label="Payment Proof"
                field="payment_proof"
                currentPath={docs.payment_proof}
                onUploaded={handleDocUploaded}
                accept="image/*,.pdf"
                t={t}
              />
              <FileUpload
                label="Certificate of Achievement (last year)"
                field="certificate_achievement"
                currentPath={docs.certificate_achievement}
                onUploaded={handleDocUploaded}
                accept="image/*,.pdf"
                t={t}
              />
              <FileUpload
                label="Academic Transcript (last year)"
                field="academic_transcript"
                currentPath={docs.academic_transcript}
                onUploaded={handleDocUploaded}
                accept="image/*,.pdf"
                t={t}
              />
            </div>
          </Section>
          )}

          {!isProf && editTab === 'family' && (
          <>
          {/* Father's Information */}
          <Section icon="👨" title={t("spFatherInfo")} status={statuses.father_info.status} comment={statuses.father_info.comment} t={t}>
            <div className="sp-grid">
              <div className="sp-field">
                <label className="sp-label">First Name</label>
                <input className="sp-input" value={form.father_first_name} onChange={(e) => set("father_first_name", e.target.value)} />
              </div>
              <div className="sp-field">
                <label className="sp-label">Last Name</label>
                <input className="sp-input" value={form.father_last_name} onChange={(e) => set("father_last_name", e.target.value)} />
              </div>
              <div className="sp-field">
                <label className="sp-label">Phone</label>
                <input className="sp-input" type="tel" value={form.father_phone} onChange={(e) => set("father_phone", e.target.value)} />
              </div>
              <div className="sp-field">
                <label className="sp-label">Email</label>
                <input className="sp-input" type="email" value={form.father_email} onChange={(e) => set("father_email", e.target.value)} />
              </div>
              <div className="sp-field sp-full">
                <label className="sp-label">Address</label>
                <input className="sp-input" value={form.father_address} onChange={(e) => set("father_address", e.target.value)} />
              </div>
              <div className="sp-field">
                <label className="sp-label">Postal Code</label>
                <input className="sp-input" value={form.father_postal_code} onChange={(e) => set("father_postal_code", e.target.value)} />
              </div>
              <div className="sp-field">
                <label className="sp-label">City</label>
                <input className="sp-input" value={form.father_city} onChange={(e) => set("father_city", e.target.value)} />
              </div>
              <div className="sp-field">
                <label className="sp-label">Country</label>
                <input className="sp-input" value={form.father_country} onChange={(e) => set("father_country", e.target.value)} />
              </div>
              <div className="sp-field">
                <label className="sp-label">Date of Birth</label>
                <input className="sp-input" type="date" value={form.father_date_of_birth} onChange={(e) => set("father_date_of_birth", e.target.value)} />
              </div>
              <div className="sp-field">
                <label className="sp-label">Job / Profession</label>
                <input className="sp-input" value={form.father_job} onChange={(e) => set("father_job", e.target.value)} />
              </div>
              <div className="sp-field">
                <label className="sp-label">Place of Work</label>
                <input className="sp-input" value={form.father_place_of_job} onChange={(e) => set("father_place_of_job", e.target.value)} />
              </div>
              <div className="sp-field">
                <label className="sp-label">Condition</label>
                <select className="sp-select" value={form.father_condition} onChange={(e) => set("father_condition", e.target.value)}>
                  <option value="">Select</option>
                  <option value="alive">Alive</option>
                  <option value="deceased">Deceased</option>
                </select>
              </div>
              {form.father_condition === "deceased" && (
                <div className="sp-field">
                  <label className="sp-label">Date of Death</label>
                  <input className="sp-input" type="date" value={form.father_date_of_death} onChange={(e) => set("father_date_of_death", e.target.value)} />
                </div>
              )}
            </div>
          </Section>

          {/* Mother's Information */}
          <Section icon="👩" title={t("spMotherInfo")} status={statuses.mother_info.status} comment={statuses.mother_info.comment} t={t}>
            <div className="sp-grid">
              <div className="sp-field">
                <label className="sp-label">First Name</label>
                <input className="sp-input" value={form.mother_first_name} onChange={(e) => set("mother_first_name", e.target.value)} />
              </div>
              <div className="sp-field">
                <label className="sp-label">Last Name</label>
                <input className="sp-input" value={form.mother_last_name} onChange={(e) => set("mother_last_name", e.target.value)} />
              </div>
              <div className="sp-field">
                <label className="sp-label">Phone</label>
                <input className="sp-input" type="tel" value={form.mother_phone} onChange={(e) => set("mother_phone", e.target.value)} />
              </div>
              <div className="sp-field">
                <label className="sp-label">Email</label>
                <input className="sp-input" type="email" value={form.mother_email} onChange={(e) => set("mother_email", e.target.value)} />
              </div>
              <div className="sp-field sp-full">
                <label className="sp-label">Address</label>
                <input className="sp-input" value={form.mother_address} onChange={(e) => set("mother_address", e.target.value)} />
              </div>
              <div className="sp-field">
                <label className="sp-label">Postal Code</label>
                <input className="sp-input" value={form.mother_postal_code} onChange={(e) => set("mother_postal_code", e.target.value)} />
              </div>
              <div className="sp-field">
                <label className="sp-label">City</label>
                <input className="sp-input" value={form.mother_city} onChange={(e) => set("mother_city", e.target.value)} />
              </div>
              <div className="sp-field">
                <label className="sp-label">Country</label>
                <input className="sp-input" value={form.mother_country} onChange={(e) => set("mother_country", e.target.value)} />
              </div>
              <div className="sp-field">
                <label className="sp-label">Date of Birth</label>
                <input className="sp-input" type="date" value={form.mother_date_of_birth} onChange={(e) => set("mother_date_of_birth", e.target.value)} />
              </div>
              <div className="sp-field">
                <label className="sp-label">Job / Profession</label>
                <input className="sp-input" value={form.mother_job} onChange={(e) => set("mother_job", e.target.value)} />
              </div>
              <div className="sp-field">
                <label className="sp-label">Place of Work</label>
                <input className="sp-input" value={form.mother_place_of_job} onChange={(e) => set("mother_place_of_job", e.target.value)} />
              </div>
              <div className="sp-field">
                <label className="sp-label">Condition</label>
                <select className="sp-select" value={form.mother_condition} onChange={(e) => set("mother_condition", e.target.value)}>
                  <option value="">Select</option>
                  <option value="alive">Alive</option>
                  <option value="deceased">Deceased</option>
                </select>
              </div>
              {form.mother_condition === "deceased" && (
                <div className="sp-field">
                  <label className="sp-label">Date of Death</label>
                  <input className="sp-input" type="date" value={form.mother_date_of_death} onChange={(e) => set("mother_date_of_death", e.target.value)} />
                </div>
              )}
            </div>
          </Section>

          {/* Parents Relationship */}
          <Section icon="💑" title={t("spParentsRelationship")} status={statuses.parents_relationship.status} comment={statuses.parents_relationship.comment} t={t}>
            <div className="sp-grid">
              <div className="sp-field">
                <label className="sp-label">Relationship Status</label>
                <select className="sp-select" value={form.parents_relationship} onChange={(e) => set("parents_relationship", e.target.value)}>
                  <option value="">Select</option>
                  <option value="married">Married</option>
                  <option value="divorced">Divorced</option>
                </select>
              </div>
            </div>
          </Section>
          </>
          )}

          {/* Bottom save */}
          <div className="sp-save-bar" style={{ marginTop: 8 }}>
            <button type="submit" className="sp-btn-primary" disabled={saving}>
              {saving ? t("spSaving") : `💾 ${t("spSaveProfile")}`}
            </button>
          </div>
        </form>
            </main>
          </div>
        </>
      )}
    </div>
  );
}
