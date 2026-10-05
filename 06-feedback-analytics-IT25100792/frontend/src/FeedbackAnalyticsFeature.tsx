import { useEffect, useMemo, useState } from "react";
import { BarChart3, Download, Pencil, Star, Trash2 } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type Appointment = {
  id: string;
  patientId: string;
  patientName: string;
  practitionerId: string;
  practitionerName: string;
  serviceType: string;
  status: string;
};
type FeedbackEntry = {
  id: string;
  patientId: string;
  practitionerId: string;
  appointmentId: string;
  rating: number;
  comments?: string;
  createdAt?: string;
};
type FeedbackResult = {
  feedback: FeedbackEntry;
  complaint?: { id: string; priority: string; status: string } | null;
};
type Complaint = { id: string; feedbackId: string; priority: string; status: string; createdAt?: string };
type ReportSummary = {
  from: string; to: string; users: number; appointments: number; completedPayments: number;
  openAlerts: number; publishedPlans: number; feedback: number; averageRating: number;
};

export function FeedbackAnalyticsFeature({
  patientOnly = false,
  role = "PATIENT",
  currentUserId,
  loadAppointments,
  loadFeedback,
  loadPractitionerFeedback,
  loadAllFeedback,
  submitFeedback,
  updateFeedback,
  deleteFeedback,
  loadComplaints,
  loadReport,
}: {
  patientOnly?: boolean;
  role?: string;
  currentUserId: string;
  loadAppointments: () => Promise<Appointment[]>;
  loadFeedback: (patientId: string) => Promise<FeedbackEntry[]>;
  loadPractitionerFeedback?: (practitionerId: string) => Promise<FeedbackEntry[]>;
  loadAllFeedback?: () => Promise<FeedbackEntry[]>;
  submitFeedback: (details: {
    patientId: string; practitionerId: string; appointmentId: string; rating: number; comments?: string;
  }) => Promise<FeedbackResult>;
  updateFeedback: (id: string, details: { rating: number; comments?: string }) => Promise<FeedbackResult>;
  deleteFeedback: (id: string) => Promise<void>;
  loadComplaints: () => Promise<Complaint[]>;
  loadReport: (from: string, to: string) => Promise<ReportSummary>;
}) {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [myFeedback, setMyFeedback] = useState<FeedbackEntry[]>([]);
  const [receivedFeedback, setReceivedFeedback] = useState<FeedbackEntry[]>([]);
  const [appointmentId, setAppointmentId] = useState("");
  const [practitionerId, setPractitionerId] = useState("");
  const [rating, setRating] = useState(5);
  const [comments, setComments] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saved, setSaved] = useState("");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ appointment?: string; rating?: string; comments?: string }>({});
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [summary, setSummary] = useState<ReportSummary | null>(null);

  const COMMENT_MAX = 1500;
  const COMMENT_MIN_LOW = 10;

  const range = useMemo(() => {
    const to = new Date();
    const from = new Date();
    from.setMonth(from.getMonth() - 3);
    return {
      from: from.toISOString().slice(0, 10),
      to: to.toISOString().slice(0, 10),
    };
  }, []);

  function refreshFeedback() {
    if (patientOnly) {
      return loadFeedback(currentUserId)
        .then(setMyFeedback)
        .catch((reason) => setError(reason instanceof Error ? reason.message : "Feedback could not be loaded."));
    }
    if ((role === "DOCTOR" || role === "DIETITIAN") && loadPractitionerFeedback) {
      return loadPractitionerFeedback(currentUserId)
        .then(setReceivedFeedback)
        .catch((reason) => setError(reason instanceof Error ? reason.message : "Practitioner feedback could not be loaded."));
    }
    if (loadAllFeedback) {
      return loadAllFeedback()
        .then(setReceivedFeedback)
        .catch(() => {
          if (loadPractitionerFeedback) {
            return loadPractitionerFeedback(currentUserId).then(setReceivedFeedback).catch(() => undefined);
          }
        });
    }
    return Promise.resolve();
  }

  useEffect(() => {
    loadAppointments()
      .then((rows) => {
        const eligible = patientOnly
          ? rows.filter((row) => row.patientId === currentUserId)
          : rows;
        setAppointments(eligible);
        setAppointmentId((current) => current || eligible[0]?.id || "");
        if (!patientOnly) return;
        const first = eligible[0];
        if (first) setPractitionerId((current) => current || first.practitionerId);
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Appointments could not be loaded."));
  }, [currentUserId, loadAppointments, patientOnly]);

  useEffect(() => {
    refreshFeedback();
  }, [currentUserId, loadFeedback, loadPractitionerFeedback, loadAllFeedback, patientOnly, role]);

  useEffect(() => {
    if (patientOnly) return;
    Promise.all([loadComplaints(), loadReport(range.from, range.to)])
      .then(([complaintRows, report]) => {
        setComplaints(complaintRows);
        setSummary(report);
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Analytics could not be loaded."));
  }, [loadComplaints, loadReport, patientOnly, range.from, range.to]);

  useEffect(() => {
    const selected = appointments.find((row) => row.id === appointmentId);
    if (selected && !editingId) setPractitionerId(selected.practitionerId);
  }, [appointmentId, appointments, editingId]);

  function resetForm() {
    setEditingId(null);
    setRating(5);
    setComments("");
    setFieldErrors({});
    const first = appointments[0];
    setAppointmentId(first?.id || "");
    setPractitionerId(first?.practitionerId || "");
  }

  function startEdit(entry: FeedbackEntry) {
    setEditingId(entry.id);
    setAppointmentId(entry.appointmentId);
    setPractitionerId(entry.practitionerId);
    setRating(entry.rating);
    setComments(entry.comments || "");
    setSaved("");
    setError("");
    setFieldErrors({});
  }

  function validateForm() {
    const next: { appointment?: string; rating?: string; comments?: string } = {};
    const trimmed = comments.trim();

    if (!editingId && !appointmentId.trim()) {
      next.appointment = "Appointment cannot be empty.";
    } else if (!editingId && !practitionerId.trim()) {
      next.appointment = "Selected appointment is missing a practitioner.";
    }

    if (!Number.isFinite(rating) || !Number.isInteger(rating) || rating < 1 || rating > 5) {
      next.rating = "Rating must be a whole number from 1 to 5 (no negatives or zero).";
    }

    if (!trimmed) {
      next.comments = "Comments cannot be empty.";
    } else if (trimmed.length > COMMENT_MAX) {
      next.comments = `Comments must be at most ${COMMENT_MAX} characters.`;
    } else if (rating <= 2 && trimmed.length < COMMENT_MIN_LOW) {
      next.comments = `For 1–2 stars, write at least ${COMMENT_MIN_LOW} characters so the care team can follow up.`;
    }

    setFieldErrors(next);
    return Object.keys(next).length === 0 ? trimmed : null;
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setSaved("");
    const trimmed = validateForm();
    if (trimmed == null) return;
    try {
      if (editingId) {
        const result = await updateFeedback(editingId, {
          rating,
          comments: trimmed,
        });
        setSaved(
          result.complaint
            ? `Feedback updated. Complaint ${result.complaint.id} remains with patient relations.`
            : "Your feedback was updated.",
        );
      } else {
        const result = await submitFeedback({
          patientId: currentUserId,
          practitionerId,
          appointmentId,
          rating,
          comments: trimmed,
        });
        setSaved(
          result.complaint
            ? `Feedback saved and complaint ${result.complaint.id} was opened for the patient-relations team.`
            : "Thank you. Your feedback was saved to the database.",
        );
      }
      resetForm();
      await refreshFeedback();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Feedback could not be saved.");
    }
  }

  function onRatingChange(raw: string) {
    if (raw.trim() === "") {
      setRating(Number.NaN);
      setFieldErrors((current) => ({ ...current, rating: "Rating cannot be empty." }));
      return;
    }
    const value = Number(raw);
    if (!Number.isFinite(value) || value < 1 || value > 5 || !Number.isInteger(value)) {
      setRating(value);
      setFieldErrors((current) => ({
        ...current,
        rating: "Rating must be a whole number from 1 to 5 (no negatives or zero).",
      }));
      return;
    }
    setRating(value);
    setFieldErrors((current) => ({ ...current, rating: undefined }));
  }

  async function remove(id: string) {
    if (!window.confirm("Delete this feedback? This cannot be undone.")) return;
    setError("");
    setSaved("");
    try {
      await deleteFeedback(id);
      if (editingId === id) resetForm();
      setSaved("Feedback was deleted.");
      await refreshFeedback();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Feedback could not be deleted.");
    }
  }

  function exportCSV() {
    const header = "Metric,Value\n";
    const rows = summary
      ? [
          ["From", summary.from],
          ["To", summary.to],
          ["Users", summary.users],
          ["Appointments", summary.appointments],
          ["Completed payments", summary.completedPayments],
          ["Open alerts", summary.openAlerts],
          ["Published plans", summary.publishedPlans],
          ["Feedback responses", summary.feedback],
          ["Average rating", summary.averageRating],
        ]
      : [];
    const blob = new Blob([header + rows.map((row) => row.join(",")).join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "nutricare-summary.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const chartData = summary
    ? [
        { label: "Users", value: Number(summary.users) },
        { label: "Visits", value: Number(summary.appointments) },
        { label: "Paid", value: Number(summary.completedPayments) },
        { label: "Alerts", value: Number(summary.openAlerts) },
        { label: "Plans", value: Number(summary.publishedPlans) },
        { label: "Feedback", value: Number(summary.feedback) },
      ]
    : [];

  const appointmentLabel = (id: string) => {
    const match = appointments.find((row) => row.id === id);
    return match ? `${match.serviceType} · ${match.practitionerName}` : id.slice(0, 8);
  };

  const feedbackForm = patientOnly ? (
    <section className="panel">
      <div className="panel-title">
        <div>
          <span className="eyebrow">Post-consultation</span>
          <h2>{editingId ? "Edit feedback" : "Record feedback"}</h2>
        </div>
      </div>
      <form onSubmit={submit} noValidate>
        <div className="field">
          <label htmlFor="feedback-appointment">Appointment</label>
          <select
            id="feedback-appointment"
            value={appointmentId}
            onChange={(event) => {
              setAppointmentId(event.target.value);
              setFieldErrors((current) => ({
                ...current,
                appointment: event.target.value ? undefined : "Appointment cannot be empty.",
              }));
            }}
            required
            disabled={Boolean(editingId)}
            aria-invalid={Boolean(fieldErrors.appointment)}
          >
            <option value="">{appointments.length === 0 ? "No appointments available" : "Select an appointment"}</option>
            {appointments.map((item) => (
              <option key={item.id} value={item.id}>
                {item.serviceType} · {item.practitionerName} · {item.status}
              </option>
            ))}
          </select>
          {fieldErrors.appointment && <small className="form-error">{fieldErrors.appointment}</small>}
        </div>
        <div className="field">
          <label htmlFor="feedback-rating">Rating (1–5)</label>
          <div className="chip-row" style={{ margin: "8px 0 10px" }}>
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                type="button"
                aria-label={`${value} stars`}
                className={value <= rating ? "chip active" : "chip"}
                onClick={() => {
                  setRating(value);
                  setFieldErrors((current) => ({ ...current, rating: undefined }));
                }}
                key={value}
              >
                <Star size={14} fill={value <= rating ? "currentColor" : "none"} />
              </button>
            ))}
          </div>
          <input
            id="feedback-rating"
            type="number"
            inputMode="numeric"
            min={1}
            max={5}
            step={1}
            required
            value={Number.isFinite(rating) ? rating : ""}
            onChange={(event) => onRatingChange(event.target.value)}
            aria-invalid={Boolean(fieldErrors.rating)}
          />
          {fieldErrors.rating && <small className="form-error">{fieldErrors.rating}</small>}
        </div>
        <div className="field">
          <label htmlFor="feedback">Comments or complaint</label>
          <textarea
            id="feedback"
            rows={4}
            maxLength={COMMENT_MAX}
            minLength={rating <= 2 ? COMMENT_MIN_LOW : 1}
            value={comments}
            onChange={(event) => {
              setComments(event.target.value);
              const trimmed = event.target.value.trim();
              setFieldErrors((current) => ({
                ...current,
                comments: !trimmed
                  ? "Comments cannot be empty."
                  : trimmed.length > COMMENT_MAX
                    ? `Comments must be at most ${COMMENT_MAX} characters.`
                    : undefined,
              }));
            }}
            placeholder="Tell us about the consultation (required)"
            required
            aria-invalid={Boolean(fieldErrors.comments)}
          />
          <small>
            {comments.trim().length}/{COMMENT_MAX}
            {rating <= 2 ? ` · at least ${COMMENT_MIN_LOW} characters for low ratings` : " · required"}
          </small>
          {fieldErrors.comments && <small className="form-error">{fieldErrors.comments}</small>}
        </div>
        <div className="chip-row" style={{ marginTop: 12 }}>
          <button className="primary" type="submit" style={{ flex: 1 }}>
            {editingId ? "Save changes" : "Submit feedback"}
          </button>
          {editingId && (
            <button className="secondary" type="button" onClick={resetForm}>
              Cancel
            </button>
          )}
        </div>
      </form>
      {saved && <div className="success-note">{saved}</div>}
      {error && <div className="form-error">{error}</div>}
    </section>
  ) : null;

  if (patientOnly) {
    return (
      <div className="stack-xl">
        <div className="page-heading">
          <div>
            <span className="eyebrow">My experience</span>
            <h1>Feedback & support</h1>
            <p>Rate a consultation, then edit or delete your own responses anytime.</p>
          </div>
        </div>
        <div className="patient-feedback-layout">
          {feedbackForm}
          <section className="panel">
            <div className="panel-title">
              <div>
                <span className="eyebrow">Your privacy</span>
                <h2>Your feedback</h2>
              </div>
            </div>
            <div className="list">
              {myFeedback.length === 0 && (
                <div className="list-item">
                  <span className="grow">
                    <strong>No feedback yet</strong>
                    <small>Submit a rating after a consultation to see it listed here.</small>
                  </span>
                </div>
              )}
              {myFeedback.map((entry) => (
                <div className="list-item" key={entry.id}>
                  <span className="grow">
                    <strong>
                      {entry.rating}/5 · {appointmentLabel(entry.appointmentId)}
                    </strong>
                    <small>{entry.comments || "No written comments"}</small>
                  </span>
                  <button className="icon" type="button" aria-label="Edit feedback" onClick={() => startEdit(entry)}>
                    <Pencil size={16} />
                  </button>
                  <button className="icon" type="button" aria-label="Delete feedback" onClick={() => remove(entry.id)}>
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="stack-xl">
      <div className="page-heading">
        <div>
          <span className="eyebrow">Module 06 · IT25100792</span>
          <h1>Reports & feedback</h1>
          <p>Service quality, business performance and complaint follow-up.</p>
        </div>
        <button className="secondary" onClick={exportCSV} disabled={!summary}>
          <Download size={16} /> Export summary
        </button>
      </div>
      {error && <div className="form-error">{error}</div>}
      <section className="metric-row">
        <article className="metric">
          <span>Appointments</span>
          <strong>{summary?.appointments ?? "—"}</strong>
          <small>
            {range.from} → {range.to}
          </small>
        </article>
        <article className="metric">
          <span>Payments</span>
          <strong>{summary?.completedPayments ?? "—"}</strong>
          <small>Completed</small>
        </article>
        <article className="metric">
          <span>Satisfaction</span>
          <strong>{summary ? `${Number(summary.averageRating).toFixed(1)} / 5` : "—"}</strong>
          <small>{summary?.feedback ?? 0} responses</small>
        </article>
      </section>
      <div className="feature-grid">
        <section className="panel">
          <div className="panel-title">
            <div>
              <span className="eyebrow">Live database summary</span>
              <h2>Operational counts</h2>
            </div>
            <BarChart3 size={20} />
          </div>
          {chartData.length > 0 ? (
            <div className="chart-box">
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#d7e4dc" />
                  <XAxis dataKey="label" stroke="#687e74" fontSize={11} />
                  <YAxis stroke="#687e74" fontSize={11} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#2b795d" radius={[5, 5, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="list-item">
              <span className="grow">
                <strong>Summary unavailable</strong>
                <small>Sign in with a management role to load the report.</small>
              </span>
            </div>
          )}
          <div className="list" style={{ marginTop: 14 }}>
            <div className="list-item">
              <span className="grow">
                <strong>Open complaints</strong>
                <small>{complaints.filter((item) => item.status === "OPEN").length} currently open</small>
              </span>
            </div>
            {complaints.slice(0, 4).map((item) => (
              <div className="list-item" key={item.id}>
                <span className="grow">
                  <strong>{item.priority} · {item.status}</strong>
                  <small>{item.id}</small>
                </span>
              </div>
            ))}
          </div>
        </section>
        <section className="panel tip-card">
          <Star size={20} />
          <div>
            <span className="eyebrow">Patient-owned feedback</span>
            <h2>Ratings are submitted by patients</h2>
            <p>Patients add, edit and delete their own consultation feedback. Low scores still escalate to the complaints queue shown here.</p>
          </div>
        </section>

        <section className="panel span-2" style={{ gridColumn: "1 / -1", marginTop: 16 }}>
          <div className="panel-title">
            <div>
              <span className="eyebrow">Consultation Reviews</span>
              <h2>{role === "DOCTOR" || role === "DIETITIAN" ? "Feedback received for your consultations" : "All patient feedback records"}</h2>
            </div>
            <Star size={20} />
          </div>
          <div className="list">
            {receivedFeedback.length === 0 && (
              <div className="list-item">
                <span className="grow">
                  <strong>No feedback entries recorded</strong>
                  <small>When patients leave feedback for consultations, it will appear here for the relevant doctor and admin staff.</small>
                </span>
              </div>
            )}
            {receivedFeedback.map((entry) => (
              <div className="list-item" key={entry.id}>
                <span className="avatar">P</span>
                <span className="grow">
                  <strong>Patient {entry.patientId} · {entry.rating}/5 Stars</strong>
                  <small>Practitioner: {entry.practitionerId} · {entry.comments || "No comments written"}</small>
                </span>
                <span className="status confirmed">{entry.createdAt ? new Date(entry.createdAt).toLocaleDateString() : "Recent"}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
