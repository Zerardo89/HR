import { ImageResponse } from "next/og";
import { BRAND_COLORS } from "@/lib/brand";

/**
 * Icona provvisoria dell'app (WP-010), finché non arriva quella di ComfyUI (V-02): una "J" seguita da un punto,
 * disegnata con forme semplici (nessun font da caricare).
 * - `any`: quadrato con gli angoli arrotondati (browser, installazione dal sito).
 * - `maskable`: a tutto campo, con il disegno nella zona sicura centrale (icone adattive di Android, TWA).
 * - `apple`: a tutto campo, gli angoli li arrotonda iOS.
 */
export type AppIconVariant = "any" | "maskable" | "apple";

export function appIcon(size: number, variant: AppIconVariant): ImageResponse {
  const content = size * (variant === "maskable" ? 0.52 : 0.64);
  const u = content / 7.2; // il disegno è largo 7,2 unità: la "J" (4,8) e il punto
  const line = 1.6 * u;
  const white = BRAND_COLORS.primaryForeground;
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: BRAND_COLORS.primary,
        borderRadius: variant === "any" ? size * 0.22 : 0,
      }}
    >
      <div style={{ display: "flex", position: "relative", width: 7.2 * u, height: 6.6 * u }}>
        {/* tratto in alto */}
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: 4.8 * u,
            height: line,
            borderRadius: 0.3 * u,
            background: white,
          }}
        />
        {/* asta */}
        <div
          style={{
            position: "absolute",
            left: 3.2 * u,
            top: 0,
            width: line,
            height: 4.2 * u, // fino a dove inizia la curva: nessuno scalino
            background: white,
          }}
        />
        {/* ricciolo in basso */}
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 3.4 * u,
            width: 4.8 * u,
            height: 3.2 * u,
            borderLeft: `${line}px solid ${white}`,
            borderRight: `${line}px solid ${white}`,
            borderBottom: `${line}px solid ${white}`,
            borderBottomLeftRadius: 2.4 * u,
            borderBottomRightRadius: 2.4 * u,
          }}
        />
        {/* punto */}
        <div
          style={{
            position: "absolute",
            left: 5.6 * u,
            top: 5 * u,
            width: line,
            height: line,
            borderRadius: line,
            background: BRAND_COLORS.accent,
          }}
        />
      </div>
    </div>,
    { width: size, height: size },
  );
}
