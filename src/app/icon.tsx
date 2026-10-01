import { appIcon } from "@/app/_components/app-icon";

// Icona della scheda del browser (WP-010). Generata una volta in fase di build.
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return appIcon(size.width, "any");
}
