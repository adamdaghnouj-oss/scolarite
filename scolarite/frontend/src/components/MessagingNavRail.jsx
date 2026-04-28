import { Link, useLocation, useNavigate } from "react-router-dom";
import { api } from "../api/axios";
import { clearAuth, getStoredRole } from "../auth/auth";
import { useLanguage } from "../i18n/LanguageContext";

function cn(active) {
  return `sm-rail-link ${active ? "is-active" : ""}`;
}

/**
 * Thin vertical nav for messaging layouts (student DMs + class messages).
 */
export default function MessagingNavRail({ classTabActive = false, onClassClick = null }) {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const role = getStoredRole();
  const p = location.pathname || "";
  const qp = new URLSearchParams(location.search || "");

  const isPanier = p.includes("/messages/panier");
  const isStudentMessages = p.includes("/student/messages");
  const isPosts = p.includes("/student/posts");
  const isFriends = p.includes("/student/friends");
  const isProfile = p.includes("/profile");
  const isProfTeaching = role === "professeur" && p.includes("/professeur");
  const isStudentHome = role !== "professeur" && (p === "/" || p === "");
  const isClassRoute = isStudentMessages && qp.get("tab") === "class";

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

  const railInitial = role === "professeur" ? "P" : "É";

  return (
    <nav className="sm-rail" aria-label="Navigation">
      <div className="sm-rail-inner">
        <div className="sm-rail-brand" title={role === "professeur" ? "Professeur" : "Étudiant"}>
          {railInitial}
        </div>
        {role === "professeur" ? (
          <Link className={cn(isProfTeaching)} to="/professeur">
            Accueil
          </Link>
        ) : (
          <Link className={cn(isStudentHome)} to="/">
            Accueil
          </Link>
        )}
        <Link className={cn(isPosts)} to="/student/posts">
          {t("menuPost")}
        </Link>
        <Link className={cn(isFriends)} to="/student/friends">
          {t("menuFriends")}
        </Link>
        {role === "student" ? (
          <Link className={cn(isStudentMessages && !classTabActive)} to="/student/messages">
            {t("menuMessaging")}
          </Link>
        ) : null}
        <Link className={cn(isPanier)} to="/messages/panier">
          {t("menuPanierMessages")}
        </Link>
        {role === "professeur" ? (
          <Link className={cn(isProfTeaching)} to="/professeur">
            Mes classes
          </Link>
        ) : null}
        {role === "student" ? (
          typeof onClassClick === "function" ? (
            <button type="button" className={cn(classTabActive || isClassRoute)} onClick={onClassClick}>
              {t("class")}
            </button>
          ) : (
            <Link className={cn(isClassRoute)} to="/student/messages?tab=class">
              {t("class")}
            </Link>
          )
        ) : null}
        <Link className={cn(isProfile)} to="/profile">
          {t("profile")}
        </Link>
        <button type="button" className="sm-rail-link sm-rail-link--logout" onClick={handleLogout}>
          {t("logout")}
        </button>
      </div>
    </nav>
  );
}
