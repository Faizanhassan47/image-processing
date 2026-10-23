import { useEffect, useMemo, useState } from "react";
import {
  Eye,
  FileImage,
  Search,
  SlidersHorizontal,
  Trash2,
  X,
} from "lucide-react";
import { Link } from "react-router-dom";
import { caseService } from "../../services/caseService";
import { platformService } from "../../services/platformService";
import Modal from "../../components/Modal/Modal";
import "./SlideLibrary.css";

const slideStatus = (caseItem) =>
  caseItem.status === "Reviewed"
    ? "Reviewed"
    : caseItem.status === "In Review"
      ? "In review"
      : "Awaiting review";

function formatFileSize(bytes) {
  if (bytes === null || bytes === undefined || bytes === "")
    return "Not recorded";
  const value = Number(bytes);
  if (!Number.isFinite(value)) return "Not recorded";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(
    Math.floor(Math.log(Math.max(value, 1)) / Math.log(1024)),
    units.length - 1,
  );
  return `${(value / 1024 ** index).toFixed(index > 1 ? 1 : 0)} ${units[index]}`;
}

function formatDate(value) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(date);
}

export default function SlideLibrary() {
  const [cases, setCases] = useState([]);
  const [query, setQuery] = useState("");
  const [format, setFormat] = useState("All");
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState("");
  const [removing, setRemoving] = useState(false);
  const [slidePendingRemoval, setSlidePendingRemoval] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    caseService
      .list(controller.signal)
      .then((items) => setCases(Array.isArray(items) ? items : []))
      .catch((err) => err.name !== "AbortError" && setError(err.message));
    return () => controller.abort();
  }, []);

  const slides = useMemo(
    () =>
      cases.flatMap((caseItem) =>
        (caseItem.slides || []).map((slide) => ({
          ...slide,
          image_url: slide.thumbnail_url || slide.image_url,
          caseId: caseItem.id,
          caseLabel: caseItem.case_id,
          caseDescription: caseItem.description,
          status: slideStatus(caseItem),
        })),
      ),
    [cases],
  );
  const filtered = slides.filter((slide) => {
    const text =
      `${slide.label || ""} ${slide.caseLabel || ""} ${slide.stain || ""} ${slide.specimen_description || ""}`.toLowerCase();
    return (
      (!query || text.includes(query.toLowerCase())) &&
      (format === "All" || slide.file_type === format)
    );
  });
  const active = selected || filtered[0] || null;
  const removeSlide = async () => {
    const target = slidePendingRemoval;
    if (!target || removing) return;
    if (
      false &&
      !window.confirm(
        `Remove slide “${active.label || active.id}”? This cannot be undone.`,
      )
    )
      return;
    setRemoving(true);
    setError("");
    try {
      await platformService.deleteSlide(target.id);
      setCases((current) =>
        current.map((caseItem) =>
          caseItem.id === target.caseId
            ? {
                ...caseItem,
                slides: (caseItem.slides || []).filter(
                  (slide) => slide.id !== target.id,
                ),
                slide_count: Math.max(0, (caseItem.slide_count || 1) - 1),
              }
            : caseItem,
        ),
      );
      setSelected(null);
      setSlidePendingRemoval(null);
    } catch (err) {
      setError(err.message || "Unable to remove slide.");
    } finally {
      setRemoving(false);
    }
  };

  return (
    <main className="slide-library" id="main-content">
      <header className="slide-library__header">
        <div>
          <p className="page-eyebrow">Digital pathology</p>
          <h1>Slide Library</h1>
          <p>
            Browse stored whole-slide and image files, inspect metadata, and
            open a slide in the existing clinical viewer.
          </p>
        </div>
      </header>
      <section
        className="slide-library__filters"
        aria-label="Slide library filters"
      >
        <label className="slide-library__search">
          <Search size={17} />
          <span className="sr-only">Search slides</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search slide ID, case ID, stain, or specimen"
          />
        </label>
        <label>
          <SlidersHorizontal size={15} />
          <span className="sr-only">File format</span>
          <select
            value={format}
            onChange={(event) => setFormat(event.target.value)}
          >
            <option value="All">All formats</option>
            <option value="wsi">Whole-slide image</option>
            <option value="raster">Image</option>
          </select>
        </label>
      </section>
      {error && (
        <p className="slide-library__error">Unable to load slides: {error}</p>
      )}
      <div className="slide-library__layout">
        <section>
          <p className="slide-library__count">
            {filtered.length} slide{filtered.length === 1 ? "" : "s"}
          </p>
          <div className="slide-library__grid">
            {filtered.map((slide) => (
              <button
                type="button"
                onClick={() => setSelected(slide)}
                className={`slide-card${active?.id === slide.id ? " slide-card--selected" : ""}`}
                key={slide.id}
              >
                <div className="slide-card__image">
                  {slide.image_url ? (
                    <img src={slide.image_url} alt="" />
                  ) : (
                    <FileImage size={26} />
                  )}
                  <span>{slide.status}</span>
                </div>
                <strong>{slide.label || `Slide ${slide.id}`}</strong>
                <small>Case: {slide.caseLabel}</small>
                <p>
                  {slide.specimen_description ||
                    "Specimen details not recorded"}
                </p>
                <footer>
                  {slide.file_type?.toUpperCase() || "Image"} <span>·</span>{" "}
                  {slide.stain || "Stain not recorded"}
                </footer>
              </button>
            ))}
            {!filtered.length && (
              <div className="slide-library__empty">
                <FileImage size={25} />
                <strong>No slides found</strong>
                <span>Adjust the search or add a slide through a case.</span>
              </div>
            )}
          </div>
        </section>
        <aside className="slide-details">
          {active ? (
            <>
              <button
                className="slide-details__close"
                onClick={() => setSelected(null)}
                aria-label="Clear selected slide"
              >
                <X size={16} />
              </button>
              <div className="slide-details__image">
                {active.image_url ? (
                  <img
                    src={active.image_url}
                    alt={`Preview of ${active.label || "slide"}`}
                  />
                ) : (
                  <FileImage size={32} />
                )}
              </div>
              <div className="slide-details__title">
                <h2>{active.label || `Slide ${active.id}`}</h2>
                <span className="slide-details__status">{active.status}</span>
              </div>
              <Link
                to={`/cases?case=${active.caseId}&slide=${active.id}`}
                className="btn-primary route-link"
              >
                <Eye size={16} />
                Open in viewer
              </Link>
              <button
                type="button"
                className="slide-details__remove"
                onClick={() => setSlidePendingRemoval(active)}
                disabled={removing}
              >
                <Trash2 size={15} />
                {removing ? "Removing…" : "Remove slide"}
              </button>
              <section
                className="slide-details__metadata"
                aria-labelledby="slide-metadata-title"
              >
                <h3 id="slide-metadata-title">Metadata</h3>
                <dl>
                  <div>
                    <dt>Slide ID</dt>
                    <dd>{active.id}</dd>
                  </div>
                  <div>
                    <dt>Case ID</dt>
                    <dd>
                      <Link to={`/cases?case=${active.caseId}`}>
                        {active.caseLabel}
                      </Link>
                    </dd>
                  </div>
                  <div>
                    <dt>File name</dt>
                    <dd>{active.filename || "Not recorded"}</dd>
                  </div>
                  <div>
                    <dt>File format</dt>
                    <dd>
                      {active.format ||
                        active.file_type?.toUpperCase() ||
                        "Not recorded"}
                    </dd>
                  </div>
                  <div>
                    <dt>File size</dt>
                    <dd>{formatFileSize(active.file_size)}</dd>
                  </div>
                  <div>
                    <dt>Dimensions</dt>
                    <dd>
                      {active.width && active.height
                        ? `${Number(active.width).toLocaleString()} × ${Number(active.height).toLocaleString()} pixels`
                        : "Not recorded"}
                    </dd>
                  </div>
                  <div>
                    <dt>Image levels</dt>
                    <dd>{active.level_count || "Not recorded"}</dd>
                  </div>
                  <div>
                    <dt>Stain</dt>
                    <dd>{active.stain || "Not recorded"}</dd>
                  </div>
                  <div>
                    <dt>Specimen type</dt>
                    <dd>
                      {active.specimen_description ||
                        active.caseDescription ||
                        "Not recorded"}
                    </dd>
                  </div>
                  <div>
                    <dt>Upload date</dt>
                    <dd>{formatDate(active.created_at)}</dd>
                  </div>
                  <div>
                    <dt>Processing status</dt>
                    <dd>
                      <span
                        className={`slide-details__processing slide-details__processing--${active.upload_state || "unknown"}`}
                      >
                        {active.upload_state || "Not recorded"}
                      </span>
                    </dd>
                  </div>
                </dl>
              </section>
            </>
          ) : (
            <div className="slide-details__empty">
              <FileImage size={28} />
              <p>Select a slide to view its metadata.</p>
            </div>
          )}
        </aside>
      </div>
      <Modal
        open={Boolean(slidePendingRemoval)}
        title="Remove slide"
        onClose={() => !removing && setSlidePendingRemoval(null)}
        footer={
          <>
            <button
              type="button"
              className="modal-button modal-button--secondary"
              disabled={removing}
              onClick={() => setSlidePendingRemoval(null)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="modal-button btn-delete"
              disabled={removing}
              onClick={removeSlide}
            >
              {removing ? "Removing…" : "Remove slide"}
            </button>
          </>
        }
      >
        <p className="confirmation-copy">
          Remove{" "}
          <strong>
            {slidePendingRemoval?.label ||
              `Slide ${slidePendingRemoval?.id || ""}`}
          </strong>
          ? This removes its annotations and analysis records. The source file
          is moved to protected deleted storage.
        </p>
      </Modal>
    </main>
  );
}
