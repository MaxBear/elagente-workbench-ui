import { FileText } from "lucide-react";
import type { ThreadTimelineAdapter, ThreadToolArtifact } from "../../adapters";
import { ZoomableImage } from "../ZoomableImage";

// Raster images and SVG (an <img> never runs SVG scripts) are shown inline.
const INLINE_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/gif", "image/webp", "image/svg+xml"]);

/** Only addresses the host serves; inline data (base64) is never put in the DOM. */
function safeUrl(url: string | undefined) {
  if (!url) return null;
  try {
    const parsed = new URL(url, typeof window === "undefined" ? "http://localhost" : window.location.href);
    return ["http:", "https:"].includes(parsed.protocol) ? url : null;
  } catch {
    return null;
  }
}

export function isInlineToolImage(artifact: ThreadToolArtifact) {
  return Boolean(safeUrl(artifact.url) && artifact.mediaType && INLINE_IMAGE_TYPES.has(artifact.mediaType.toLowerCase()));
}

/** The artifacts a tool reported: images as thumbnails that open full size,
    other files as links with their name and type, unknown ids as text. */
export function ToolArtifacts({ ids, adapter }: { ids: string[]; adapter?: ThreadTimelineAdapter | undefined }) {
  const resolved = ids.map((id) => ({ id, artifact: adapter?.resolveArtifact?.(id) ?? null }));
  const images = resolved.flatMap(({ artifact }) => (artifact && isInlineToolImage(artifact) ? [artifact] : []));
  const files = resolved.filter(({ artifact }) => !artifact || !isInlineToolImage(artifact));
  return (
    <section className="thread-graph-tool-artifacts" aria-label="Tool artifacts">
      {images.length ? (
        <div className="thread-graph-tool-artifact-images">
          {images.map((artifact) => (
            <figure key={artifact.id} data-artifact-id={artifact.id}>
              <ZoomableImage src={safeUrl(artifact.url)!} alt={artifact.name} loading="lazy" />
              <figcaption>{artifact.name}</figcaption>
            </figure>
          ))}
        </div>
      ) : null}
      {files.length ? (
        <ul className="thread-graph-tool-artifact-files">
          {files.map(({ id, artifact }) => {
            const url = artifact ? safeUrl(artifact.url) : null;
            const type = artifact?.mediaType ?? artifact?.kind;
            return (
              <li key={id} data-artifact-id={id}>
                <FileText aria-hidden="true" size={13} />
                {artifact && url ? (
                  <a href={url} target="_blank" rel="noreferrer">{artifact.name}</a>
                ) : (
                  <span>{artifact?.name ?? id}</span>
                )}
                {type ? <span className="thread-graph-tool-artifact-type">{type}</span> : null}
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}
