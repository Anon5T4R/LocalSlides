import { LOCALE_LABELS, useLocale, setLocale, t, type Locale } from "../lib/i18n";

/** Small language dropdown for the top bar (EN/PT/ES). */
export function LocalePicker() {
  const locale = useLocale();
  return (
    <select
      className="lang-select"
      value={locale}
      onChange={(e) => setLocale(e.target.value as Locale)}
      title={t("lang.title")}
      aria-label={t("lang.title")}
    >
      {(Object.keys(LOCALE_LABELS) as Locale[]).map((l) => (
        <option key={l} value={l}>
          {LOCALE_LABELS[l]}
        </option>
      ))}
    </select>
  );
}
