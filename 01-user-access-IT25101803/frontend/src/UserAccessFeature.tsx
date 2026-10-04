import { useEffect, useState } from "react";
import { CircleDollarSign, KeyRound, Plus, Receipt, ShieldCheck, Trash2, UserRoundCheck, Users } from "lucide-react";
import type { WorkspaceAppointment, WorkspaceInvoice } from "../../../frontend/src/api";

type DemoUser = { id: string; fullName: string; email: string; role: string; enabled: boolean };
type StaffRole = "DIETITIAN" | "DOCTOR" | "RECEPTION_STAFF" | "SYSTEM_ADMIN" | "OPERATIONS_MANAGER" | "FINANCE_EXECUTIVE" | "MEDICAL_CENTER_COORDINATOR" | "PATIENT_RELATIONS_OFFICER";
type ProvisionResult = { user: DemoUser; temporaryPassword: string };

function money(value: number) {
  return new Intl.NumberFormat("en-LK", { style: "currency", currency: "LKR", maximumFractionDigits: 0 }).format(value);
}

export function UserAccessFeature({
  isAdmin = false,
  onProvision,
  onLoadUsers,
  onToggleUser,
  onDeleteUser,
  onLoadInvoices,
  onCreateInvoice,
  onUpdateInvoice,
  onDeleteInvoice,
  onLoadAppointments,
}: {
  isAdmin?: boolean;
  onProvision?: (details: { fullName: string; email: string; role: StaffRole }) => Promise<ProvisionResult>;
  onLoadUsers?: () => Promise<DemoUser[]>;
  onToggleUser?: (id: string, enabled: boolean) => Promise<DemoUser>;
  onDeleteUser?: (id: string) => Promise<void>;
  onLoadInvoices?: () => Promise<WorkspaceInvoice[]>;
  onCreateInvoice?: (details: { appointmentId: string; amount: number; status?: string }) => Promise<WorkspaceInvoice>;
  onUpdateInvoice?: (id: string, details: { amount: number; status: string }) => Promise<WorkspaceInvoice>;
  onDeleteInvoice?: (id: string) => Promise<void>;
  onLoadAppointments?: () => Promise<WorkspaceAppointment[]>;
}) {
  const [activeTab, setActiveTab] = useState<"users" | "invoices">("users");
  const [users, setUsers] = useState<DemoUser[]>([]);
  const [invoices, setInvoices] = useState<WorkspaceInvoice[]>([]);
  const [appointments, setAppointments] = useState<WorkspaceAppointment[]>([]);
  const [editingInvoice, setEditingInvoice] = useState<WorkspaceInvoice | null>(null);
  const [showCreateInvoice, setShowCreateInvoice] = useState(false);
  const [message, setMessage] = useState("");
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (onLoadUsers) {
      onLoadUsers().then(setUsers).catch((reason) => setMessage(reason instanceof Error ? reason.message : "Users could not be loaded."));
    }
    if (onLoadInvoices) {
      onLoadInvoices().then(setInvoices).catch(() => undefined);
    }
    if (onLoadAppointments) {
      onLoadAppointments().then(setAppointments).catch(() => undefined);
    }
  }, [onLoadAppointments, onLoadInvoices, onLoadUsers]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const fullName = String(form.get("name"));
    const email = String(form.get("email"));
    if (isAdmin && onProvision) {
      setBusy(true); setMessage(""); setTemporaryPassword("");
      try {
        const result = await onProvision({ fullName, email, role: String(form.get("role")) as StaffRole });
        setUsers((items) => [result.user, ...items]);
        setTemporaryPassword(result.temporaryPassword);
        setMessage("Staff account created. Give the temporary login details to the staff member securely.");
        formElement.reset();
      } catch (reason) { setMessage(reason instanceof Error ? reason.message : "Staff account could not be created."); }
      finally { setBusy(false); }
      return;
    }
    setUsers((items) => [{ id: "Pending", fullName, email, role: "PATIENT", enabled: true }, ...items]);
    setMessage("Patient account created. A welcome notification was queued.");
    formElement.reset();
  }

  async function toggleUser(user: DemoUser) {
    if (!onToggleUser) return;
    try {
      const updated = await onToggleUser(user.id, !user.enabled);
      setUsers((items) => items.map((item) => item.id === updated.id ? updated : item));
      setMessage("Account status changed.");
    } catch (reason) { setMessage(reason instanceof Error ? reason.message : "Account status could not be changed."); }
  }

  async function removeUser(userId: string) {
    if (!onDeleteUser) return;
    if (!window.confirm("Are you sure you want to delete this user? All linked records will be cleaned up.")) return;
    try {
      await onDeleteUser(userId);
      setUsers((items) => items.filter((item) => item.id !== userId));
      setMessage("User account deleted successfully.");
    } catch (reason) { setMessage(reason instanceof Error ? reason.message : "User could not be deleted."); }
  }

  async function handleCreateInvoice(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!onCreateInvoice) return;
    const form = new FormData(event.currentTarget);
    try {
      const created = await onCreateInvoice({
        appointmentId: String(form.get("appointmentId")),
        amount: Number(form.get("amount")),
        status: String(form.get("status")),
      });
      setInvoices((items) => [created, ...items]);
      setShowCreateInvoice(false);
      setMessage("Invoice created successfully.");
    } catch (reason) { setMessage(reason instanceof Error ? reason.message : "Invoice could not be created."); }
  }

  async function handleUpdateInvoice(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingInvoice || !onUpdateInvoice) return;
    const form = new FormData(event.currentTarget);
    try {
      const updated = await onUpdateInvoice(editingInvoice.id, {
        amount: Number(form.get("amount")),
        status: String(form.get("status")),
      });
      setInvoices((items) => items.map((item) => item.id === updated.id ? updated : item));
      setEditingInvoice(null);
      setMessage("Invoice updated successfully.");
    } catch (reason) { setMessage(reason instanceof Error ? reason.message : "Invoice could not be updated."); }
  }

  async function handleDeleteInvoice(id: string) {
    if (!onDeleteInvoice) return;
    if (!window.confirm("Are you sure you want to delete this invoice?")) return;
    try {
      await onDeleteInvoice(id);
      setInvoices((items) => items.filter((item) => item.id !== id));
      setMessage("Invoice deleted successfully.");
    } catch (reason) { setMessage(reason instanceof Error ? reason.message : "Invoice could not be deleted."); }
  }

  return (
    <div className="stack-xl">
      <div className="page-heading">
        <div>
          <span className="eyebrow">Module 01 · IT25101803</span>
          <h1>Patients & access</h1>
          <p>Manage user registration, profiles, account deletion, and invoice billing.</p>
        </div>
        <div className="chip-row">
          <button
            type="button"
            className={activeTab === "users" ? "chip active" : "chip"}
            onClick={() => setActiveTab("users")}
          >
            <Users size={14}/> Users directory ({users.length})
          </button>
          <button
            type="button"
            className={activeTab === "invoices" ? "chip active" : "chip"}
            onClick={() => setActiveTab("invoices")}
          >
            <Receipt size={14}/> Invoices ({invoices.length})
          </button>
        </div>
      </div>

      {message && <div className="success-note">{message}</div>}

      {activeTab === "users" && (
        <div className="feature-grid">
          <section className="panel">
            <div className="panel-title">
              <div>
                <span className="eyebrow">Directory</span>
                <h2>Registered users</h2>
              </div>
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Role</th>
                  <th>Status</th>
                  {isAdmin && <th>Admin action</th>}
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <strong>{user.fullName}</strong>
                      <br/>
                      <small>{user.id} · {user.email}</small>
                    </td>
                    <td>{user.role.replaceAll("_", " ")}</td>
                    <td>
                      <span className={user.enabled ? "status confirmed" : "status disabled"}>
                        {user.enabled ? "Active" : "Disabled"}
                      </span>
                    </td>
                    {isAdmin && (
                      <td>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button className="text-button" type="button" onClick={() => toggleUser(user)}>
                            {user.enabled ? "Disable" : "Enable"}
                          </button>
                          <button className="danger" type="button" onClick={() => void removeUser(user.id)}>
                            <Trash2 size={13}/> Delete
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="panel">
            <div className="panel-title">
              <div>
                <span className="eyebrow">{isAdmin ? "Staff onboarding" : "New patient"}</span>
                <h2>{isAdmin ? "Create staff login" : "Register an account"}</h2>
              </div>
              {isAdmin ? <KeyRound size={20}/> : <UserRoundCheck size={20}/>}
            </div>
            <form className="form-grid" onSubmit={submit}>
              <div className="field full">
                <label htmlFor="name">Full name</label>
                <input id="name" name="name" required placeholder="e.g. Kavindi Silva"/>
              </div>
              <div className="field full">
                <label htmlFor="email">Email</label>
                <input id="email" name="email" type="email" required placeholder="name@example.lk"/>
              </div>
              {isAdmin ? (
                <div className="field full">
                  <label htmlFor="staff-role">Staff role</label>
                  <select id="staff-role" name="role" required>
                    <option value="DOCTOR">Doctor</option>
                    <option value="DIETITIAN">Dietitian</option>
                    <option value="RECEPTION_STAFF">Reception staff</option>
                    <option value="MEDICAL_CENTER_COORDINATOR">Medical center coordinator</option>
                    <option value="PATIENT_RELATIONS_OFFICER">Patient relations officer</option>
                    <option value="OPERATIONS_MANAGER">Operations manager</option>
                    <option value="FINANCE_EXECUTIVE">Finance executive</option>
                    <option value="SYSTEM_ADMIN">System administrator</option>
                  </select>
                  <small>Public sign-up cannot create staff accounts.</small>
                </div>
              ) : (
                <div className="field full">
                  <label>Starting role</label>
                  <input value="Patient" readOnly aria-label="Starting role"/>
                  <small>Only an administrator can assign a staff role.</small>
                </div>
              )}
              <button className="primary field full" type="submit" disabled={busy}>
                <Plus size={17}/> {busy ? "Creating…" : isAdmin ? "Create staff account" : "Create patient account"}
              </button>
            </form>
            {temporaryPassword && (
              <div className="temporary-password">
                <span>One-time temporary password</span>
                <strong>{temporaryPassword}</strong>
                <small>This is shown once. The staff member must replace it after first login.</small>
              </div>
            )}
          </section>
        </div>
      )}

      {activeTab === "invoices" && (
        <div className="feature-grid">
          <section className="panel">
            <div className="panel-title">
              <div>
                <span className="eyebrow">Billing & records</span>
                <h2>Invoice Management</h2>
              </div>
              {isAdmin && (
                <button className="primary" type="button" onClick={() => { setShowCreateInvoice(v => !v); setEditingInvoice(null); }}>
                  <Plus size={15}/> New Invoice
                </button>
              )}
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Invoice #</th>
                  <th>Patient</th>
                  <th>Service</th>
                  <th>Amount</th>
                  <th>Status</th>
                  {isAdmin && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id}>
                    <td>
                      <strong>{inv.invoiceNumber}</strong>
                      <br/>
                      <small>{inv.createdAt ? new Date(inv.createdAt).toLocaleDateString() : ""}</small>
                    </td>
                    <td>{inv.patientName}</td>
                    <td>{inv.serviceType}</td>
                    <td><strong>{money(Number(inv.amount))}</strong></td>
                    <td>
                      <span className={inv.status === "PAID" ? "status confirmed" : "status pending"}>
                        {inv.status}
                      </span>
                    </td>
                    {isAdmin && (
                      <td>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button className="text-button" type="button" onClick={() => { setEditingInvoice(inv); setShowCreateInvoice(false); }}>
                            Edit
                          </button>
                          <button className="danger" type="button" onClick={() => void handleDeleteInvoice(inv.id)}>
                            <Trash2 size={13}/> Delete
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
                {invoices.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ textAlign: "center", color: "#687e74", padding: 20 }}>
                      No invoices found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>

          {showCreateInvoice && (
            <section className="panel">
              <div className="panel-title">
                <div>
                  <span className="eyebrow">New Billing</span>
                  <h2>Create Invoice</h2>
                </div>
                <CircleDollarSign size={20}/>
              </div>
              <form className="form-grid" onSubmit={handleCreateInvoice}>
                <div className="field full">
                  <label htmlFor="inv-appointment">Select Appointment</label>
                  <select id="inv-appointment" name="appointmentId" required>
                    <option value="">Select an appointment</option>
                    {appointments.map((appt) => (
                      <option key={appt.id} value={appt.id}>
                        {appt.patientName} - {appt.serviceType} ({appt.startTime ? new Date(appt.startTime).toLocaleDateString() : ""})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field full">
                  <label htmlFor="inv-amount">Amount (LKR)</label>
                  <input id="inv-amount" name="amount" type="number" min="0" defaultValue="3500" required/>
                </div>
                <div className="field full">
                  <label htmlFor="inv-status">Status</label>
                  <select id="inv-status" name="status" defaultValue="PENDING">
                    <option value="PENDING">PENDING</option>
                    <option value="PAID">PAID</option>
                    <option value="PARTIALLY_PAID">PARTIALLY_PAID</option>
                    <option value="CANCELLED">CANCELLED</option>
                  </select>
                </div>
                <div className="field full" style={{ display: "flex", gap: 8 }}>
                  <button className="primary" type="submit">Generate Invoice</button>
                  <button className="secondary" type="button" onClick={() => setShowCreateInvoice(false)}>Cancel</button>
                </div>
              </form>
            </section>
          )}

          {editingInvoice && (
            <section className="panel">
              <div className="panel-title">
                <div>
                  <span className="eyebrow">Update Billing</span>
                  <h2>Edit Invoice {editingInvoice.invoiceNumber}</h2>
                </div>
                <Receipt size={20}/>
              </div>
              <form className="form-grid" onSubmit={handleUpdateInvoice} key={editingInvoice.id}>
                <div className="field full">
                  <label>Patient & Service</label>
                  <input value={`${editingInvoice.patientName} · ${editingInvoice.serviceType}`} readOnly/>
                </div>
                <div className="field full">
                  <label htmlFor="edit-inv-amount">Amount (LKR)</label>
                  <input id="edit-inv-amount" name="amount" type="number" min="0" defaultValue={editingInvoice.amount} required/>
                </div>
                <div className="field full">
                  <label htmlFor="edit-inv-status">Status</label>
                  <select id="edit-inv-status" name="status" defaultValue={editingInvoice.status}>
                    <option value="PENDING">PENDING</option>
                    <option value="PAID">PAID</option>
                    <option value="PARTIALLY_PAID">PARTIALLY_PAID</option>
                    <option value="CANCELLED">CANCELLED</option>
                    <option value="REFUNDED">REFUNDED</option>
                  </select>
                </div>
                <div className="field full" style={{ display: "flex", gap: 8 }}>
                  <button className="primary" type="submit">Save Changes</button>
                  <button className="secondary" type="button" onClick={() => setEditingInvoice(null)}>Cancel</button>
                </div>
              </form>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

