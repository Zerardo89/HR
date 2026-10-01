import { ImageResponse } from "next/og";
import { BRAND_COLORS } from "@/lib/brand";

/**
 * Icona provvisoria di Tasky (WP-010), finché non arriva quella di ComfyUI (V-02): una "T" seguita da un punto,
 * disegnata con rettangoli (nessun font da caricare).
 * - `any`: quadrato con gli angoli arrotondati (browser, installazione dal sito).
 * - `maskable`: a tutto campo, con il disegno nella zona sicura centrale (icone adattive di Android, TWA).
 * - `apple`: a tutto campo, gli angoli li arrotonda iOS.
 */
export type AppIconVariant = "any" | "maskable" | "apple";

export function appIcon(size: number, variant: AppIconVariant): ImageResponse {
  const content = size * (variant === "maskable" ? 0.62 : 0.8);
  const u = content / 10;
  const bar = 1.6 * u;
  const side = bar + 0.6 * u; // il punto a destra, bilanciato da uno spazio uguale a sinistra
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
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        <div
          style={{
            width: 6 * u,
            height: bar,
            borderRadius: 0.3 * u,
            background: BRAND_COLORS.primaryForeground,
          }}
        />
        <div style={{ display: "flex", alignItems: "flex-end" }}>
          <div style={{ width: side, height: bar }} />
          <div
            style={{
              width: bar,
              height: 5 * u,
              borderRadius: `0 0 ${0.3 * u}px ${0.3 * u}px`,
              background: BRAND_COLORS.primaryForeground,
            }}
          />
          <div style={{ display: "flex", width: side, justifyContent: "flex-end" }}>
            <div
              style={{
                width: bar,
                height: bar,
                borderRadius: bar,
                background: BRAND_COLORS.accent,
              }}
            />
          </div>
        </div>
      </div>
    </div>,
    { width: size, height: size },
  );
}
