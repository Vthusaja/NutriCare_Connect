import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  ArrowUpRight,
  Bell,
  BellRing,
  CalendarDays,
  Check,
  ClipboardList,
  HeartHandshake,
  LayoutDashboard,
  Leaf,
  Menu,
  MessageCircle,
  Mail,
  Search,
  Settings,
  ShieldCheck,
  Star,
  X,
} from "lucide-react";
import {
  askPatientGuide,
  cancelAppointment,
  clearStoredSession,
  createAvailabilitySlot,
  createDeliveryNotice,
  createDietPlan,
  createHealthCheck,
  createInvoice,
  deleteAvailabilitySlot,
  deleteAppointment,
  deleteDietPlan,
  deleteFeedback,
  deleteHealthCheck,
  deleteInvoice,
  deleteMessage,
  deleteUser,
  fetchComplaints,
  fetchDeliveryNotices,
  fetchDietPlans,
  fetchHealthChecks,
  fetchInvoices,
  fetchMailAttempts,
  fetchMailStatus,
  fetchMessages,
  fetchNotifications,
  fetchPatientFeedback,
  fetchProgressLogs,
  fetchReportSummary,
  fetchUsers,
  fetchWorkspaceAppointments,
  fetchWorkspacePeople,
  fetchWorkspaceSlots,
  holdAppointment,
  loadStoredSession,
  logout,
  Notification,
  payAppointment,
  provisionStaff,
  Role,
  sendAdminMailTest,
  sendSecureMessage,
  Session,
  setUserEnabled,
  storedSessionRemainingMs,
  submitFeedback,
  touchStoredSession,
  updateAppointment,
  updateAvailabilitySlot,
  updateDietPlan,
  updateFeedback,
  updateHealthCheck,
  updateInvoice,
  updateMessage,
  WorkspaceAppointment,
} from "./api";
const UserAccessFeature = lazy(() => import("@nutricare/user-access").then((module) => ({ default: module.UserAccessFeature })));
const AppointmentBillingFeature = lazy(() => import("@nutricare/appointment-billing").then((module) => ({ default: module.AppointmentBillingFeature })));
const HealthCheckFeature = lazy(() => import("@nutricare/health-check").then((module) => ({ default: module.HealthCheckFeature })));
const PatientGuide = lazy(() => import("@nutricare/health-check").then((module) => ({ default: module.PatientGuide })));
const EmailTestFeature = lazy(() => import("@nutricare/health-check").then((module) => ({ default: module.EmailTestFeature })));
const DietProgressFeature = lazy(() => import("@nutricare/diet-progress").then((module) => ({ default: module.DietProgressFeature })));
const MessagingRemindersFeature = lazy(() => import("@nutricare/messaging-reminders").then((module) => ({ default: module.MessagingRemindersFeature })));
const FeedbackAnalyticsFeature = lazy(() => import("@nutricare/feedback-analytics").then((module) => ({ default: module.FeedbackAnalyticsFeature })));

type Page = "overview" | "users" | "appointments" | "health" | "diet" | "messages" | "analytics" | "email";

const nav = [
  { id: "overview" as Page, label: "Overview", icon: LayoutDashboard },
  { id: "users" as Page, label: "Patients & access", icon: ShieldCheck },
  { id: "appointments" as Page, label: "Appointments", icon: CalendarDays },
  { id: "health" as Page, label: "Health checks", icon: ClipboardList },
  { id: "diet" as Page, label: "Diet & progress", icon: Leaf },
  { id: "messages" as Page, label: "Messages", icon: MessageCircle },
  { id: "analytics" as Page, label: "Reports & feedback", icon: Star },
  { id: "email" as Page, label: "Email test", icon: Mail },
];

