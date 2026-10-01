import { appIcon } from "@/app/_components/app-icon";

// Icona per "Aggiungi a schermata Home" su iPhone (WP-010).
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return appIcon(size.width, "apple");
}
