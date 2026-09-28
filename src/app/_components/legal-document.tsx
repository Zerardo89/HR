import Link from "next/link";
import { parseMarkdownLite, type Inline } from "@/lib/markdown-lite";

/** Testo legale in Markdown ridotto (WP-024b): solo componenti React, nessun HTML dal testo. */
export function LegalDocument({ source }: { source: string }) {
  return (
    <div className="flex flex-col gap-4">
      {parseMarkdownLite(source).map((block, n) => {
        if (block.kind === "heading") {
          return (
            <h2 key={n} id={block.id} className="mt-4 scroll-mt-4 text-2xl font-semibold">
              {block.text}
            </h2>
          );
        }
        if (block.kind === "list") {
          return (
            <ul key={n} className="flex list-disc flex-col gap-2 pl-6">
              {block.items.map((item, i) => (
                <li key={i}>
                  <InlineText content={item} />
                </li>
              ))}
            </ul>
          );
        }
        return (
          <p key={n}>
            <InlineText content={block.content} />
          </p>
        );
      })}
    </div>
  );
}

function InlineText({ content }: { content: Inline[] }) {
  return content.map((part, i) => {
    if (part.kind === "strong") return <strong key={i}>{part.text}</strong>;
    if (part.kind === "link") {
      return (
        <Link key={i} href={part.href} className="text-primary underline underline-offset-4">
          {part.text}
        </Link>
      );
    }
    return <span key={i}>{part.text}</span>;
  });
}
