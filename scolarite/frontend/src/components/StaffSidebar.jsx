import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import { useLanguage } from "../i18n/LanguageContext";
import "../pages/AdminPanel.css";

/**
 * Single source of truth for staff navigation (admin, directeur des études, professeur).
 * Same links and order on every page; active state follows the current route.
 */
export default function StaffSidebar({ variant }) {
  const navigate = useNavigate();
  const auth = useAuth();
  const { language, t } = useLanguage();
  const tr = (en, fr, ar) => {
    if (language === "fr") return fr;
    if (language === "ar" && ar !== undefined) return ar;
    return en;
  };

  const navClass = ({ isActive }) => `admin-nav-item${isActive ? " admin-nav-item--active" : ""}`;

  async function handleLogout() {
    await auth.logout();
    navigate("/login");
  }

  const brandMark = variant === "professeur" ? "P" : variant === "directeur" ? "D" : "S";
  const brandSubtitle =
    variant === "professeur"
      ? tr("Professor", "Professeur", "أستاذ")
      : variant === "directeur"
        ? tr("Director of studies", "Directeur des etudes", "مدير الدراسات")
        : tr("Administration", "Administration", "الإدارة");

  const logoutLabel = tr("Logout", "Deconnexion", "تسجيل الخروج");

  return (
    <aside className="admin-sidebar">
      <div className="admin-brand">
        <div className="admin-brand-mark" aria-hidden="true">
          {brandMark}
        </div>
        <div className="admin-brand-text">
          <div className="admin-brand-title">Scolarite</div>
          <div className="admin-brand-subtitle">{brandSubtitle}</div>
        </div>
      </div>

      <nav className="admin-nav">
        {variant === "admin" ? (
          <>
            <NavLink className={navClass} end to="/">
              {tr("Home", "Accueil", "الرئيسية")}
            </NavLink>
            <NavLink className={navClass} end to="/admin">
              {tr("User management", "Gestion des utilisateurs", "إدارة المستخدمين")}
            </NavLink>
            <NavLink className={navClass} to="/classes">
              {tr("Classes", "Classes", "الأقسام")}
            </NavLink>
            <NavLink className={navClass} to="/accounts">
              {tr("Accounts", "Comptes", "الحسابات")}
            </NavLink>
            <NavLink className={navClass} to="/admin/student-contacts">
              {tr("Student contacts", "Contacts etudiants", "رسائل الطلبة")}
            </NavLink>
            <NavLink className={navClass} to="/admin/messages">
              {tr("Messages monitor", "Surveillance messages", "مراقبة الرسائل")}
            </NavLink>
            <NavLink className={navClass} to="/admin/grades">
              {tr("Grades control", "Controle des notes", "إدارة العلامات")}
            </NavLink>
            <NavLink className={navClass} to="/admin/attendance-certificates">
              {t("menuAttendanceCert")}
            </NavLink>
            <NavLink className={navClass} to="/change-password">
              {tr("Change password", "Changer le mot de passe", "تغيير كلمة المرور")}
            </NavLink>
          </>
        ) : null}

        {variant === "directeur" ? (
          <>
            <NavLink className={navClass} end to="/">
              {tr("Home", "Accueil", "الرئيسية")}
            </NavLink>
            <NavLink className={navClass} to="/directeur/classes">
              {tr("Classes", "Classes", "الأقسام")}
            </NavLink>
            <NavLink className={navClass} to="/directeur/plans">
              {tr("Study plans", "Plans d'etude", "مخططات الدراسة")}
            </NavLink>
            <NavLink className={navClass} to="/directeur/prof-assignments">
              {tr("Profs / subjects (panier)", "Profs / matieres (panier)", "الأساتذة / المواد")}
            </NavLink>
            <NavLink className={navClass} to="/directeur/timetable">
              {tr("Timetable (students)", "Emploi du temps (etudiants)", "جدول الطلاب")}
            </NavLink>
            <NavLink className={navClass} to="/directeur/exam-calendar">
              {tr("Exam calendar (students)", "Calendrier examens (etudiants)", "امتحانات الطلاب")}
            </NavLink>
            <NavLink className={navClass} to="/directeur/prof-timetable">
              {tr("Timetable (professors)", "Emploi du temps (professeurs)", "جدول الأساتذة")}
            </NavLink>
            <NavLink className={navClass} to="/directeur/prof-exam-surveillance">
              {tr("Exam surveillance (professors)", "Surveillance examens (professeurs)", "مراقبة الامتحانات")}
            </NavLink>
            <NavLink className={navClass} to="/change-password">
              {tr("Change password", "Changer le mot de passe", "تغيير كلمة المرور")}
            </NavLink>
          </>
        ) : null}

        {variant === "professeur" ? (
          <>
            <p className="admin-nav-section-label">{tr("Menu", "Menu", "القائمة")}</p>
            <NavLink className={navClass} end to="/">
              {tr("Home", "Accueil", "الرئيسية")}
            </NavLink>
            <p className="admin-nav-section-label">{tr("Teaching", "Enseignement", "التدريس")}</p>
            <NavLink className={navClass} end to="/professeur">
              {tr("My classes", "Mes classes", "أقسامي")}
            </NavLink>
            <NavLink className={navClass} to="/professeur/notes">
              {tr("Grades", "Notes", "العلامات")}
            </NavLink>
            <NavLink className={navClass} to="/professeur/absences">
              {tr("Absences", "Absences", "الغيابات")}
            </NavLink>
            <NavLink className={navClass} to="/professeur/attendance-certificates">
              {t("menuAttendanceCert")}
            </NavLink>
            <NavLink className={navClass} to="/professeur/timetable">
              {tr("Timetable", "Emploi du temps", "الجدول الزمني")}
            </NavLink>
            <NavLink className={navClass} to="/professeur/exam-surveillance">
              {tr("Exam surveillance", "Surveillance examens", "مراقبة الامتحان")}
            </NavLink>
            <NavLink className={navClass} to="/professeur/internships/soutenance">
              {tr("PFE internships", "Stages PFE", "تربصات PFE")}
            </NavLink>
            <p className="admin-nav-section-label">{tr("Campus", "Campus", "الحرم")}</p>
            <NavLink className={navClass} to="/student/posts">
              {tr("Posts", "Publications", "منشورات")}
            </NavLink>
            <NavLink className={navClass} to="/student/friends">
              {tr("Friends", "Reseau", "الشبكة")}
            </NavLink>
            <NavLink className={navClass} to="/messages/panier">
              {t("menuPanierMessages")}
            </NavLink>
            <p className="admin-nav-section-label">{tr("Account", "Compte", "الحساب")}</p>
            <NavLink className={navClass} to="/profile">
              {tr("Profile", "Profil", "الملف")}
            </NavLink>
            <NavLink className={navClass} to="/change-password">
              {tr("Change password", "Changer le mot de passe", "تغيير كلمة المرور")}
            </NavLink>
          </>
        ) : null}
      </nav>

      <div className="admin-sidebar-footer">
        <button type="button" className="admin-secondary-btn" style={{ width: "100%" }} onClick={handleLogout}>
          {logoutLabel}
        </button>
      </div>
    </aside>
  );
}
