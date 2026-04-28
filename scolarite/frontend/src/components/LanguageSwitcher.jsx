import { useLanguage } from "../i18n/LanguageContext";

export default function LanguageSwitcher() {
  const { language, setLanguage, t } = useLanguage();

  return (
    <div className="lang-switcher">
      <span className="lang-switcher__label">{t("language")}:</span>
      <button
        type="button"
        className={`lang-switcher__btn ${language === "en" ? "active" : ""}`}
        onClick={() => setLanguage("en")}
      >
        {t("english")}
      </button>
      <button
        type="button"
        className={`lang-switcher__btn ${language === "fr" ? "active" : ""}`}
        onClick={() => setLanguage("fr")}
      >
        {t("french")}
      </button>
    </div>
  );
}
