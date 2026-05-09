import { useEffect } from "react";

/**
 * In-thread image viewer: dimmed overlay, contained preview, prev/next over all images in the thread.
 */
export default function MessageImageLightbox({
  images,
  activeIndex,
  onClose,
  onChangeIndex,
  labels = {},
}) {
  const len = images?.length ?? 0;
  const idx =
    activeIndex === null || len === 0 ? -1 : Math.min(Math.max(0, activeIndex), len - 1);

  useEffect(() => {
    if (idx < 0) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
      if (len <= 1) return;
      if (e.key === "ArrowLeft") onChangeIndex((idx + len - 1) % len);
      if (e.key === "ArrowRight") onChangeIndex((idx + 1) % len);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [idx, len, onClose, onChangeIndex]);

  if (idx < 0) return null;
  const url = images[idx]?.url;
  if (!url) return null;

  const closeLabel = labels.close ?? "Close";
  const prevLabel = labels.prev ?? "Previous image";
  const nextLabel = labels.next ?? "Next image";
  const downloadLabel = labels.download ?? "Download";
  const dialogLabel = labels.dialog ?? "Image viewer";

  return (
    <div className="sm-img-lightbox" role="dialog" aria-modal="true" aria-label={dialogLabel}>
      <button
        type="button"
        className="sm-img-lightbox-backdrop"
        aria-label={closeLabel}
        onClick={onClose}
      />
      <div className="sm-img-lightbox-content">
        <button type="button" className="sm-img-lightbox-close" onClick={onClose} aria-label={closeLabel}>
          ✕
        </button>
        {len > 1 ? (
          <>
            <button
              type="button"
              className="sm-img-lightbox-nav sm-img-lightbox-nav--prev"
              onClick={() => onChangeIndex((idx + len - 1) % len)}
              aria-label={prevLabel}
            >
              ‹
            </button>
            <button
              type="button"
              className="sm-img-lightbox-nav sm-img-lightbox-nav--next"
              onClick={() => onChangeIndex((idx + 1) % len)}
              aria-label={nextLabel}
            >
              ›
            </button>
          </>
        ) : null}
        <div className="sm-img-lightbox-slide">
          <img src={url} alt="" decoding="async" />
        </div>
        <div className="sm-img-lightbox-footer">
          <span className="sm-img-lightbox-counter">
            {idx + 1} / {len}
          </span>
          <a
            className="sm-img-lightbox-download"
            href={url}
            target="_blank"
            rel="noreferrer"
          >
            {downloadLabel}
          </a>
        </div>
      </div>
    </div>
  );
}