const roleLabels: Record<Role, string> = {
  DIETITIAN: "Dietitian",
  DOCTOR: "Doctor",
  RECEPTION_STAFF: "Reception Staff",
  SYSTEM_ADMIN: "System Administrator",
  OPERATIONS_MANAGER: "Operations Manager",
  FINANCE_EXECUTIVE: "Finance Executive",
  MEDICAL_CENTER_COORDINATOR: "Medical Center Coordinator",
  PATIENT_RELATIONS_OFFICER: "Patient Relations Officer",
  PATIENT: "Patient",
};

const rolePages: Record<Role, Page[]> = {
  DIETITIAN: ["overview", "appointments", "health", "diet", "messages", "analytics"],
  DOCTOR: ["overview", "appointments", "health", "diet", "messages"],
  RECEPTION_STAFF: ["overview", "appointments", "messages"],
  SYSTEM_ADMIN: nav.map((item) => item.id),
  OPERATIONS_MANAGER: ["overview", "appointments", "analytics"],
  FINANCE_EXECUTIVE: ["overview", "appointments", "analytics"],
  MEDICAL_CENTER_COORDINATOR: ["overview", "appointments", "health", "analytics"],
  PATIENT_RELATIONS_OFFICER: ["overview", "messages", "analytics"],
  PATIENT: ["overview", "appointments", "health", "diet", "messages", "analytics"],
};

/* â”€â”€ Format today's date dynamically â”€â”€ */
function formatToday(): string {
  const now = new Date();
  return now.toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "long" });
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

/* â”€â”€ Notification type icon helper â”€â”€ */
function notifIcon(type: string) {
  switch (type) {
    case "APPOINTMENT_REMINDER": return <CalendarDays size={16}/>;
    case "DIET_PLAN_UPDATED": return <Leaf size={16}/>;
    case "HEALTH_ALERT": return <Activity size={16}/>;
    case "PAYMENT_DUE": return <Star size={16}/>;
    default: return <BellRing size={16}/>;
  }
}

