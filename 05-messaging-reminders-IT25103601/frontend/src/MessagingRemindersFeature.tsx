import { useCallback, useEffect, useMemo, useState } from "react";
import { BellRing, Mail, MessageCircle, Send } from "lucide-react";

type Person = { id: string; fullName: string; role: string; enabled: boolean };
type SecureMessage = {
  id: string;
  senderId: string;
  recipientId: string;
  patientId: string;
  body: string;
  sentAt: string;
};
type DeliveryNotice = {
  id: string;
  recipientId: string;
  type: string;
  channel: string;
  message: string;
  status: string;
  createdAt: string;
};

export function MessagingRemindersFeature({
  patientOnly = false,
  currentUserId,
  userName = "Patient",
  loadPeople,
  loadMessages,
  sendMessage,
  updateMessage,
  deleteMessage,
  loadNotices,
  createNotice,
}: {
  patientOnly?: boolean;
  currentUserId: string;
  userName?: string;
  loadPeople: () => Promise<Person[]>;
  loadMessages: (patientId: string) => Promise<SecureMessage[]>;
  sendMessage: (details: { senderId: string; recipientId: string; patientId: string; body: string }) => Promise<SecureMessage>;
  updateMessage?: (id: string, body: string) => Promise<SecureMessage>;
  deleteMessage?: (id: string) => Promise<void>;
  loadNotices: (recipientId: string) => Promise<DeliveryNotice[]>;
  createNotice: (details: {
    recipientId: string;
    type: string;
    channel: "IN_APP" | "EMAIL" | "SMS";
    message: string;
    simulateFailure?: boolean;
  }) => Promise<DeliveryNotice>;
}) {
  const firstName = userName.split(" ")[0];
  const [people, setPeople] = useState<Person[]>([]);
  const [patientId, setPatientId] = useState(patientOnly ? currentUserId : "");
  const [recipientId, setRecipientId] = useState("");
  const [messages, setMessages] = useState<SecureMessage[]>([]);
  const [notices, setNotices] = useState<DeliveryNotice[]>([]);
  const [message, setMessage] = useState("");
  const [reminderText, setReminderText] = useState("Appointment reminder: please arrive 10 minutes early.");
  const [reminderChannel, setReminderChannel] = useState<"IN_APP" | "EMAIL" | "SMS">("IN_APP");
  const [simulateFailure, setSimulateFailure] = useState(false);
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const patients = useMemo(() => people.filter((person) => person.role === "PATIENT" && person.enabled), [people]);
  const careTeam = useMemo(
    () => people.filter((person) => (person.role === "DIETITIAN" || person.role === "DOCTOR") && person.enabled),
    [people],
  );
  const nameById = useMemo(() => Object.fromEntries(people.map((person) => [person.id, person.fullName])), [people]);

  useEffect(() => {
    loadPeople()
      .then((rows) => {
        setPeople(rows);
        if (patientOnly) {
          const staff = rows.filter((person) => (person.role === "DIETITIAN" || person.role === "DOCTOR") && person.enabled);
          setRecipientId((current) => current || staff[0]?.id || "");
        } else {
          const patientRows = rows.filter((person) => person.role === "PATIENT" && person.enabled);
          setPatientId((current) => current || patientRows[0]?.id || "");
        }
      })
      .catch((reason) => setNotice(reason instanceof Error ? reason.message : "Directory could not be loaded."));
  }, [loadPeople, patientOnly]);

  useEffect(() => {
    if (patientOnly || !patientId) return;
    setRecipientId(patientId);
  }, [patientId, patientOnly]);

  const refresh = useCallback(async () => {
    if (!patientId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const rows = await loadMessages(patientId);
      setMessages(rows);
      if (patientOnly) {
        setNotices(await loadNotices(currentUserId));
      } else {
        try {
          setNotices(await loadNotices(patientId));
        } catch {
          setNotices([]);
        }
      }
    } catch (reason) {
      setNotice(reason instanceof Error ? reason.message : "Conversation could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [currentUserId, loadMessages, loadNotices, patientId, patientOnly]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function send(event: React.FormEvent) {
    event.preventDefault();
    if (!message.trim() || !patientId || !recipientId) return;
    setSending(true);
    setNotice("");
    try {
      await sendMessage({
        senderId: currentUserId,
        recipientId,
        patientId,
        body: message.trim(),
      });
      setMessage("");
      setNotice("Message saved to the care conversation.");
      await refresh();
    } catch (reason) {
      setNotice(reason instanceof Error ? reason.message : "Message could not be sent.");
    } finally {
      setSending(false);
    }
  }

  async function sendReminder(event: React.FormEvent) {
    event.preventDefault();
    if (!patientId || !reminderText.trim()) return;
    setNotice("");
    try {
      await createNotice({
        recipientId: patientId,
        type: "APPOINTMENT_REMINDER",
        channel: reminderChannel,
        message: reminderText.trim(),
        simulateFailure,
      });
      setNotice(simulateFailure ? "Reminder recorded as FAILED and queued for retry." : "Simulated reminder delivery recorded.");
      await refresh();
    } catch (reason) {
      setNotice(reason instanceof Error ? reason.message : "Reminder could not be created.");
    }
  }

  function labelFor(userId: string) {
    if (userId === currentUserId) return "You";
    return nameById[userId] ?? userId;
  }

  const [editingMsgId, setEditingMsgId] = useState("");
  const [editingMsgBody, setEditingMsgBody] = useState("");

  async function handleEditMessage(id: string) {
    if (!editingMsgBody.trim() || !updateMessage) return;
    try {
      await updateMessage(id, editingMsgBody.trim());
      setNotice("Message updated.");
      setEditingMsgId("");
      await refresh();
    } catch (reason) {
      setNotice(reason instanceof Error ? reason.message : "The message could not be updated.");
    }
  }

  async function handleDeleteMsg(id: string) {
    if (!deleteMessage) return;
    if (!window.confirm("Are you sure you want to delete this message?")) return;
    try {
      await deleteMessage(id);
      setNotice("Message deleted.");
      await refresh();
    } catch (reason) {
      setNotice(reason instanceof Error ? reason.message : "The message could not be deleted.");
    }
  }

  const conversation = (
    <section className="panel">
      <div className="panel-title">
        <div>
          <span className="eyebrow">{patientOnly ? "My care team" : firstName}</span>
          <h2>Care conversation</h2>
        </div>
        <MessageCircle size={20} />
      </div>

      {!patientOnly && (
        <div className="field" style={{ marginBottom: 12 }}>
          <label htmlFor="message-patient">Patient</label>
          <select id="message-patient" value={patientId} onChange={(event) => setPatientId(event.target.value)}>
            {patients.map((patient) => (
              <option value={patient.id} key={patient.id}>
                {patient.fullName} ({patient.id})
              </option>
            ))}
          </select>
        </div>
      )}

      {patientOnly && (
        <div className="field" style={{ marginBottom: 12 }}>
          <label htmlFor="message-recipient">Send to</label>
          <select id="message-recipient" value={recipientId} onChange={(event) => setRecipientId(event.target.value)} disabled={careTeam.length === 0}>
            {careTeam.length === 0 && <option value="">No care-team contacts available</option>}
            {careTeam.map((person) => (
              <option value={person.id} key={person.id}>
                {person.fullName} · {person.role.toLowerCase()}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="list">
        {loading && (
          <div className="list-item">
            <span className="grow">
              <strong>Loading conversation…</strong>
            </span>
          </div>
        )}
        {!loading && messages.length === 0 && (
          <div className="list-item">
            <span className="grow">
              <strong>No messages yet</strong>
              <small>Send a non-urgent note to start this conversation.</small>
            </span>
          </div>
        )}
        {messages.map((item) => {
          const mine = item.senderId === currentUserId;
          const from = labelFor(item.senderId);
          const ageMs = Date.now() - new Date(item.sentAt).getTime();
          const canEditOrDelete = mine && ageMs <= 10 * 60 * 1000;
          const minutesLeft = Math.max(1, Math.ceil((10 * 60 * 1000 - ageMs) / 60000));
          const isEditing = editingMsgId === item.id;

          return (
            <div
              className="list-item"
              key={item.id}
              style={{ marginLeft: mine ? "14%" : 0, background: mine ? "#e8f3ed" : "white", flexDirection: "column", alignItems: "stretch" }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                <span className="avatar">{from[0]}</span>
                <span className="grow">
                  <strong>{from}</strong>
                  {isEditing ? (
                    <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                      <input
                        value={editingMsgBody}
                        onChange={(e) => setEditingMsgBody(e.target.value)}
                        style={{ flex: 1, border: "1px solid #2b795d", borderRadius: 6, padding: "6px 10px" }}
                        autoFocus
                      />
                      <button className="primary" type="button" onClick={() => void handleEditMessage(item.id)}>Save</button>
                      <button className="secondary" type="button" onClick={() => setEditingMsgId("")}>Cancel</button>
                    </div>
                  ) : (
                    <p style={{ margin: "4px 0" }}>{item.body}</p>
                  )}
                  <small style={{ color: "#687e74" }}>
                    {new Date(item.sentAt).toLocaleString()} · Delivered
                    {canEditOrDelete && ` (${minutesLeft}m edit window left)`}
                  </small>
                </span>
                {canEditOrDelete && !isEditing && (
                  <span style={{ display: "flex", gap: 6 }}>
                    <button
                      className="text-button"
                      type="button"
                      onClick={() => {
                        setEditingMsgId(item.id);
                        setEditingMsgBody(item.body);
                      }}
                    >
                      Edit
                    </button>
                    <button className="danger" type="button" onClick={() => void handleDeleteMsg(item.id)}>Delete</button>
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <form onSubmit={send} style={{ display: "flex", gap: 8, marginTop: 14 }}>
        <input
          aria-label="Message"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="Write a non-urgent message…"
          style={{ flex: 1, border: "1px solid #d9e3dd", borderRadius: 10, padding: 11 }}
        />
        <button className="primary" aria-label="Send message" disabled={sending || !recipientId || !patientId}>
          <Send size={17} />
        </button>
      </form>
    </section>
  );

  return (
    <div className="stack-xl">
      <div className="page-heading">
        <div>
          <span className="eyebrow">Module 05 · IT25103601</span>
          <h1>Messages & reminders</h1>
          <p>Secure, non-urgent conversations with reliable notifications.</p>
        </div>
        {!patientOnly && (
          <span className="chip active">
            <BellRing size={13} /> Reminder scheduler active
          </span>
        )}
      </div>

      {notice && <div className="success-note">{notice}</div>}

      <div className="feature-grid">
        {conversation}
        {patientOnly ? (
          <section className="panel tip-card">
            <BellRing />
            <div>
              <span className="eyebrow">My reminders</span>
              <h2>Appointments and plan updates</h2>
              <p>Your personal notifications also appear in the bell menu. Delivery administration is restricted to staff.</p>
              <div className="list" style={{ marginTop: 14 }}>
                {notices.length === 0 && (
                  <div className="list-item">
                    <span className="grow">
                      <strong>No reminders yet</strong>
                      <small>Staff reminders will show here once delivered.</small>
                    </span>
                  </div>
                )}
                {notices.slice(0, 5).map((item) => (
                  <div className="list-item" key={item.id}>
                    <span className="avatar">
                      <BellRing size={15} />
                    </span>
                    <span className="grow">
                      <strong>{item.type.replaceAll("_", " ")}</strong>
                      <small>
                        {item.message} · {item.channel}
                      </small>
                    </span>
                    <span className={item.status.includes("DELIVERED") || item.status === "READ" ? "status confirmed" : "status pending"}>
                      {item.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        ) : (
          <section className="panel">
            <div className="panel-title">
              <div>
                <span className="eyebrow">Delivery queue</span>
                <h2>Automated reminders</h2>
              </div>
              <Mail size={20} />
            </div>
            <form className="form-grid" onSubmit={sendReminder} style={{ marginBottom: 14 }}>
              <div className="field full">
                <label htmlFor="reminder-text">Reminder message</label>
                <textarea id="reminder-text" rows={3} value={reminderText} onChange={(event) => setReminderText(event.target.value)} required />
              </div>
              <div className="field">
                <label htmlFor="reminder-channel">Channel</label>
                <select id="reminder-channel" value={reminderChannel} onChange={(event) => setReminderChannel(event.target.value as "IN_APP" | "EMAIL" | "SMS")}>
                  <option value="IN_APP">In-app</option>
                  <option value="EMAIL">Email</option>
                  <option value="SMS">SMS</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="reminder-fail">Simulate failure</label>
                <select id="reminder-fail" value={simulateFailure ? "yes" : "no"} onChange={(event) => setSimulateFailure(event.target.value === "yes")}>
                  <option value="no">Deliver simulated</option>
                  <option value="yes">Mark failed for retry</option>
                </select>
              </div>
              <button className="primary field full" type="submit" disabled={!patientId}>
                Queue reminder for selected patient
              </button>
            </form>
            <div className="list">
              {notices.length === 0 && (
                <div className="list-item">
                  <span className="grow">
                    <strong>No delivery records for this patient</strong>
                    <small>Queued reminders appear here after you create them.</small>
                  </span>
                </div>
              )}
              {notices.map((item) => (
                <div className="list-item" key={item.id}>
                  <span className="avatar">
                    <BellRing size={15} />
                  </span>
                  <span className="grow">
                    <strong>{item.type.replaceAll("_", " ")}</strong>
                    <small>
                      {item.channel} · {item.message}
                    </small>
                  </span>
                  <span className={item.status.includes("DELIVERED") || item.status === "READ" ? "status confirmed" : "status pending"}>
                    {item.status}
                  </span>
                </div>
              ))}
            </div>
            <div className="success-note">Email and SMS delivery attempts and retry statuses are saved in the database.</div>
          </section>
        )}
      </div>
    </div>
  );
}
