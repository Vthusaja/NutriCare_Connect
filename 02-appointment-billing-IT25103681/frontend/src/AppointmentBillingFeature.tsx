import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarCheck, CircleDollarSign, Clock3, Plus, Trash2 } from "lucide-react";

type Appointment = {
  id: string; patientId: string; patientName: string; practitionerId: string; practitionerName: string;
  serviceType: string; status: string; startTime: string; invoiceNumber?: string; amount?: number; invoiceStatus?: string;
};
type Slot = { id: string; practitionerId: string; practitionerName: string; startTime: string; durationMinutes: number; status: string };
type Person = { id: string; fullName: string; role: string; enabled: boolean };

function localDate(value = new Date()) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
function money(value: number) {
  return new Intl.NumberFormat("en-LK", { style: "currency", currency: "LKR", maximumFractionDigits: 0 }).format(value);
}
function time(value: string) {
  return new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
function dateLabel(value: string) {
  return new Date(`${value}T12:00:00`).toLocaleDateString([], { weekday: "long", day: "2-digit", month: "short" });
}

export function AppointmentBillingFeature({
  role, currentUserId, userName, loadAppointments, loadSlots, loadPeople, createBooking, createSlot, updateSlot, deleteSlot, cancelAppointment, updateAppointment, payAppointment,
}: {
  role: string; currentUserId: string; userName: string;
  loadAppointments: () => Promise<Appointment[]>;
  loadSlots: (date: string) => Promise<Slot[]>;
  loadPeople: () => Promise<Person[]>;
  createBooking: (details: { slotId: string; patientId: string; serviceType: string; amount: number }) => Promise<unknown>;
  createSlot: (details: { practitionerId?: string; startTime: string; durationMinutes: number }) => Promise<unknown>;
  updateSlot: (id: string, details: { startTime: string; durationMinutes: number }) => Promise<unknown>;
  deleteSlot: (id: string) => Promise<void>;
  cancelAppointment: (id: string) => Promise<void>;
  updateAppointment?: (id: string, details: { serviceType?: string; status?: string; amount?: number }) => Promise<unknown>;
  payAppointment: (id: string, details: { amount: number; method: string; status: string }) => Promise<unknown>;
}) {
  const canBook = role === "PATIENT" || role === "RECEPTION_STAFF" || role === "SYSTEM_ADMIN" || role === "MEDICAL_CENTER_COORDINATOR";
  const canManageSlots = role === "DOCTOR" || role === "DIETITIAN" || role === "RECEPTION_STAFF" || role === "SYSTEM_ADMIN" || role === "MEDICAL_CENTER_COORDINATOR";
  const isPractitioner = role === "DOCTOR" || role === "DIETITIAN";
  const canCancel = canBook || isPractitioner;
  const canPay = role === "PATIENT" || role === "RECEPTION_STAFF" || role === "FINANCE_EXECUTIVE" || role === "SYSTEM_ADMIN";

  const [selectedDate, setSelectedDate] = useState(() => {
    const next = new Date();
    next.setDate(next.getDate() + 1);
    return localDate(next);
  });
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [chosen, setChosen] = useState("");
  const [editingSlotId, setEditingSlotId] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    setNotice("");
    try {
      const needsPeople = canBook || (canManageSlots && !isPractitioner);
      const [appointmentRows, slotRows, personRows] = await Promise.all([
        loadAppointments(),
        loadSlots(selectedDate),
        needsPeople ? loadPeople() : Promise.resolve([] as Person[]),
      ]);
      setAppointments(appointmentRows);
      setSlots(slotRows);
      setPeople(personRows);
      setChosen((current) =>
        slotRows.some((slot) => slot.id === current && slot.status === "AVAILABLE")
          ? current
          : (slotRows.find((slot) => slot.status === "AVAILABLE")?.id ?? ""),
      );
    } catch (reason) {
      setNotice(reason instanceof Error ? reason.message : "Appointments could not be loaded from the database.");
    } finally {
      setLoading(false);
    }
  }, [canBook, canManageSlots, isPractitioner, loadAppointments, loadPeople, loadSlots, selectedDate]);

  useEffect(() => { void refresh(); }, [refresh]);

  const selected = slots.find((slot) => slot.id === chosen);
  const available = slots.filter((slot) => slot.status === "AVAILABLE");
  const confirmed = appointments.filter((row) => row.status === "CONFIRMED").length;
  const outstanding = appointments
    .filter((row) => row.invoiceStatus && row.invoiceStatus !== "PAID" && row.invoiceStatus !== "CANCELLED")
    .reduce((sum, row) => sum + Number(row.amount ?? 0), 0);
  const patients = useMemo(() => people.filter((person) => person.role === "PATIENT"), [people]);
  const practitioners = useMemo(
    () => people.filter((person) => person.role === "DOCTOR" || person.role === "DIETITIAN"),
    [people],
  );

  async function book(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) { setNotice("Select an available slot first."); return; }
    const form = new FormData(event.currentTarget);
    try {
      await createBooking({
        slotId: selected.id,
        patientId: role === "PATIENT" ? currentUserId : String(form.get("patientId")),
        serviceType: String(form.get("serviceType")),
        amount: Number(form.get("amount")),
      });
      setNotice("Slot held for 10 minutes and an invoice was generated. Confirm payment to finalize.");
      await refresh();
    } catch (reason) {
      setNotice(reason instanceof Error ? reason.message : "The appointment could not be created.");
    }
  }

  async function saveAvailability(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const date = String(form.get("slotDate"));
    const clock = String(form.get("slotTime"));
    const durationMinutes = Number(form.get("durationMinutes") || 60);
    const practitionerId = isPractitioner ? currentUserId : String(form.get("practitionerId") || "");
    const startTime = `${date}T${clock}:00`;
    try {
      if (editingSlotId) {
        await updateSlot(editingSlotId, { startTime, durationMinutes });
        setNotice("Availability slot updated.");
        setEditingSlotId("");
      } else {
        await createSlot({ practitionerId: practitionerId || undefined, startTime, durationMinutes });
        setNotice("Availability slot added. Patients and admin can now book it.");
      }
      setSelectedDate(date);
      event.currentTarget.reset();
      await refresh();
    } catch (reason) {
      setNotice(reason instanceof Error ? reason.message : "The availability slot could not be saved.");
    }
  }

  async function removeSlot(slotId: string) {
    try {
      await deleteSlot(slotId);
      if (editingSlotId === slotId) setEditingSlotId("");
      setNotice("Availability slot removed.");
      await refresh();
    } catch (reason) {
      setNotice(reason instanceof Error ? reason.message : "The slot could not be removed.");
    }
  }

  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);

  async function cancel(id: string) {
    if (!window.confirm("Are you sure you want to cancel and delete this appointment?")) return;
    try {
      await cancelAppointment(id);
      setNotice("Appointment deleted and the slot was released.");
      await refresh();
    } catch (reason) {
      setNotice(reason instanceof Error ? reason.message : "The appointment could not be cancelled.");
    }
  }

  async function updateAppt(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingAppointment || !updateAppointment) return;
    const form = new FormData(event.currentTarget);
    try {
      await updateAppointment(editingAppointment.id, {
        serviceType: String(form.get("serviceType")),
        status: String(form.get("status")),
        amount: Number(form.get("amount")),
      });
      setNotice("Appointment updated successfully.");
      setEditingAppointment(null);
      await refresh();
    } catch (reason) {
      setNotice(reason instanceof Error ? reason.message : "The appointment could not be updated.");
    }
  }

  async function pay(appointment: Appointment) {
    try {
      await payAppointment(appointment.id, {
        amount: Number(appointment.amount ?? 0),
        method: "CARD",
        status: "PAID",
      });
      setNotice("Payment recorded. Appointment confirmed.");
      await refresh();
    } catch (reason) {
      setNotice(reason instanceof Error ? reason.message : "Payment could not be recorded.");
    }
  }

  function beginEdit(slot: Slot) {
    setEditingSlotId(slot.id);
    setSelectedDate(localDate(new Date(slot.startTime)));
    document.getElementById("availability-form")?.scrollIntoView({ behavior: "smooth" });
  }

  const editingSlot = slots.find((slot) => slot.id === editingSlotId);
  const defaultSlotTime = editingSlot
    ? new Date(editingSlot.startTime).toTimeString().slice(0, 5)
    : "09:00";

  return (
    <div className="stack-xl">
      <div className="page-heading">
        <div>
          <span className="eyebrow">Module 02 Â· IT25103681</span>
          <h1>Appointments & billing</h1>
          <p>
            {isPractitioner
              ? "Publish the times you are available, then review bookings assigned to you."
              : "Pick a date, choose an open slot, hold it, then confirm payment or cancel as needed."}
          </p>
        </div>
        <div className="welcome-actions">
          {canManageSlots && (
            <button className="secondary" onClick={() => document.getElementById("availability-form")?.scrollIntoView({ behavior: "smooth" })}>
              <Plus size={17} /> Add availability
            </button>
          )}
          {canBook && (
            <button className="primary" onClick={() => document.getElementById("booking-form")?.scrollIntoView({ behavior: "smooth" })}>
              <Plus size={17} /> New booking
            </button>
          )}
        </div>
      </div>

      <section className="metric-row">
        <article className="metric"><span>Available on date</span><strong>{loading ? "â€¦" : `${available.length} slots`}</strong></article>
        <article className="metric"><span>{role === "PATIENT" ? "My confirmed" : "Confirmed"}</span><strong>{loading ? "â€¦" : confirmed}</strong></article>
        <article className="metric"><span>Outstanding</span><strong>{loading ? "â€¦" : money(outstanding)}</strong></article>
      </section>

      {notice && <div className="success-note">{notice}</div>}

      <section className="panel">
        <div className="panel-title">
          <div>
            <span className="eyebrow">{dateLabel(selectedDate)}</span>
            <h2>{isPractitioner ? "My consultation schedule" : "Consultation times"}</h2>
          </div>
          <CalendarCheck size={20} />
        </div>
        <div className="form-grid" style={{ marginBottom: 14 }}>
          <div className="field">
            <label htmlFor="schedule-date">Schedule date</label>
            <input id="schedule-date" type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} />
          </div>
        </div>
        <div className="chip-row">
          {slots.map((slot) => (
            <button
              key={slot.id}
              type="button"
              className={chosen === slot.id ? "chip active" : "chip"}
              onClick={() => slot.status === "AVAILABLE" && setChosen(slot.id)}
              disabled={slot.status !== "AVAILABLE" && !canManageSlots}
              title={`${slot.status} Â· ${slot.durationMinutes} min`}
            >
              <Clock3 size={12} /> {time(slot.startTime)} Â· {slot.practitionerName}
              {slot.status !== "AVAILABLE" ? ` Â· ${slot.status}` : ""}
            </button>
          ))}
          {!loading && slots.length === 0 && <span className="chip">No slots for this date â€” add availability or pick another day</span>}
        </div>
        {canManageSlots && available.length > 0 && (
          <div className="list" style={{ marginTop: 14 }}>
            {available.map((slot) => (
              <div className="list-item" key={`manage-${slot.id}`}>
                <span className="grow">
                  <strong>{slot.practitionerName}</strong>
                  <small>{time(slot.startTime)} Â· {slot.durationMinutes} min Â· AVAILABLE</small>
                </span>
                <button className="text-button" type="button" onClick={() => beginEdit(slot)}>Edit</button>
                <button className="danger" type="button" onClick={() => void removeSlot(slot.id)}><Trash2 size={14} /> Remove</button>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className={canBook || canManageSlots ? "feature-grid" : "stack-xl"}>
        <section className="panel">
          <div className="panel-title">
            <div>
              <span className="eyebrow">Records</span>
              <h2>Appointments</h2>
            </div>
          </div>
          <div className="list">
            {appointments.map((appointment) => (
              <div className="list-item" key={appointment.id}>
                <span className="avatar">{appointment.patientName[0]}</span>
                <span className="grow">
                  <strong>{appointment.patientName}</strong>
                  <small>
                    {appointment.practitionerName} Â· {new Date(appointment.startTime).toLocaleString()} Â· {appointment.serviceType}
                    {appointment.invoiceNumber ? ` Â· ${appointment.invoiceNumber}` : ""}
                  </small>
                </span>
                <span style={{ textAlign: "right" }}>
                  <span className={appointment.status === "CONFIRMED" ? "status confirmed" : "status pending"}>{appointment.status}</span>
                  <small style={{ display: "block", marginTop: 5 }}>
                    {appointment.amount == null ? "No invoice" : `${money(Number(appointment.amount))} Â· ${appointment.invoiceStatus ?? "â€”"}`}
                  </small>
                  <span style={{ display: "flex", gap: 6, justifyContent: "flex-end", marginTop: 8, flexWrap: "wrap" }}>
                    {canPay && appointment.status === "HELD" && appointment.invoiceStatus !== "PAID" && (
                      <button className="primary" type="button" onClick={() => void pay(appointment)}>Pay & confirm</button>
                    )}
                    {canCancel && (
                      <button className="text-button" type="button" onClick={() => setEditingAppointment(appointment)}>Edit</button>
                    )}
                    {canCancel && (
                      <button className="danger" type="button" onClick={() => void cancel(appointment.id)}>Cancel</button>
                    )}
                  </span>
                </span>
              </div>
            ))}
            {!loading && appointments.length === 0 && (
              <div className="list-item">
                <span className="grow">
                  <strong>No appointments</strong>
                  <small>Nothing has been assigned to {userName} yet.</small>
                </span>
              </div>
            )}
          </div>

          {editingAppointment && (
            <div style={{ marginTop: 20, padding: 16, border: "1px solid #c9ded3", borderRadius: 12, background: "#f5faf7" }}>
              <div className="panel-title" style={{ marginBottom: 12 }}>
                <div>
                  <span className="eyebrow">Editing Appointment</span>
                  <h3>{editingAppointment.patientName} Â· {editingAppointment.practitionerName}</h3>
                </div>
              </div>
              <form className="form-grid" onSubmit={updateAppt}>
                <div className="field full">
                  <label htmlFor="edit-serviceType">Service Type</label>
                  <input id="edit-serviceType" name="serviceType" defaultValue={editingAppointment.serviceType} required />
                </div>
                <div className="field">
                  <label htmlFor="edit-status">Status</label>
                  <select id="edit-status" name="status" defaultValue={editingAppointment.status} required>
                    <option value="HELD">HELD</option>
                    <option value="CONFIRMED">CONFIRMED</option>
                    <option value="COMPLETED">COMPLETED</option>
                    <option value="CANCELLED">CANCELLED</option>
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="edit-amount">Invoice Amount (LKR)</label>
                  <input id="edit-amount" name="amount" type="number" min="0" defaultValue={editingAppointment.amount ?? 0} required />
                </div>
                <div className="field full" style={{ display: "flex", gap: 8 }}>
                  <button className="primary" type="submit">Save Changes</button>
                  <button className="secondary" type="button" onClick={() => setEditingAppointment(null)}>Cancel</button>
                </div>
              </form>
            </div>
          )}
        </section>

        <div className="stack-xl">
          {canManageSlots && (
            <section className="panel" id="availability-form">
              <div className="panel-title">
                <div>
                  <span className="eyebrow">Availability</span>
                  <h2>{editingSlotId ? "Edit slot" : "Add available time"}</h2>
                </div>
                <Clock3 size={20} />
              </div>
              <form className="form-grid" onSubmit={saveAvailability} key={editingSlotId || "new-slot"}>
                {!isPractitioner && (
                  <div className="field full">
                    <label htmlFor="practitionerId">Practitioner</label>
                    <select id="practitionerId" name="practitionerId" required defaultValue={editingSlot?.practitionerId ?? ""}>
                      <option value="" disabled>Select doctor or dietitian</option>
                      {practitioners.map((person) => (
                        <option key={person.id} value={person.id}>{person.fullName} ({person.id})</option>
                      ))}
                    </select>
                  </div>
                )}
                {isPractitioner && (
                  <div className="field full">
                    <label>Practitioner</label>
                    <input value={`${userName} (${currentUserId})`} readOnly />
                  </div>
                )}
                <div className="field">
                  <label htmlFor="slotDate">Date</label>
                  <input id="slotDate" name="slotDate" type="date" required defaultValue={editingSlot ? localDate(new Date(editingSlot.startTime)) : selectedDate} />
                </div>
                <div className="field">
                  <label htmlFor="slotTime">Start time</label>
                  <input id="slotTime" name="slotTime" type="time" required defaultValue={defaultSlotTime} />
                </div>
                <div className="field full">
                  <label htmlFor="durationMinutes">Duration (minutes)</label>
                  <input id="durationMinutes" name="durationMinutes" type="number" min={15} max={240} step={15} defaultValue={editingSlot?.durationMinutes ?? 60} required />
                </div>
                <button className="primary field full" type="submit">{editingSlotId ? "Update slot" : "Publish availability"}</button>
                {editingSlotId && (
                  <button className="secondary field full" type="button" onClick={() => setEditingSlotId("")}>Cancel edit</button>
                )}
              </form>
            </section>
          )}

          {canBook && (
            <section className="panel" id="booking-form">
              <div className="panel-title">
                <div>
                  <span className="eyebrow">Reserve & invoice</span>
                  <h2>Create appointment</h2>
                </div>
                <CircleDollarSign size={20} />
              </div>
              <form className="form-grid" onSubmit={book}>
                {role === "PATIENT" ? (
                  <div className="field full">
                    <label>Patient</label>
                    <input value={`${userName} (${currentUserId})`} readOnly />
                  </div>
                ) : (
                  <div className="field full">
                    <label htmlFor="patientId">Patient</label>
                    <select id="patientId" name="patientId" required>
                      {patients.map((patient) => (
                        <option key={patient.id} value={patient.id}>{patient.fullName} ({patient.id})</option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="field full">
                  <label>Practitioner and time</label>
                  <input
                    value={selected ? `${selected.practitionerName} Â· ${dateLabel(selectedDate)} Â· ${time(selected.startTime)}` : "No available slot selected"}
                    readOnly
                  />
                </div>
                <div className="field full">
                  <label htmlFor="serviceType">Service</label>
                  <input id="serviceType" name="serviceType" defaultValue="Health check-up" required />
                </div>
                <div className="field full">
                  <label htmlFor="amount">Invoice amount (LKR)</label>
                  <input id="amount" name="amount" type="number" min="0" defaultValue="3500" required />
                </div>
                <button className="primary field full" type="submit" disabled={!selected}>Hold slot & generate invoice</button>
              </form>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
