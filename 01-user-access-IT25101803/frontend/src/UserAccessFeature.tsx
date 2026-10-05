import { useEffect, useState } from "react";
import { CircleDollarSign, Download, FileText, KeyRound, Plus, Printer, Receipt, ShieldCheck, Trash2, UserRoundCheck, Users } from "lucide-react";
import type { WorkspaceAppointment, WorkspaceInvoice } from "../../../frontend/src/api";

type DemoUser = { id: string; fullName: string; email: string; role: string; enabled: boolean };
type StaffRole = "DIETITIAN" | "DOCTOR" | "RECEPTION_STAFF" | "SYSTEM_ADMIN" | "OPERATIONS_MANAGER" | "FINANCE_EXECUTIVE" | "MEDICAL_CENTER_COORDINATOR" | "PATIENT_RELATIONS_OFFICER";
type ProvisionResult = { user: DemoUser; temporaryPassword: string };

function money(value: number) {
  return new Intl.NumberFormat("en-LK", { style: "currency", currency: "LKR", maximumFractionDigits: 0 }).format(value);
}

function generateInvoiceHTML(inv: WorkspaceInvoice): string {
  const dateStr = inv.createdAt ? new Date(inv.createdAt).toLocaleString() : new Date().toLocaleString();
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Invoice ${inv.invoiceNumber}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 30px; color: #1e293b; background: #fff; }
    .card { max-width: 750px; margin: 0 auto; border: 1px solid #cbd5e1; border-radius: 12px; padding: 36px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #059669; padding-bottom: 20px; margin-bottom: 28px; }
    .brand h1 { margin: 0; color: #059669; font-size: 24px; }
    .brand p { margin: 4px 0 0; color: #64748b; font-size: 13px; }
    .title-area { text-align: right; }
    .title-area h2 { margin: 0; color: #0f172a; font-size: 20px; text-transform: uppercase; }
    .meta { margin-top: 4px; font-size: 13px; color: #475569; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 28px; }
    .info h4 { margin: 0 0 6px; font-size: 11px; text-transform: uppercase; color: #64748b; letter-spacing: 0.5px; }
    .info p { margin: 0; font-size: 15px; font-weight: 500; color: #0f172a; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 28px; }
    th { background: #f8fafc; text-align: left; padding: 10px 14px; font-size: 12px; font-weight: 600; color: #475569; border-bottom: 1px solid #cbd5e1; }
    td { padding: 14px; font-size: 14px; color: #1e293b; border-bottom: 1px solid #f1f5f9; }
    .badge { display: inline-block; padding: 4px 12px; border-radius: 9999px; font-size: 12px; font-weight: 600; text-transform: uppercase; }
    .paid { background: #dcfce7; color: #15803d; }
    .pending { background: #fef9c3; color: #a16207; }
    .total-area { display: flex; justify-content: flex-end; align-items: center; gap: 16px; padding-top: 16px; border-top: 2px solid #e2e8f0; }
    .total-val { font-size: 22px; font-weight: 700; color: #059669; }
    .footer { margin-top: 40px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #f1f5f9; padding-top: 20px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div class="brand">
        <h1>NutriCare Connect</h1>
        <p>Medical & Healthcare Center</p>
      </div>
      <div class="title-area">
        <h2>Medical Invoice PDF</h2>
        <div class="meta"><strong>Invoice #:</strong> ${inv.invoiceNumber}</div>
        <div class="meta"><strong>Issued:</strong> ${dateStr}</div>
      </div>
    </div>
    <div class="grid">
      <div class="info">
        <h4>Patient Information</h4>
        <p>${inv.patientName}</p>
        <p style="font-size:13px; color:#64748b; font-weight:normal;">ID: ${inv.patientId || "N/A"}</p>
      </div>
      <div class="info" style="text-align: right;">
        <h4>Invoice Status</h4>
        <span class="badge ${inv.status === "PAID" ? "paid" : "pending"}">${inv.status}</span>
      </div>
    </div>
    <table>
      <thead>
        <tr>
          <th>Service Description</th>
          <th>Reference #</th>
          <th style="text-align: right;">Amount (LKR)</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>${inv.serviceType}</strong></td>
          <td>${inv.appointmentId ? `Appt #${inv.appointmentId.slice(0, 8)}` : "Direct Billing"}</td>
          <td style="text-align: right; font-weight: 600;">LKR ${Number(inv.amount).toLocaleString()}</td>
        </tr>
      </tbody>
    </table>
    <div class="total-area">
      <span style="font-size:15px; font-weight:600; color:#475569;">Total Amount Due:</span>
      <span class="total-val">LKR ${Number(inv.amount).toLocaleString()}</span>
    </div>
    <div class="footer">
      <p>Official Computer-Generated Tax Invoice — NutriCare Connect Healthcare Platform.</p>
    </div>
  </div>
</body>
</html>`;
}

function saveLocalPDFCopy(inv: WorkspaceInvoice) {
  try {
    const html = generateInvoiceHTML(inv);
    localStorage.setItem(`nutricare_pdf_${inv.id}`, html);
  } catch (e) {
    console.warn("Failed to save local PDF copy:", e);
  }
}

function removeLocalPDFCopy(invId: string) {
  try {
    localStorage.removeItem(`nutricare_pdf_${invId}`);
  } catch (e) {
    console.warn("Failed to remove local PDF copy:", e);
  }
}

function downloadOrPrintInvoicePDF(inv: WorkspaceInvoice) {
  saveLocalPDFCopy(inv);
  const html = localStorage.getItem(`nutricare_pdf_${inv.id}`) || generateInvoiceHTML(inv);
  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  
  const win = window.open(url, "_blank");
  if (win) {
    win.onload = () => { win.print(); };
  } else {
    const a = document.createElement("a");
    a.href = url;
    a.download = `${inv.invoiceNumber}.html`;
    a.click();
    URL.revokeObjectURL(url);
  }
}

export function UserAccessFeature({
  initialTab = "users",
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
  initialTab?: "users" | "invoices";
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
  const [activeTab, setActiveTab] = useState<"users" | "invoices">(initialTab);
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
  }, [activeTab, onLoadAppointments, onLoadInvoices, onLoadUsers, showCreateInvoice]);

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
      saveLocalPDFCopy(created);
      downloadOrPrintInvoicePDF(created);
      if (onLoadAppointments) {
        onLoadAppointments().then(setAppointments).catch(() => undefined);
      }
      setShowCreateInvoice(false);
      setMessage("Invoice created successfully and local PDF copy saved.");
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
      saveLocalPDFCopy(updated);
      setEditingInvoice(null);
      setMessage("Invoice updated successfully.");
    } catch (reason) { setMessage(reason instanceof Error ? reason.message : "Invoice could not be updated."); }
  }

  async function handleDeleteInvoice(id: string) {
    if (!onDeleteInvoice) return;
    if (!window.confirm("Are you sure you want to delete this invoice? The local PDF copy will also be permanently removed.")) return;
    try {
      await onDeleteInvoice(id);
      removeLocalPDFCopy(id);
      setInvoices((items) => items.filter((item) => item.id !== id));
      setMessage("Invoice deleted and local PDF copy removed successfully.");
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
                  <th>PDF Document / Actions</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => {
                  const hasCopy = Boolean(localStorage.getItem(`nutricare_pdf_${inv.id}`));
                  return (
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
                        {hasCopy && (
                          <small style={{ display: "block", color: "#059669", fontSize: "11px", marginTop: "2px", fontWeight: 600 }}>
                            ✓ Local PDF Copy
                          </small>
                        )}
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                          <button
                            className="secondary"
                            type="button"
                            style={{ padding: "4px 8px", fontSize: "12px", display: "inline-flex", alignItems: "center", gap: 4 }}
                            onClick={() => downloadOrPrintInvoicePDF(inv)}
                            title="Download or Print Local Invoice PDF Document"
                          >
                            <FileText size={13}/> PDF Copy
                          </button>
                          {isAdmin && (
                            <>
                              <button className="text-button" type="button" onClick={() => { setEditingInvoice(inv); setShowCreateInvoice(false); }}>
                                Edit
                              </button>
                              <button className="danger" type="button" onClick={() => void handleDeleteInvoice(inv.id)}>
                                <Trash2 size={13}/> Delete
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
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
                        Patient: {appt.patientName} | Doctor: {appt.practitionerName || "N/A"} | Service: {appt.serviceType} ({appt.startTime ? new Date(appt.startTime).toLocaleString([], { dateStyle: "short", timeStyle: "short" }) : ""})
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

