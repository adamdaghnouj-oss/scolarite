import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/axios";
import { useAuth } from "../auth/useAuth";
import { useLanguage } from "../i18n/LanguageContext";
import "./StudentEventsPage.css";

const EVENT_TYPE_OPTIONS = [
  "Academic",
  "Workshop",
  "Club",
  "Competition",
  "Conference",
  "Other",
];

function toIso(dateValue, timeValue) {
  if (!dateValue) return "";
  const safeTime = timeValue || "12:00";
  const parsed = new Date(`${dateValue}T${safeTime}:00`);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString();
}

function formatEventDate(isoValue) {
  if (!isoValue) return "No date";
  try {
    const date = new Date(isoValue);
    return new Intl.DateTimeFormat(undefined, {
      weekday: "short",
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  } catch {
    return "No date";
  }
}

export default function StudentEventsPage() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const auth = useAuth();
  const appRole = auth.role;
  const myUserId = auth.user?.id ? Number(auth.user.id) : null;

  const [events, setEvents] = useState([]);
  const [activeSlide, setActiveSlide] = useState(0);
  const [form, setForm] = useState({
    type: EVENT_TYPE_OPTIONS[0],
    title: "",
    description: "",
    place: "",
    date: "",
    time: "",
    image: null,
    imagePreviewUrl: "",
    imageName: "",
  });
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function loadEvents() {
    setLoading(true);
    setError("");
    try {
      const res = await api.get("/events");
      setEvents(Array.isArray(res.data) ? res.data : []);
    } catch {
      setEvents([]);
      setError("Failed to load events. Please refresh.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadEvents();
  }, []);

  const sortedEvents = useMemo(
    () => [...events].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [events]
  );
  const currentEvent = sortedEvents[activeSlide] || null;

  useEffect(() => {
    if (activeSlide >= sortedEvents.length && sortedEvents.length > 0) {
      setActiveSlide(0);
    }
  }, [activeSlide, sortedEvents.length]);

  useEffect(() => {
    if (sortedEvents.length <= 1) return undefined;
    const id = setInterval(() => {
      setActiveSlide((prev) => ((prev + 1) % sortedEvents.length));
    }, 10000);
    return () => clearInterval(id);
  }, [sortedEvents.length]);

  async function handleLogout() {
    await auth.logout();
    navigate("/login");
  }

  function updateField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleImagePick(file) {
    if (!file) {
      updateField("image", null);
      updateField("imagePreviewUrl", "");
      updateField("imageName", "");
      return;
    }
    const nextUrl = URL.createObjectURL(file);
    if (form.imagePreviewUrl?.startsWith?.("blob:")) {
      URL.revokeObjectURL(form.imagePreviewUrl);
    }
    setForm((prev) => ({
      ...prev,
      image: file,
      imagePreviewUrl: nextUrl,
      imageName: file.name || "",
    }));
  }

  function resetForm() {
    if (form.imagePreviewUrl?.startsWith?.("blob:")) {
      URL.revokeObjectURL(form.imagePreviewUrl);
    }
    setForm({
      type: EVENT_TYPE_OPTIONS[0],
      title: "",
      description: "",
      place: "",
      date: "",
      time: "",
      image: null,
      imagePreviewUrl: "",
      imageName: "",
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSuccess("");

    const title = form.title.trim();
    const description = form.description.trim();
    const place = form.place.trim();
    if (!title) {
      setError("Please enter the event name.");
      return;
    }
    if (!description) {
      setError("Please enter a description.");
      return;
    }

    const eventDate = toIso(form.date, form.time);
    try {
      const fd = new FormData();
      fd.append("event_type", form.type);
      fd.append("title", title);
      fd.append("description", description);
      if (place) fd.append("place", place);
      if (eventDate) fd.append("event_at", eventDate);
      if (form.image) fd.append("image", form.image);

      const res = editingEvent
        ? (() => {
          fd.append("_method", "PUT");
          return api.post(`/events/${editingEvent.id}`, fd, {
            headers: { "Content-Type": "multipart/form-data" },
          });
        })()
        : await api.post("/events", fd, {
          headers: { "Content-Type": "multipart/form-data" },
        });

      if (editingEvent) {
        setEvents((prev) => prev.map((item) => (item.id === editingEvent.id ? res.data : item)));
        setSuccess("Event updated successfully.");
      } else {
        setEvents((prev) => [res.data, ...prev]);
        setSuccess("Event saved successfully.");
      }
      resetForm();
      setEditingEvent(null);
      setIsFormOpen(false);
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to save event.");
    }
  }

  function startEdit(eventItem) {
    const canEdit = myUserId != null && Number(eventItem?.author?.user_id) === Number(myUserId);
    if (!canEdit) return;

    let nextDate = "";
    let nextTime = "";
    if (eventItem?.event_at) {
      const d = new Date(eventItem.event_at);
      if (!Number.isNaN(d.getTime())) {
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        const dd = String(d.getDate()).padStart(2, "0");
        const hh = String(d.getHours()).padStart(2, "0");
        const min = String(d.getMinutes()).padStart(2, "0");
        nextDate = `${yyyy}-${mm}-${dd}`;
        nextTime = `${hh}:${min}`;
      }
    }

    setEditingEvent(eventItem);
    setForm({
      type: eventItem?.event_type || EVENT_TYPE_OPTIONS[0],
      title: eventItem?.title || "",
      description: eventItem?.description || "",
      place: eventItem?.place || "",
      date: nextDate,
      time: nextTime,
      image: null,
      imagePreviewUrl: "",
      imageName: "",
    });
    setError("");
    setSuccess("");
    setIsFormOpen(true);
  }

  async function handleDelete(eventId) {
    try {
      await api.delete(`/events/${eventId}`);
      setEvents((prev) => prev.filter((item) => item.id !== eventId));
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to delete event.");
    }
  }

  function closeFormModal() {
    resetForm();
    setEditingEvent(null);
    setIsFormOpen(false);
  }

  function goPrevSlide() {
    if (sortedEvents.length <= 1) return;
    setActiveSlide((prev) => (prev - 1 + sortedEvents.length) % sortedEvents.length);
  }

  function goNextSlide() {
    if (sortedEvents.length <= 1) return;
    setActiveSlide((prev) => (prev + 1) % sortedEvents.length);
  }

  return (
    <div className="sep-wrap">
      <header className="sep-topnav">
        <div className="sep-topnav-inner">
          <div className="sep-brand">Scolarite</div>
          <nav className="sep-links">
            <Link to={appRole === "professeur" ? "/professeur" : "/"}>{t("navHome")}</Link>
            <Link to="/student/posts">Post</Link>
            <Link to="/student/events" className="is-active">Events</Link>
            <Link to="/profile">{t("profile")}</Link>
          </nav>
          <button type="button" className="sep-logout-btn" onClick={handleLogout}>
            {t("logout")}
          </button>
        </div>
      </header>

      <main className="sep-main">
        <section className="sep-intro">
          <p className="sep-kicker">Student events</p>
          <h1>Create and publish your events</h1>
          <p>
            White clean design inspired by your reference layout.
            Add event details and click save to instantly show it below.
          </p>
          <div className="sep-intro-actions">
            <button type="button" className="sep-btn sep-btn-primary" onClick={() => { setError(""); setSuccess(""); setEditingEvent(null); setIsFormOpen(true); }}>
              Add new event
            </button>
          </div>
        </section>

        <section className="sep-content-grid">
          <section className="sep-card sep-card-preview">
            <div className="sep-preview-head">
              <h2>Events slider</h2>
            </div>
            {currentEvent ? (
              <article className="sep-event-featured">
                {sortedEvents.length > 1 ? (
                  <>
                    <button
                      type="button"
                      className="sep-slider-btn sep-slider-btn--overlay sep-slider-btn--left"
                      onClick={goPrevSlide}
                      aria-label="Previous event"
                    >
                      ‹
                    </button>
                    <button
                      type="button"
                      className="sep-slider-btn sep-slider-btn--overlay sep-slider-btn--right"
                      onClick={goNextSlide}
                      aria-label="Next event"
                    >
                      ›
                    </button>
                  </>
                ) : null}
                {currentEvent.image_url ? (
                  <img
                    src={currentEvent.image_url}
                    alt={currentEvent.title}
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
                  />
                ) : (
                  <div className="sep-placeholder">No image</div>
                )}
                <div className="sep-event-overlay">
                  <span>{currentEvent.event_type || "Event"}</span>
                  <h3>{currentEvent.title}</h3>
                  <p>{currentEvent.description}</p>
                </div>
              </article>
            ) : (
              <div className="sep-empty">{loading ? "Loading..." : "Your first saved event will appear here."}</div>
            )}
            {sortedEvents.length > 1 ? (
              <div className="sep-slider-dots">
                {sortedEvents.map((item, idx) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`sep-dot ${idx === activeSlide ? "is-active" : ""}`}
                    onClick={() => setActiveSlide(idx)}
                    aria-label={`Go to event ${idx + 1}`}
                  />
                ))}
              </div>
            ) : null}
          </section>
        </section>

        <section className="sep-list">
          <div className="sep-list-head">
            <h2>Saved events</h2>
            <span>{sortedEvents.length} total</span>
          </div>
          {loading ? (
            <div className="sep-empty">Loading events...</div>
          ) : sortedEvents.length === 0 ? (
            <div className="sep-empty">No events yet. Create one using the form.</div>
          ) : (
            <div className="sep-grid">
              {sortedEvents.map((eventItem) => (
                <article key={eventItem.id} className="sep-event-card">
                  {eventItem.image_url ? (
                    <img
                      src={eventItem.image_url}
                      alt={eventItem.title}
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                      }}
                    />
                  ) : (
                    <div className="sep-placeholder">No image</div>
                  )}
                  <div className="sep-event-content">
                    <div className="sep-chip">{eventItem.event_type || "Event"}</div>
                    <h3>{eventItem.title}</h3>
                    <p>{eventItem.description}</p>
                    <div className="sep-meta">
                      <span>{formatEventDate(eventItem.event_at)}</span>
                      <span>{eventItem.place || "Campus"}</span>
                    </div>
                    {myUserId != null && Number(eventItem?.author?.user_id) === Number(myUserId) ? (
                      <div className="sep-owner-actions">
                        <button type="button" className="sep-edit" onClick={() => startEdit(eventItem)}>
                          Edit
                        </button>
                        <button type="button" className="sep-delete" onClick={() => handleDelete(eventItem.id)}>
                          Delete
                        </button>
                      </div>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>
      {isFormOpen ? (
        <div className="sep-modal-backdrop" onClick={closeFormModal}>
          <article className="sep-card sep-card-form sep-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="sep-modal-head">
              <h2>{editingEvent ? "Edit event" : "Add new event"}</h2>
              <button type="button" className="sep-modal-close" onClick={closeFormModal}>✕</button>
            </div>
            <form className="sep-form" onSubmit={handleSubmit}>
              <label htmlFor="sep-type">Event type</label>
              <select
                id="sep-type"
                value={form.type}
                onChange={(e) => updateField("type", e.target.value)}
              >
                {EVENT_TYPE_OPTIONS.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>

              <label htmlFor="sep-title">Event name</label>
              <input
                id="sep-title"
                type="text"
                value={form.title}
                onChange={(e) => updateField("title", e.target.value)}
                placeholder="Ex: Web Design Meetup"
              />

              <label htmlFor="sep-description">Description</label>
              <textarea
                id="sep-description"
                rows={4}
                value={form.description}
                onChange={(e) => updateField("description", e.target.value)}
                placeholder="Write a short description..."
              />

              <div className="sep-row">
                <div>
                  <label htmlFor="sep-date">Date</label>
                  <input
                    id="sep-date"
                    type="date"
                    value={form.date}
                    onChange={(e) => updateField("date", e.target.value)}
                  />
                </div>
                <div>
                  <label htmlFor="sep-time">Time</label>
                  <input
                    id="sep-time"
                    type="time"
                    value={form.time}
                    onChange={(e) => updateField("time", e.target.value)}
                  />
                </div>
              </div>

              <label htmlFor="sep-place">Place</label>
              <input
                id="sep-place"
                type="text"
                value={form.place}
                onChange={(e) => updateField("place", e.target.value)}
                placeholder="Ex: Room A12"
              />

              <label htmlFor="sep-image">Image or GIF</label>
              <input
                id="sep-image"
                type="file"
                accept="image/*,.gif"
                onChange={(e) => handleImagePick(e.target.files?.[0] || null)}
              />
              {form.imageName ? (
                <p className="sep-file">{form.imageName}</p>
              ) : (
                <p className="sep-file">You can upload JPG, PNG, WEBP, or GIF.</p>
              )}

              {error ? <p className="sep-error">{error}</p> : null}
              {success ? <p className="sep-success">{success}</p> : null}

              <div className="sep-actions">
                <button type="submit" className="sep-btn sep-btn-primary">{editingEvent ? "Save changes" : "Save event"}</button>
                <button type="button" className="sep-btn sep-btn-ghost" onClick={resetForm}>Reset</button>
              </div>
            </form>
          </article>
        </div>
      ) : null}
    </div>
  );
}
