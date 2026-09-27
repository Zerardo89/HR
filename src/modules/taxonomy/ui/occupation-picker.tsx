"use client";

import { useTranslations } from "next-intl";
import { useId, useMemo, useState } from "react";
import { prepareCatalog, searchOccupations, type CatalogEntry } from "../domain";

/**
 * Scelta della mansione (WP-006/013): casella con suggerimenti secondo il modello "combobox" delle linee guida
 * WAI-ARIA. La ricerca gira nel browser (niente chiamate al server a ogni tasto) e capisce sinonimi,
 * femminili ed errori di battitura. Il valore inviato col form è l'id della mansione (campo nascosto `name`).
 */
export function OccupationPicker({
  entries,
  name,
  defaultId,
  label,
  required = true,
}: {
  entries: CatalogEntry[];
  name: string;
  defaultId?: number;
  /** Etichetta diversa da "Mansione" (es. più mansioni nello stesso form). */
  label?: string;
  required?: boolean;
}) {
  const t = useTranslations("occupationPicker");
  const labelText = label ?? t("label");
  const catalog = useMemo(() => prepareCatalog(entries), [entries]);
  const initial = entries.find((e) => e.id === defaultId);
  const [selected, setSelected] = useState<CatalogEntry | undefined>(initial);
  const [query, setQuery] = useState(initial?.labelIt ?? "");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const inputId = useId();
  const listId = useId();
  const helpId = useId();

  const hits = open && !selected ? searchOccupations(catalog, query) : [];
  const choose = (entry: CatalogEntry) => {
    setSelected(entry);
    setQuery(entry.labelIt);
    setOpen(false);
  };

  return (
    <div className="relative flex flex-col gap-2">
      <label htmlFor={inputId} className="text-base font-medium">
        {labelText}
      </label>
      <input
        id={inputId}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={hits.length > 0}
        aria-controls={listId}
        aria-activedescendant={hits.length > 0 ? `${listId}-${active}` : undefined}
        aria-describedby={helpId}
        autoComplete="off"
        required={required}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setSelected(undefined);
          setOpen(true);
          setActive(0);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" && hits.length > 0) {
            e.preventDefault();
            setActive((a) => (a + 1) % hits.length);
          } else if (e.key === "ArrowUp" && hits.length > 0) {
            e.preventDefault();
            setActive((a) => (a - 1 + hits.length) % hits.length);
          } else if (e.key === "Enter" && hits[active]) {
            e.preventDefault();
            choose(hits[active].entry);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        className="w-full rounded-lg border border-border bg-surface px-3 py-3 text-lg text-foreground"
      />
      <span id={helpId} className="text-sm text-muted">
        {selected ? t("selected", { label: selected.labelIt }) : t("help")}
      </span>
      <input type="hidden" name={name} value={selected?.id ?? ""} />
      {hits.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          aria-label={labelText}
          className="absolute top-full z-10 mt-1 max-h-72 w-full overflow-auto rounded-lg border border-border bg-surface shadow-lg"
        >
          {hits.map((hit, i) => (
            <li
              key={hit.entry.id}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => {
                e.preventDefault(); // evita di perdere il focus prima della scelta
                choose(hit.entry);
              }}
              className={`cursor-pointer px-3 py-3 ${i === active ? "bg-primary text-primary-foreground" : ""}`}
            >
              {hit.entry.labelIt}
              {hit.matchedSynonym && (
                <span className="text-sm opacity-80">
                  {" "}
                  — {t("synonym", { term: hit.matchedSynonym })}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
