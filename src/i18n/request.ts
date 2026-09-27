import { getRequestConfig } from "next-intl/server";

// Una sola lingua all'MVP; la struttura è pronta per aggiungerne altre (docs/06-ROADMAP.md, 2027).
export const DEFAULT_LOCALE = "it";

export default getRequestConfig(async () => {
  const locale = DEFAULT_LOCALE;
  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
    timeZone: "Europe/Rome",
  };
});