/* â”€â”€ Notification Panel â”€â”€ */
function NotificationPanel({ notifications, onMarkAllRead, onClose }: {
  notifications: Notification[];
  onMarkAllRead: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  const unreadCount = notifications.filter(n => !n.read).length;

  return <div className="notification-panel" ref={ref}>
    <div className="notif-header">
      <strong>Notifications</strong>
      {unreadCount > 0 && <button className="text-button" onClick={onMarkAllRead}><Check size={13}/> Mark all read</button>}
    </div>
    <div className="notif-list">
      {notifications.length === 0 && <div className="notif-empty">No notifications yet</div>}
      {notifications.map(n => (
        <div className={`notif-item${n.read ? "" : " unread"}`} key={n.id}>
          <span className="notif-icon">{notifIcon(n.type)}</span>
          <div className="notif-body">
            <span>{n.message}</span>
            <small>{n.time}</small>
          </div>
          {!n.read && <span className="notif-dot"/>}
        </div>
      ))}
    </div>
  </div>;
}

/* â”€â”€ Patient Overview â”€â”€ */
function PatientOverview({ go, userName, userId, loadAppointments, loadPlans, loadProgress, loadChecks }: { go: (page: Page) => void; userName: string; userId: string; loadAppointments: () => Promise<WorkspaceAppointment[]>; loadPlans: (patientId: string) => ReturnType<typeof fetchDietPlans>; loadProgress: (patientId: string) => ReturnType<typeof fetchProgressLogs>; loadChecks: (patientId: string) => ReturnType<typeof fetchHealthChecks> }) {
  const [appointments, setAppointments] = useState<WorkspaceAppointment[]>([]);
  const [plans, setPlans] = useState<Awaited<ReturnType<typeof fetchDietPlans>>>([]);
  const [progress, setProgress] = useState<Awaited<ReturnType<typeof fetchProgressLogs>>>([]);
  const [checks, setChecks] = useState<Awaited<ReturnType<typeof fetchHealthChecks>>>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    Promise.all([loadAppointments(), loadPlans(userId), loadProgress(userId), loadChecks(userId)])
      .then(([appointmentRows, planRows, progressRows, checkRows]) => { setAppointments(appointmentRows); setPlans(planRows); setProgress(progressRows); setChecks(checkRows); })
      .catch(reason => setError(reason instanceof Error ? reason.message : "Your care summary could not be loaded."));
  }, [loadAppointments, loadChecks, loadPlans, loadProgress, userId]);
  const firstName = userName.split(" ")[0];
  const today = formatToday();
  const greeting = getGreeting();
  const nextAppointment = appointments.filter(item => new Date(item.startTime).getTime() >= Date.now()).sort((a, b) => a.startTime.localeCompare(b.startTime))[0];
  const latestPlan = plans[0];
  const latestProgress = progress[progress.length - 1];
  const latestCheck = checks[0];
  return <div className="stack-xl">
    <section className="welcome"><div><span className="eyebrow">{today}</span><h1>{greeting}, {firstName}.</h1><p>Your personal summary is loaded from your NutriCare records.</p></div><div className="welcome-actions"><span className="live-pill"><i/> Personal care space</span><button className="primary" onClick={() => go("appointments")}><CalendarDays size={18}/> Book a check-up</button></div></section>
    {error && <div className="form-error">{error}</div>}
    <section className="stat-grid" aria-label="My care summary"><article className="stat-card sage"><span>Appointments</span><strong>{appointments.length}</strong><small>Records belonging to your account</small></article><article className="stat-card eucalyptus"><span>Water in latest log</span><strong>{latestProgress?.waterGlasses ?? 0}</strong><small>Saved glasses</small></article><article className="stat-card amber"><span>Diet plans</span><strong>{plans.length}</strong><small>{latestPlan?.status ?? "No plan yet"}</small></article><article className="stat-card fern"><span>Health checks</span><strong>{checks.length}</strong><small>Private saved records</small></article></section>
    <div className="dashboard-grid"><section className="panel span-2"><div className="panel-title"><div><span className="eyebrow">My next visit</span><h2>{nextAppointment ? `${nextAppointment.serviceType} with ${nextAppointment.practitionerName}` : "No upcoming appointment"}</h2></div>{nextAppointment && <span className={`status ${nextAppointment.status.toLowerCase()}`}>{nextAppointment.status}</span>}</div>{nextAppointment ? <div className="appointment-focus"><span className="calendar-date"><b>{new Date(nextAppointment.startTime).getDate()}</b><small>{new Date(nextAppointment.startTime).toLocaleDateString("en", {month:"short"}).toUpperCase()}</small></span><div><strong>{new Date(nextAppointment.startTime).toLocaleString()}</strong><p>Use Appointments to review your booking and invoice.</p></div><button className="secondary" onClick={() => go("appointments")}>View appointment</button></div> : <p>Book a check-up when you are ready.</p>}</section><section className="panel tip-card"><Leaf size={22}/><div><span className="eyebrow">Latest plan</span><h2>{latestPlan?.title ?? "No diet plan published"}</h2><p>{latestPlan ? `${latestPlan.calorieTarget ?? "â€”"} kcal Â· ${latestPlan.status}` : "Your care team has not created a plan for this account."}</p><button className="text-button" onClick={() => go("diet")}>Open my plans</button></div></section><section className="panel span-2"><div className="panel-title"><div><span className="eyebrow">My recent check</span><h2>Personal health summary</h2></div><button className="text-button" onClick={() => go("health")}>View my records</button></div><div className="metric-row"><article className="metric"><span>Weight</span><strong>{latestCheck?.weightKg ?? "â€”"} kg</strong></article><article className="metric"><span>BMI</span><strong>{latestCheck?.bmi ?? "â€”"}</strong></article><article className="metric"><span>Recorded</span><strong>{latestCheck ? new Date(latestCheck.recordedAt).toLocaleDateString() : "â€”"}</strong></article></div><div className="patient-safety-note"><ShieldCheck size={16}/> Only you and authorized members of your care team can see these records.</div></section><section className="panel care-pulse"><div className="care-ring"><span><b>{latestProgress?.mealsCompleted ?? 0}</b><small>meals</small></span></div><div><span className="eyebrow">Latest progress log</span><h2>{latestProgress ? `${latestProgress.weightKg ?? "â€”"} kg` : "No progress yet"}</h2><p>{latestProgress ? new Date(latestProgress.logDate).toLocaleDateString() : "Your saved progress will appear here."}</p></div></section></div>
  </div>;
}

