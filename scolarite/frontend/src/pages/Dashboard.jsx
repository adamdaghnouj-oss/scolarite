import "./Dashboard.css";
import { useLanguage } from "../i18n/LanguageContext";
import { useAuth } from "../auth/useAuth";

export default function Dashboard() {
  const auth = useAuth();
  const user = auth.user;
  const { language } = useLanguage();
  const tr = (en, fr, ar) => (language === "fr" ? fr : language === "ar" ? ar : en);

  return (
    <div className="dashboard-container">
      <h1>{tr("Welcome", "Bienvenue", "مرحبًا")} {user ? user.name : tr("Student", "Étudiant", "الطالب")} 👋</h1>
      <p>{tr("Your university dashboard", "Votre tableau de bord universitaire", "لوحة التحكم الجامعية الخاصة بك")}</p>

      {/* DASHBOARD CARDS */}
      <div className="dashboard-grid">
        <div className="card">
          <h3>📚 {tr("Courses", "Cours", "المقررات")}</h3>
          <p>{tr("View your registered courses", "Voir vos cours inscrits", "عرض مقرراتك المسجلة")}</p>
        </div>

        <div className="card">
          <h3>📝 {tr("Grades", "Notes", "العلامات")}</h3>
          <p>{tr("Check your exam results", "Consultez vos résultats d'examen", "تحقق من نتائج امتحاناتك")}</p>
        </div>

        <div className="card">
          <h3>💳 {tr("Payments", "Paiements", "المدفوعات")}</h3>
          <p>{tr("View tuition payments", "Voir les paiements de scolarité", "عرض مدفوعات الدراسة")}</p>
        </div>

        <div className="card">
          <h3>📄 {tr("Documents", "Documents", "الوثائق")}</h3>
          <p>{tr("Download certificates", "Télécharger les attestations", "تنزيل الشهادات")}</p>
        </div>
      </div>
    </div>
  );
}
