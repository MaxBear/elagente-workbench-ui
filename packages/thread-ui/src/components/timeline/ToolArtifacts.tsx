import { FileText } from "lucide-react";
import type { ThreadTimelineAdapter, ThreadToolArtifact } from "../../adapters";
import { translate, useI18n } from "../../i18n";
import { ZoomableImage } from "../ZoomableImage";

// Raster images and SVG (an <img> never runs SVG scripts) are shown inline.
const INLINE_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/gif", "image/webp", "image/svg+xml"]);

/** Only same-origin or https addresses the host serves; inline data (base64)
    and cross-origin plain http are never put in the DOM. */
export function safeArtifactUrl(url: string | undefined) {
  if (!url || typeof window === "undefined") return null;
  try {
    const parsed = new URL(url, window.location.href);
    // An opaque origin ("null", e.g. file: or sandboxed pages) matches itself: require http(s).
    const web = parsed.protocol === "https:" || parsed.protocol === "http:";
    return web && (parsed.protocol === "https:" || parsed.origin === window.location.origin) ? parsed.href : null;
  } catch {
    return null;
  }
}

export function isInlineToolImage(artifact: ThreadToolArtifact) {
  return Boolean(safeArtifactUrl(artifact.url) && artifact.mediaType && INLINE_IMAGE_TYPES.has(artifact.mediaType.toLowerCase()));
}

/** Splits a tool's artifact ids into those the host resolved and those it did not. */
export function resolveToolArtifacts(ids: string[], adapter?: ThreadTimelineAdapter) {
  const resolved: ThreadToolArtifact[] = [];
  const unresolved: string[] = [];
  for (const id of ids) {
    const artifact = adapter?.resolveArtifact?.(id) ?? null;
    if (artifact) resolved.push(artifact); else unresolved.push(id);
  }
  return { resolved, unresolved };
}

/** The resolved artifacts a tool reported: images as thumbnails that open full
    size, other files as links with their name and type. */
export function ToolArtifacts({ artifacts }: { artifacts: ThreadToolArtifact[] }) {
  useI18n();
  const images = artifacts.filter(isInlineToolImage);
  const files = artifacts.filter((artifact) => !isInlineToolImage(artifact));
  if (!artifacts.length) return null;
  return (
    <section className="thread-graph-tool-artifacts" aria-label={translate("chat.toolArtifacts")}>
      {images.length ? (
        <div className="thread-graph-tool-artifact-images">
          {images.map((artifact) => (
            <figure key={artifact.id} data-artifact-id={artifact.id}>
              <ZoomableImage src={safeArtifactUrl(artifact.url)!} alt={artifact.name} loading="lazy" />
              <figcaption>{artifact.name}</figcaption>
            </figure>
          ))}
        </div>
      ) : null}
      {files.length ? (
        <ul className="thread-graph-tool-artifact-files">
          {files.map((artifact) => {
            const url = safeArtifactUrl(artifact.url);
            const type = artifact.mediaType ?? artifact.kind;
            return (
              <li key={artifact.id} data-artifact-id={artifact.id}>
                <FileText aria-hidden="true" size={13} />
                {url ? <a href={url} target="_blank" rel="noreferrer">{artifact.name}</a> : <span>{artifact.name}</span>}
                {type ? <span className="thread-graph-tool-artifact-type">{type}</span> : null}
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}