/* â”€â”€ Staff Overview â”€â”€ */
function Overview({ go, role, userName, userId, loadAppointments, loadPlans, loadProgress, loadChecks }: { go: (page: Page) => void; role: Role; userName: string; userId: string; loadAppointments: () => Promise<WorkspaceAppointment[]>; loadPlans: (patientId: string) => ReturnType<typeof fetchDietPlans>; loadProgress: (patientId: string) => ReturnType<typeof fetchProgressLogs>; loadChecks: (patientId: string) => ReturnType<typeof fetchHealthChecks> }) {
  const [appointments, setAppointments] = useState<WorkspaceAppointment[]>([]);
  const [loadError, setLoadError] = useState("");
  useEffect(() => { loadAppointments().then(setAppointments).catch(reason => setLoadError(reason instanceof Error ? reason.message : "Dashboard data could not be loaded.")); }, [loadAppointments]);
  if (role === "PATIENT") return <PatientOverview go={go} userName={userName} userId={userId} loadAppointments={loadAppointments} loadPlans={loadPlans} loadProgress={loadProgress} loadChecks={loadChecks}/>;
  const firstName = userName.split(" ")[0];
  const today = formatToday();
  const greeting = getGreeting();
  const confirmed = appointments.filter(item => item.status === "CONFIRMED").length;
  const held = appointments.filter(item => item.status === "HELD").length;
  const outstanding = appointments.filter(item => item.invoiceStatus && item.invoiceStatus !== "PAID").reduce((sum, item) => sum + Number(item.amount ?? 0), 0);
  const quickStats = [
    ["Assigned appointments", String(appointments.length), "Loaded from your account", "sage"],
    ["Confirmed", String(confirmed), "Current database records", "eucalyptus"],
    ["Held", String(held), "Awaiting completion", "amber"],
    ["Outstanding", `LKR ${outstanding.toLocaleString()}`, "Unpaid visible invoices", "fern"],
  ] as const;
  return (
    <div className="stack-xl">
      <section className="welcome">
        <div>
          <span className="eyebrow">{today}</span>
          <h1>{greeting}, {firstName}.</h1>
          <p>Your care list is steady. One health alert needs attention today.</p>
        </div>
        <div className="welcome-actions">
          <span className="live-pill"><i /> Care workspace live</span>
          {(role === "DOCTOR" || role === "DIETITIAN") && <button className="primary" onClick={() => go("diet")}><Leaf size={18} /> Create diet plan</button>}
        </div>
      </section>
      <section className="stat-grid" aria-label="Daily summary">
        {quickStats.map(([label, value, detail, tone]) => (
          <article className={`stat-card ${tone}`} key={label}>
            <span>{label}</span><strong>{value}</strong><small>{detail}</small>
          </article>
        ))}
      </section>
      {loadError && <div className="form-error">{loadError}</div>}
      <div className="dashboard-grid">
        <section className="panel span-2">
          <div className="panel-title"><div><span className="eyebrow">Schedule</span><h2>Today's appointments</h2></div><button className="text-button" onClick={() => go("appointments")}>View calendar</button></div>
          <div className="timeline">{appointments.slice(0, 4).map(item => <button className="timeline-row" key={item.id} onClick={() => go("appointments")}><time>{new Date(item.startTime).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})}</time><span className="avatar">{item.patientName[0]}</span><span className="grow"><strong>{item.patientName}</strong><small>{item.serviceType}</small></span><span className={`status ${item.status.toLowerCase()}`}>{item.status}</span></button>)}{appointments.length === 0 && <div className="list-item"><span className="grow"><strong>No assigned appointments</strong><small>New records will appear here from the database.</small></span></div>}</div>
        </section>
        <section className="panel alert-panel"><div className="panel-title"><div><span className="eyebrow">Account scope</span><h2>Live database view</h2></div><span className="count">{appointments.length}</span></div><div className="success-note">Only records assigned to {userName} are included in these totals.</div></section>
        <section className="panel span-2">
          <div className="panel-title"><div><span className="eyebrow">Care progress</span><h2>Patients to follow up</h2></div></div>
          <div className="patient-grid">{appointments.slice(0, 3).map(item => <button className="patient-card" key={item.id} onClick={() => go("diet")}><span className="avatar large">{item.patientName[0]}</span><span><strong>{item.patientName}</strong><small>{item.serviceType}</small></span><b>{item.status}</b></button>)}{appointments.length === 0 && <p>No patients are linked to this account yet.</p>}</div>
        </section>
        <section className="panel tip-card"><Activity size={22}/><div><span className="eyebrow">Current workload</span><h2>{confirmed} confirmed visits</h2><p>Calculated from the records visible to this signed-in account.</p></div></section>
        <section className="panel care-pulse" style={{ gridColumn: "1 / -1" }}>
          <div className="care-ring"><span><b>{appointments.length}</b><small>records</small></span></div>
          <div><span className="eyebrow">Care workspace</span><h2>Database synchronized</h2><p>The dashboard refreshes from Spring Boot whenever you sign in.</p>{rolePages[role].includes("analytics") && <button className="text-button" onClick={() => go("analytics")}>Open progress report <ArrowUpRight size={13}/></button>}</div>
        </section>
      </div>
    </div>
  );
}

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ App Shell â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

export function App() {
  const [session, setSession] = useState<Session | null>(() => loadStoredSession());
  const [page, setPage] = useState<Page>("overview");
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notifyOpen, setNotifyOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const accountRef = useRef<HTMLDivElement>(null);
  const role = session?.user.role ?? "PATIENT";
  const visibleNav = useMemo(() => nav.filter((item) => rolePages[role].includes(item.id)), [role]);
  const current = nav.find((item) => item.id === page) ?? nav[0];

  useEffect(() => {
    if (!rolePages[role].includes(page)) setPage("overview");
  }, [page, role]);

  /* Expire session after 30 minutes (absolute) or 30 minutes idle */
  useEffect(() => {
    if (!session) return;

    function expire() {
      clearStoredSession();
      setSession(null);
      setPage("overview");
      setNotifications([]);
      setAccountOpen(false);
      setNotifyOpen(false);
    }

    function schedule(): number | null {
      const remaining = storedSessionRemainingMs();
      if (remaining <= 0) {
        expire();
        return null;
      }
      return window.setTimeout(expire, remaining);
    }

    let timer = schedule();
    let lastTouch = 0;

    function onActivity() {
      const now = Date.now();
      if (now - lastTouch < 15_000) return;
      lastTouch = now;
      const remaining = touchStoredSession();
      if (remaining <= 0) {
        expire();
        return;
      }
      if (timer != null) window.clearTimeout(timer);
      timer = window.setTimeout(expire, remaining);
    }

    const events: Array<keyof WindowEventMap> = ["pointerdown", "keydown", "mousemove", "scroll", "touchstart"];
    events.forEach((event) => window.addEventListener(event, onActivity, { passive: true }));
    return () => {
      if (timer != null) window.clearTimeout(timer);
      events.forEach((event) => window.removeEventListener(event, onActivity));
    };
  }, [session]);

  /* Load notifications when session starts */
  useEffect(() => {
    if (session) fetchNotifications(session).then(setNotifications);
  }, [session]);

  /* Close account menu on outside click */
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (accountOpen && accountRef.current && !accountRef.current.contains(e.target as Node)) setAccountOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [accountOpen]);

  const closeNotify = useCallback(() => setNotifyOpen(false), []);
  const requireSession = useCallback(() => {
    if (!session) throw new Error("Sign in to continue");
    return session;
  }, [session]);
  const loadUsers = useCallback(() => fetchUsers(requireSession()), [requireSession]);
  const toggleUser = useCallback((id: string, enabled: boolean) => setUserEnabled(requireSession(), id, enabled), [requireSession]);
  const removeUser = useCallback((id: string) => deleteUser(requireSession(), id), [requireSession]);
  const loadInvoices = useCallback(() => fetchInvoices(requireSession()), [requireSession]);
  const saveInvoice = useCallback((details: { appointmentId: string; amount: number; status?: string }) => createInvoice(requireSession(), details), [requireSession]);
  const editInvoice = useCallback((id: string, details: { amount: number; status: string }) => updateInvoice(requireSession(), id, details), [requireSession]);
  const removeInvoice = useCallback((id: string) => deleteInvoice(requireSession(), id), [requireSession]);
  const loadPeople = useCallback(() => fetchWorkspacePeople(requireSession()), [requireSession]);
  const loadAppointments = useCallback(() => fetchWorkspaceAppointments(requireSession()), [requireSession]);
  const loadSlots = useCallback((date: string) => fetchWorkspaceSlots(requireSession(), date), [requireSession]);
  const createBooking = useCallback((details: { slotId: string; patientId: string; serviceType: string; amount: number }) => holdAppointment(requireSession(), details), [requireSession]);
  const createSlot = useCallback((details: { practitionerId?: string; startTime: string; durationMinutes: number }) => createAvailabilitySlot(requireSession(), details), [requireSession]);
  const updateSlot = useCallback((id: string, details: { startTime: string; durationMinutes: number }) => updateAvailabilitySlot(requireSession(), id, details), [requireSession]);
  const deleteSlot = useCallback((id: string) => deleteAvailabilitySlot(requireSession(), id), [requireSession]);
  const cancelBooking = useCallback((id: string) => cancelAppointment(requireSession(), id), [requireSession]);
  const editAppointment = useCallback((id: string, details: { serviceType?: string; status?: string; amount?: number }) => updateAppointment(requireSession(), id, details), [requireSession]);
  const payBooking = useCallback((id: string, details: { amount: number; method: string; status: string }) => payAppointment(requireSession(), id, details), [requireSession]);
  const loadPlans = useCallback((patientId: string) => fetchDietPlans(requireSession(), patientId), [requireSession]);
  const loadProgress = useCallback((patientId: string) => fetchProgressLogs(requireSession(), patientId), [requireSession]);
  const savePlan = useCallback((plan: { patientId: string; title: string; calorieTarget: number; exclusions?: string; mealSchedule: string }) => createDietPlan(requireSession(), plan), [requireSession]);
  const editPlan = useCallback((id: string, plan: { title: string; calorieTarget: number; exclusions?: string; mealSchedule: string; status?: string }) => updateDietPlan(requireSession(), id, plan), [requireSession]);
  const removePlan = useCallback((id: string) => deleteDietPlan(requireSession(), id), [requireSession]);
  const loadChecks = useCallback((patientId: string) => fetchHealthChecks(requireSession(), patientId), [requireSession]);
  const saveCheck = useCallback((check: { patientId: string; weightKg: number; bmi: number; systolic?: number; diastolic?: number; bloodSugar: number; temperature: number; notes?: string }) => createHealthCheck(requireSession(), check), [requireSession]);
  const editCheck = useCallback((id: string, check: { weightKg: number; bmi: number; systolic?: number; diastolic?: number; bloodSugar: number; temperature: number; notes?: string }) => updateHealthCheck(requireSession(), id, check), [requireSession]);
  const removeCheck = useCallback((id: string) => deleteHealthCheck(requireSession(), id), [requireSession]);
  const loadMessages = useCallback((patientId: string) => fetchMessages(requireSession(), patientId), [requireSession]);
  const postMessage = useCallback((details: { senderId: string; recipientId: string; patientId: string; body: string }) => sendSecureMessage(requireSession(), details), [requireSession]);
  const editMessage = useCallback((id: string, body: string) => updateMessage(requireSession(), id, body), [requireSession]);
  const removeMessage = useCallback((id: string) => deleteMessage(requireSession(), id), [requireSession]);
  const loadNotices = useCallback((recipientId: string) => fetchDeliveryNotices(requireSession(), recipientId), [requireSession]);
  const postNotice = useCallback((details: { recipientId: string; type: string; channel: "IN_APP" | "EMAIL" | "SMS"; message: string; simulateFailure?: boolean }) => createDeliveryNotice(requireSession(), details), [requireSession]);
  const postFeedback = useCallback((details: { patientId: string; practitionerId: string; appointmentId: string; rating: number; comments?: string }) => submitFeedback(requireSession(), details), [requireSession]);
  const loadFeedback = useCallback((patientId: string) => fetchPatientFeedback(requireSession(), patientId), [requireSession]);
  const editFeedback = useCallback((id: string, details: { rating: number; comments?: string }) => updateFeedback(requireSession(), id, details), [requireSession]);
  const removeFeedback = useCallback((id: string) => deleteFeedback(requireSession(), id), [requireSession]);
  const loadComplaints = useCallback(() => fetchComplaints(requireSession()), [requireSession]);
  const loadReport = useCallback((from: string, to: string) => fetchReportSummary(requireSession(), from, to), [requireSession]);
  const loadMailStatus = useCallback(() => fetchMailStatus(requireSession()), [requireSession]);
  const loadMailAttempts = useCallback(() => fetchMailAttempts(requireSession()), [requireSession]);
  const postMailTest = useCallback((to: string) => sendAdminMailTest(requireSession(), to), [requireSession]);

  if (!session) return <LoginScreen onLogin={setSession}/>;

  async function signOut() {
    await logout(session!);
    setAccountOpen(false);
    setNotifyOpen(false);
    setSession(null);
    setPage("overview");
    setNotifications([]);
  }

  if (session.user.mustChangePassword) {
    return <RequiredPasswordChange session={session} onChange={setSession} onLogout={signOut}/>;
  }

  function markAllRead() {
    setNotifications(items => items.map(n => ({ ...n, read: true })));
  }

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className="app-shell">
      <aside className={menuOpen ? "sidebar open" : "sidebar"}>
        <div className="brand"><span className="brand-mark"><Leaf size={22} /></span><span><b>NutriCare</b><small>CONNECT</small></span><button className="icon mobile-only" onClick={() => setMenuOpen(false)} aria-label="Close menu"><X /></button></div>
        <nav aria-label="Main navigation">
          <p>Workspace</p>
          {visibleNav.map((item) => <button key={item.id} className={page === item.id ? "active" : ""} onClick={() => { setPage(item.id); setMenuOpen(false); }}><item.icon size={19} /><span>{item.label}</span>{item.id === "messages" && unreadCount > 0 && <em>{unreadCount}</em>}</button>)}
        </nav>
        <div className="sidebar-foot"><HeartHandshake size={18} /><span><b>Care with clarity</b><small>Secure patient data</small></span></div>
      </aside>
      <main>
        <header className="topbar">
          <div className="topbar-title"><button className="icon mobile-only" onClick={() => setMenuOpen(true)} aria-label="Open menu"><Menu /></button><current.icon size={20} /><strong>{current.label}</strong></div>
          <div className="topbar-actions">
            <label className="search"><Search size={17} /><input aria-label="Search patients" placeholder="Search patientsâ€¦" /></label>
            <div className="notify-area">
              <button className="icon notify" aria-label="Notifications" onClick={() => setNotifyOpen(v => !v)}>
                <Bell size={19} />
                {unreadCount > 0 && <span />}
              </button>
              {notifyOpen && <NotificationPanel notifications={notifications} onMarkAllRead={markAllRead} onClose={closeNotify}/>}
            </div>
            <div className="account-area" ref={accountRef}><button className="account-trigger" onClick={() => setAccountOpen((value) => !value)} aria-expanded={accountOpen}><span className="avatar">{session.user.fullName[0]}</span><span><strong>{session.user.fullName}</strong><small>{roleLabels[role]}</small></span></button>{accountOpen && <div className="account-menu"><button onClick={() => { setProfileOpen(true); setAccountOpen(false); }}><Settings size={16}/><span><strong>Edit profile</strong><small>Name, phone and contact details</small></span></button><button onClick={signOut}><X size={16}/><span><strong>Sign out</strong><small>End this session safely</small></span></button></div>}</div>
          </div>
        </header>
        <div className="content">
          <Suspense fallback={<section className="panel empty">Preparing your care workspaceâ€¦</section>}>
            {page === "overview" && <Overview go={setPage} role={role} userName={session.user.fullName} userId={session.user.id} loadAppointments={loadAppointments} loadPlans={loadPlans} loadProgress={loadProgress} loadChecks={loadChecks} />}
            {page === "users" && <UserAccessFeature isAdmin={role === "SYSTEM_ADMIN"} onProvision={(details) => provisionStaff(session, details.fullName, details.email, details.role)} onLoadUsers={loadUsers} onToggleUser={toggleUser} onDeleteUser={removeUser} onLoadInvoices={loadInvoices} onCreateInvoice={saveInvoice} onUpdateInvoice={editInvoice} onDeleteInvoice={removeInvoice} onLoadAppointments={loadAppointments} />}
            {page === "appointments" && <AppointmentBillingFeature role={role} currentUserId={session.user.id} userName={session.user.fullName} loadAppointments={loadAppointments} loadSlots={loadSlots} loadPeople={loadPeople} createBooking={createBooking} createSlot={createSlot} updateSlot={updateSlot} deleteSlot={deleteSlot} cancelAppointment={cancelBooking} updateAppointment={editAppointment} payAppointment={payBooking} />}
            {page === "health" && <HealthCheckFeature patientOnly={role === "PATIENT"} userName={session.user.fullName} currentUserId={session.user.id} loadPeople={loadPeople} loadChecks={loadChecks} saveCheck={saveCheck} updateCheck={editCheck} deleteCheck={removeCheck} />}
            {page === "diet" && <DietProgressFeature canManagePlans={role === "DIETITIAN" || role === "DOCTOR"} currentUserId={session.user.id} loadPeople={loadPeople} loadPlans={loadPlans} loadProgress={loadProgress} savePlan={savePlan} updatePlan={editPlan} deletePlan={removePlan} />}
            {page === "messages" && <MessagingRemindersFeature patientOnly={role === "PATIENT"} currentUserId={session.user.id} userName={session.user.fullName} loadPeople={loadPeople} loadMessages={loadMessages} sendMessage={postMessage} updateMessage={editMessage} deleteMessage={removeMessage} loadNotices={loadNotices} createNotice={postNotice} />}
            {page === "analytics" && <FeedbackAnalyticsFeature patientOnly={role === "PATIENT"} currentUserId={session.user.id} loadAppointments={loadAppointments} loadFeedback={loadFeedback} submitFeedback={postFeedback} updateFeedback={editFeedback} deleteFeedback={removeFeedback} loadComplaints={loadComplaints} loadReport={loadReport} />}
            {page === "email" && role === "SYSTEM_ADMIN" && <EmailTestFeature defaultEmail={session.user.email} loadStatus={loadMailStatus} loadAttempts={loadMailAttempts} sendTest={postMailTest} />}
          </Suspense>
        </div>
      </main>
      {profileOpen && <ProfileModal session={session} onClose={() => setProfileOpen(false)} onChange={setSession}/>} 
      {role === "PATIENT" && <Suspense fallback={null}><PatientGuide userName={session.user.fullName} ask={(question, history) => askPatientGuide(session, question, history)} go={setPage} editProfile={() => setProfileOpen(true)}/></Suspense>}
    </div>
  );
}

