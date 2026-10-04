export type Role = "DIETITIAN" | "DOCTOR" | "RECEPTION_STAFF" | "SYSTEM_ADMIN" | "OPERATIONS_MANAGER" | "FINANCE_EXECUTIVE" | "MEDICAL_CENTER_COORDINATOR" | "PATIENT_RELATIONS_OFFICER" | "PATIENT";

export type SessionUser = {
  id: string;
  fullName: string;
  email: string;
  phoneNumber?: string;
  dateOfBirth?: string;
  address?: string;
  role: Role;
  enabled: boolean;
  mustChangePassword: boolean;
};

export type Session = { token: string | null; user: SessionUser; demo: boolean };

/** Absolute/idle client session window Ã¢â‚¬â€ aligned with JWT lifetime. */
export const SESSION_TTL_MS = 30 * 60 * 1000;
const SESSION_STORAGE_KEY = "nutricare.session";

type StoredSession = { session: Session; expiresAt: number; lastActiveAt: number };

function readStored(): StoredSession | null {
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StoredSession;
  } catch {
    return null;
  }
}

function isExpired(stored: StoredSession, now = Date.now()): boolean {
  if (!stored?.session || !stored.expiresAt || stored.expiresAt <= now) return true;
  const lastActive = stored.lastActiveAt ?? stored.expiresAt - SESSION_TTL_MS;
  return now - lastActive > SESSION_TTL_MS;
}

/** Persist a newly issued login/register session (starts a fresh 30-minute window). */
export function saveSession(session: Session): void {
  const now = Date.now();
  const payload: StoredSession = { session, expiresAt: now + SESSION_TTL_MS, lastActiveAt: now };
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(payload));
}

/** Update stored user/token without extending absolute expiry. */
export function updateStoredSession(session: Session): void {
  const existing = readStored();
  if (!existing || isExpired(existing)) {
    saveSession(session);
    return;
  }
  localStorage.setItem(
    SESSION_STORAGE_KEY,
    JSON.stringify({ ...existing, session, lastActiveAt: Date.now() }),
  );
}

export function clearStoredSession(): void {
  localStorage.removeItem(SESSION_STORAGE_KEY);
}

export function loadStoredSession(): Session | null {
  const stored = readStored();
  if (!stored || isExpired(stored)) {
    clearStoredSession();
    return null;
  }
  return stored.session;
}

/** Refresh idle clock without extending past absolute expiry. Returns remaining ms, or 0 if expired. */
export function touchStoredSession(): number {
  const stored = readStored();
  if (!stored || isExpired(stored)) {
    clearStoredSession();
    return 0;
  }
  const now = Date.now();
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({ ...stored, lastActiveAt: now }));
  return stored.expiresAt - now;
}

export function storedSessionRemainingMs(): number {
  const stored = readStored();
  if (!stored || isExpired(stored)) return 0;
  return stored.expiresAt - Date.now();
}

export type Notification = {
  id: string;
  type: string;
  message: string;
  time: string;
  read: boolean;
};

export type WorkspacePerson = { id: string; fullName: string; role: Role; enabled: boolean };
export type WorkspaceAppointment = {
  id: string; patientId: string; patientName: string; practitionerId: string; practitionerName: string;
  serviceType: string; status: string; startTime: string; invoiceNumber?: string; amount?: number; invoiceStatus?: string;
};
export type WorkspaceSlot = {
  id: string; practitionerId: string; practitionerName: string; startTime: string; durationMinutes: number; status: string;
};
export type DietPlan = {
  id: string; patientId: string; dietitianId: string; title: string; calorieTarget?: number;
  exclusions?: string; mealSchedule: string; status: string; createdAt: string;
};
export type ProgressLog = { id: string; patientId: string; dietPlanId?: string; logDate: string; weightKg?: number; bmi?: number; waterGlasses?: number; mealsCompleted?: number };
export type HealthCheck = {
  id: string; patientId: string; practitionerId: string; weightKg?: number; bmi?: number;
  systolic?: number; diastolic?: number; bloodSugar?: number; temperature?: number;
  notes?: string; recordedAt: string;
};
export type HealthCheckResult = { check: HealthCheck; alerts: Array<{ id: string; priority: string; message: string }>; disclaimer: string };

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? import.meta.env.VITE_API_URL ?? "/api/v1";

/* Ã¢â€â‚¬Ã¢â€â‚¬ Authentication Ã¢â€â‚¬Ã¢â€â‚¬ */
export async function login(email: string, password: string): Promise<Session> {
  try {
    const response = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error((await response.json().catch(() => ({}))).message ?? "Invalid email or password");
    const result = await response.json();
    const session: Session = { token: result.token, user: result.user, demo: false };
    saveSession(session);
    return session;
  } catch (error) {
    if (error instanceof TypeError || (error instanceof DOMException && error.name === "TimeoutError")) {
      throw new Error("Cannot reach the NutriCare backend. Confirm Spring Boot is running on port 8080.");
    }
    throw error instanceof Error ? error : new Error("Unable to sign in");
  }
}

export async function register(fullName: string, email: string, password: string, phoneNumber?: string, dateOfBirth?: string): Promise<Session> {
  try {
    const response = await fetch(`${API_BASE}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fullName, email, password, phoneNumber, dateOfBirth }),
      signal: AbortSignal.timeout(3000),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.message ?? "Registration failed. Please try again.");
    }
    const result = await response.json();
    const session: Session = { token: result.token, user: result.user, demo: false };
    saveSession(session);
    return session;
  } catch (error) {
    throw error instanceof Error ? error : new Error("Registration failed");
  }
}

export async function requestPasswordReset(email: string): Promise<{ message: string; demoOtp?: string }> {
  try {
    const response = await fetch(`${API_BASE}/auth/forgot-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.message ?? "The reset email could not be sent. Please check the mail configuration.");
    }
    return response.json();
  } catch (error) {
    if (error instanceof TypeError || (error instanceof DOMException && error.name === "TimeoutError")) {
      throw new Error("Cannot reach the NutriCare backend. Start the NutriCare Backend configuration in IntelliJ and try again.");
    }
    throw error instanceof Error ? error : new Error("The reset request failed.");
  }
}

export async function resetPassword(email: string, otp: string, newPassword: string): Promise<void> {
  const response = await fetch(`${API_BASE}/auth/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, otp, newPassword }),
  });
  if (!response.ok) throw new Error((await response.json().catch(() => ({}))).message ?? "Invalid or expired reset code");
}

export async function changePassword(session: Session, currentPassword: string, newPassword: string): Promise<Session> {
  if (!session.token) return { ...session, user: { ...session.user, mustChangePassword: false } };
  const response = await fetch(`${API_BASE}/auth/change-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.token}` },
    body: JSON.stringify({ currentPassword, newPassword }),
  });
  if (!response.ok) throw new Error((await response.json().catch(() => ({}))).message ?? "Password could not be changed");
  const next: Session = { ...session, user: await response.json() };
  updateStoredSession(next);
  return next;
}

export async function provisionStaff(session: Session, fullName: string, email: string, role: Role) {
  if (!session.token) {
    throw new Error("The backend is required to create staff accounts");
  }
  const response = await fetch(`${API_BASE}/users/staff`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.token}` },
    body: JSON.stringify({ fullName, email, role }),
  });
  if (!response.ok) throw new Error((await response.json().catch(() => ({}))).message ?? "Staff account could not be created");
  return response.json() as Promise<{ user: SessionUser; temporaryPassword: string }>;
}

async function authenticated<T>(session: Session, path: string, init?: RequestInit): Promise<T> {
  if (!session.token) throw new Error("The backend is required for this action");
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.token}`, ...init?.headers },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.message ?? `Request failed (${response.status})`);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export function fetchUsers(session: Session): Promise<SessionUser[]> {
  return authenticated(session, "/users");
}

export function setUserEnabled(session: Session, id: string, enabled: boolean): Promise<SessionUser> {
  return authenticated(session, `/users/${id}/status`, { method: "PATCH", body: JSON.stringify({ enabled }) });
}

export function deleteUser(session: Session, id: string): Promise<void> {
  return authenticated(session, `/users/${id}`, { method: "DELETE" });
}

export function fetchWorkspacePeople(session: Session): Promise<WorkspacePerson[]> {
  return authenticated(session, "/workspace/people");
}

export function fetchWorkspaceAppointments(session: Session): Promise<WorkspaceAppointment[]> {
  return authenticated(session, "/workspace/appointments");
}

export function fetchWorkspaceSlots(session: Session, date: string): Promise<WorkspaceSlot[]> {
  return authenticated(session, `/workspace/slots?date=${encodeURIComponent(date)}`);
}

export function holdAppointment(session: Session, details: { slotId: string; patientId: string; serviceType: string; amount: number }) {
  return authenticated(session, "/appointments/hold", { method: "POST", body: JSON.stringify(details) });
}
export function createAvailabilitySlot(session: Session, details: { practitionerId?: string; startTime: string; durationMinutes: number }) {
  return authenticated(session, "/workspace/slots", { method: "POST", body: JSON.stringify(details) });
}

export function updateAvailabilitySlot(session: Session, id: string, details: { startTime: string; durationMinutes: number }) {
  return authenticated(session, `/workspace/slots/${id}`, { method: "PUT", body: JSON.stringify(details) });
}

export async function deleteAvailabilitySlot(session: Session, id: string): Promise<void> {
  await authenticated(session, `/workspace/slots/${id}`, { method: "DELETE" });
}

export function updateAppointment(session: Session, id: string, details: { serviceType?: string; status?: string; amount?: number }): Promise<unknown> {
  return authenticated(session, `/appointments/${id}`, { method: "PUT", body: JSON.stringify(details) });
}

export async function cancelAppointment(session: Session, id: string): Promise<void> {
  await authenticated(session, `/appointments/${id}`, { method: "DELETE" });
}

export async function deleteAppointment(session: Session, id: string): Promise<void> {
  await authenticated(session, `/appointments/${id}`, { method: "DELETE" });
}

export function payAppointment(session: Session, id: string, details: { amount: number; method: string; status: string }) {
  return authenticated(session, `/appointments/${id}/payments`, { method: "POST", body: JSON.stringify(details) });
}


export function createDietPlan(session: Session, plan: { patientId: string; title: string; calorieTarget: number; exclusions?: string; mealSchedule: string }): Promise<DietPlan> {
  return authenticated(session, "/diet-plans", { method: "POST", body: JSON.stringify(plan) });
}

export function updateDietPlan(session: Session, id: string, plan: { title: string; calorieTarget: number; exclusions?: string; mealSchedule: string; status?: string }): Promise<DietPlan> {
  return authenticated(session, `/diet-plans/${id}`, { method: "PUT", body: JSON.stringify(plan) });
}

export function deleteDietPlan(session: Session, id: string): Promise<void> {
  return authenticated(session, `/diet-plans/${id}`, { method: "DELETE" });
}

export function fetchDietPlans(session: Session, patientId: string): Promise<DietPlan[]> {
  return authenticated(session, `/diet-plans/patient/${patientId}`);
}

export function fetchProgressLogs(session: Session, patientId: string): Promise<ProgressLog[]> {
  return authenticated(session, `/progress-logs/patient/${patientId}`);
}

export function fetchHealthChecks(session: Session, patientId: string): Promise<HealthCheck[]> {
  return authenticated(session, `/checkups/patient/${patientId}`);
}

export function createHealthCheck(session: Session, check: {
  patientId: string; weightKg: number; bmi: number; systolic?: number; diastolic?: number;
  bloodSugar: number; temperature: number; notes?: string;
}): Promise<HealthCheckResult> {
  return authenticated(session, "/checkups", {
    method: "POST",
    body: JSON.stringify(check),
  });
}

export function updateHealthCheck(session: Session, id: string, check: {
  weightKg: number; bmi: number; systolic?: number; diastolic?: number;
  bloodSugar: number; temperature: number; notes?: string;
}): Promise<HealthCheckResult> {
  return authenticated(session, `/checkups/${id}`, {
    method: "PUT",
    body: JSON.stringify(check),
  });
}

export function deleteHealthCheck(session: Session, id: string): Promise<void> {
  return authenticated(session, `/checkups/${id}`, { method: "DELETE" });
}

/* Ã¢â€â‚¬Ã¢â€â‚¬ Profile Ã¢â€â‚¬Ã¢â€â‚¬ */
export async function updateProfile(session: Session, updates: Partial<SessionUser>): Promise<Session> {
  if (!session.token) return { ...session, user: { ...session.user, ...updates } };
  const response = await fetch(`${API_BASE}/users/me`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.token}` },
    body: JSON.stringify({ ...session.user, ...updates }),
  });
  if (!response.ok) throw new Error("Profile could not be updated");
  const next: Session = { ...session, user: await response.json() };
  updateStoredSession(next);
  return next;
}

/* Ã¢â€â‚¬Ã¢â€â‚¬ Session Ã¢â€â‚¬Ã¢â€â‚¬ */
export async function logout(session: Session) {
  clearStoredSession();
  if (!session.token) return;
  await fetch(`${API_BASE}/auth/logout`, { method: "POST", headers: { Authorization: `Bearer ${session.token}` } }).catch(() => undefined);
}

/* Ã¢â€â‚¬Ã¢â€â‚¬ Messages & notifications Ã¢â€â‚¬Ã¢â€â‚¬ */
export type SecureMessage = {
  id: string;
  senderId: string;
  recipientId: string;
  patientId: string;
  body: string;
  sentAt: string;
};

export type DeliveryNotice = {
  id: string;
  recipientId: string;
  type: string;
  channel: string;
  message: string;
  status: string;
  createdAt: string;
};

export function fetchMessages(session: Session, patientId: string): Promise<SecureMessage[]> {
  return authenticated(session, `/messages/patient/${patientId}`);
}

export function sendSecureMessage(session: Session, details: {
  senderId: string; recipientId: string; patientId: string; body: string;
}): Promise<SecureMessage> {
  return authenticated(session, "/messages", { method: "POST", body: JSON.stringify(details) });
}

export function updateMessage(session: Session, id: string, body: string): Promise<SecureMessage> {
  return authenticated(session, `/messages/${id}`, { method: "PUT", body: JSON.stringify({ body }) });
}

export function deleteMessage(session: Session, id: string): Promise<void> {
  return authenticated(session, `/messages/${id}`, { method: "DELETE" });
}

export function fetchDeliveryNotices(session: Session, recipientId: string): Promise<DeliveryNotice[]> {
  return authenticated(session, `/notifications/recipient/${recipientId}`);
}

export function createDeliveryNotice(session: Session, details: {
  recipientId: string; type: string; channel: "IN_APP" | "EMAIL" | "SMS"; message: string; simulateFailure?: boolean;
}): Promise<DeliveryNotice> {
  return authenticated(session, "/notifications", { method: "POST", body: JSON.stringify(details) });
}

export type WorkspaceInvoice = {
  id: string;
  invoiceNumber: string;
  appointmentId: string;
  patientId: string;
  patientName: string;
  serviceType: string;
  amount: number;
  status: string;
  createdAt: string;
};

export function fetchInvoices(session: Session): Promise<WorkspaceInvoice[]> {
  return authenticated(session, "/workspace/invoices");
}

export function createInvoice(session: Session, details: { appointmentId: string; amount: number; status?: string }): Promise<WorkspaceInvoice> {
  return authenticated(session, "/workspace/invoices", { method: "POST", body: JSON.stringify(details) });
}

export function updateInvoice(session: Session, id: string, details: { amount: number; status: string }): Promise<WorkspaceInvoice> {
  return authenticated(session, `/workspace/invoices/${id}`, { method: "PUT", body: JSON.stringify(details) });
}

export function deleteInvoice(session: Session, id: string): Promise<void> {
  return authenticated(session, `/workspace/invoices/${id}`, { method: "DELETE" });
}

export type FeedbackEntry = {
  id: string;
  patientId: string;
  practitionerId: string;
  appointmentId: string;
  rating: number;
  comments?: string;
  createdAt?: string;
};

export type FeedbackResult = {
  feedback: FeedbackEntry;
  complaint?: { id: string; feedbackId: string; priority: string; status: string } | null;
};

export type ReportSummary = {
  from: string; to: string; users: number; appointments: number; completedPayments: number;
  openAlerts: number; publishedPlans: number; feedback: number; averageRating: number;
};

export type Complaint = { id: string; feedbackId: string; priority: string; status: string; createdAt?: string };

export function submitFeedback(session: Session, details: {
  patientId: string; practitionerId: string; appointmentId: string; rating: number; comments?: string;
}): Promise<FeedbackResult> {
  return authenticated(session, "/feedback", { method: "POST", body: JSON.stringify(details) });
}

export function fetchPatientFeedback(session: Session, patientId: string): Promise<FeedbackEntry[]> {
  return authenticated(session, `/feedback/patient/${patientId}`);
}

export function updateFeedback(session: Session, id: string, details: {
  rating: number; comments?: string;
}): Promise<FeedbackResult> {
  return authenticated(session, `/feedback/${id}`, { method: "PUT", body: JSON.stringify(details) });
}

export function deleteFeedback(session: Session, id: string): Promise<void> {
  return authenticated(session, `/feedback/${id}`, { method: "DELETE" });
}

export function fetchComplaints(session: Session): Promise<Complaint[]> {
  return authenticated(session, "/complaints");
}

export function fetchReportSummary(session: Session, from: string, to: string): Promise<ReportSummary> {
  return authenticated(session, `/reports/summary?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
}

/* Ã¢â€â‚¬Ã¢â€â‚¬ Admin email test Ã¢â€â‚¬Ã¢â€â‚¬ */
export type MailStatus = {
  liveEmailEnabled: boolean;
  fromAddress: string;
  mode: string;
};

export type MailAttempt = {
  id: string;
  recipientEmail: string;
  template: string;
  status: string;
  messagePreview: string;
  createdAt: string;
};

export function fetchMailStatus(session: Session): Promise<MailStatus> {
  return authenticated(session, "/admin/mail/status");
}

export function fetchMailAttempts(session: Session): Promise<MailAttempt[]> {
  return authenticated(session, "/admin/mail/attempts");
}

export function sendAdminMailTest(session: Session, to: string): Promise<MailAttempt> {
  return authenticated(session, "/admin/mail/test", {
    method: "POST",
    body: JSON.stringify({ to }),
  });
}

export async function fetchNotifications(session: Session): Promise<Notification[]> {
  if (!session.token) return [];
  try {
    const items = await fetchDeliveryNotices(session, session.user.id);
    return items.map(item => ({
      id: item.id,
      type: item.type,
      message: item.message,
      time: item.createdAt ? new Date(item.createdAt).toLocaleString() : "",
      read: item.status === "READ",
    }));
  } catch { /* fall through */ }
  return [];
}

/* Ã¢â€â‚¬Ã¢â€â‚¬ Patient guide Ã¢â€â‚¬Ã¢â€â‚¬ */
export type GuideMessage = { from: string; text: string };
type GuideReply = { answer: string; suggestedDestinations: string[]; source: "GEMINI" | "LOCAL"; urgency?: "EMERGENCY" | "URGENT" | "ROUTINE"; emergencyNumber?: string };

/* Step-by-step guidance for multi-step flows */
const profileSteps = [
  "Click your name in the top-right corner of the screen to open the account menu.",
  "Select \"Edit profile\" from the dropdown menu.",
  "Update your name, email, phone number, date of birth, or address in the form.",
  "Click \"Save profile\" to apply your changes. You'll see a confirmation message.",
];

const appointmentSteps = [
  "Click \"Appointments\" in the left sidebar to open the appointments page.",
  "Browse the available consultation times and select one that works for you.",
  "Fill in the booking form with the patient name and choose a practitioner.",
  "Click \"Hold slot & generate invoice\" to confirm. The slot is reserved for 10 minutes.",
];

const dietSteps = [
  "Click \"Diet & progress\" in the left sidebar.",
  "Review your current meal plan and mark meals as completed by clicking on them.",
  "Track your water intake using the \"+ Add water\" button.",
  "Check the weight progress chart on the right to see your weekly trend.",
];

const feedbackSteps = [
  "Click \"Reports & feedback\" in the left sidebar.",
  "Under \"Record feedback\", select a star rating from 1 to 5.",
  "Write your comments or complaint in the text box.",
  "Click \"Submit feedback\" Ã¢â‚¬â€ if the rating is 2 or below, a complaint ticket is created automatically.",
];

type TopicKey = "profile" | "appointments" | "diet" | "health" | "messages" | "feedback" | "emergency" | null;

const topicSteps: Record<string, string[]> = {
  profile: profileSteps,
  appointments: appointmentSteps,
  diet: dietSteps,
  feedback: feedbackSteps,
};

/* Detect which topic the user is asking about */
function detectTopic(text: string): TopicKey {
  if (/emergency|chest (pain|pressure)|cannot breathe|can't breathe|not breathing|unconscious|passed out|stroke|face drooping|seizure|severe bleeding|overdose|poison|anaphylaxis|self harm|suicide|kill myself|ambulance/.test(text)) return "emergency";
  if (/profile|name|phone|address|email|update.*(?:my|the)|change.*(?:my|the)|edit.*(?:my|the)|account.*setting/.test(text)) return "profile";
  if (/book|appointment|check.?up|schedule|slot|consultation|cancel.*appointment|reschedule/.test(text)) return "appointments";
  if (/diet|meal|water|weight|progress|nutrition|calorie|food|eat/.test(text)) return "diet";
  if (/health|result|blood|bmi|vital|pressure|sugar|temperature/.test(text)) return "health";
  if (/message|chat|talk|conversation|send.*message|contact.*(?:doctor|dietitian|practitioner)/.test(text)) return "messages";
  if (/feedback|complain|rate|rating|review|report|complaint|support/.test(text)) return "feedback";
  if (/payment|invoice|bill|pay|outstanding|due|receipt/.test(text)) return "appointments";
  if (/reminder|notification|alert|bell/.test(text)) return "messages";
  return null;
}

/* Check if the question is a follow-up */
function isFollowUp(text: string): boolean {
  return /^(after that|then what|and then|next step|what.?s next|how|then|okay|ok|go on|continue|what do i do|what next|and\?|so\?|now what|what else|got it|done|i did that|yes|yep|yeah|sure)[\s!?.]*$/i.test(text)
    || /^(after|then|next|how do i|what should i|and after|once i|when i|after i)/.test(text);
}

/* Track conversation state */
let lastTopic: TopicKey = null;
let lastStep = -1;

export async function askPatientGuide(session: Session, question: string, history?: GuideMessage[]): Promise<GuideReply> {
  /* Try backend first */
  if (session.token) {
    try {
      const response = await fetch(`${API_BASE}/assistant/guide`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.token}` },
        body: JSON.stringify({ question, history: history?.slice(-6) }),
      });
      if (response.ok) return response.json() as Promise<GuideReply>;
    } catch { /* fall through to local */ }
  }

  const text = question.toLowerCase().trim();

  /* Emergency Ã¢â‚¬â€ always takes priority */
  if (detectTopic(text) === "emergency") {
    lastTopic = null;
    lastStep = -1;
    return { answer: "Call 1990 now for Sri Lanka's emergency ambulance service. Put the phone on speaker, share your location, and follow the dispatcher's instructions. Do not wait for this chat or drive yourself.", suggestedDestinations: [], source: "LOCAL", urgency: "EMERGENCY", emergencyNumber: "1990" };
  }

  /* Detect new topic or follow-up */
  const detectedTopic = detectTopic(text);
  const followUp = isFollowUp(text);

  if (detectedTopic) {
    /* User asked about a specific topic */
    lastTopic = detectedTopic;
    lastStep = 0;

    const steps = topicSteps[detectedTopic];
    if (steps) {
      return { answer: `Sure! Here's what to do:\n\n**Step 1:** ${steps[0]}`, suggestedDestinations: [detectedTopic], source: "LOCAL" };
    }

    /* Topics without step-by-step */
    if (detectedTopic === "health") {
      return { answer: "Open **Health checks** from the sidebar to view your vitals, BMI, blood sugar and blood pressure records. Your clinician records new measurements during each visit. Ask your doctor to interpret the values.", suggestedDestinations: ["health"], source: "LOCAL" };
    }
    if (detectedTopic === "messages") {
      return { answer: "Open **Messages** from the sidebar to view and send secure, non-urgent messages to your care team. You can also see automated reminders for upcoming appointments and diet updates.", suggestedDestinations: ["messages"], source: "LOCAL" };
    }
  } else if (followUp && lastTopic) {
    /* Follow-up on the current topic */
    const steps = topicSteps[lastTopic];
    if (steps) {
      lastStep++;
      if (lastStep < steps.length) {
        return { answer: `**Step ${lastStep + 1}:** ${steps[lastStep]}`, suggestedDestinations: [lastTopic], source: "LOCAL" };
      } else {
        const doneMsg = `That's all the steps! You're all set. Let me know if you need help with anything else.`;
        lastTopic = null;
        lastStep = -1;
        return { answer: doneMsg, suggestedDestinations: [], source: "LOCAL" };
      }
    } else {
      /* Topic has no steps Ã¢â‚¬â€ provide a helpful response */
      lastTopic = null;
      lastStep = -1;
      return { answer: "You can explore that section from the sidebar. Let me know if you have a specific question!", suggestedDestinations: [], source: "LOCAL" };
    }
  } else if (followUp && !lastTopic) {
    return { answer: "I'm not sure what you're referring to. Could you tell me what you'd like help with? For example: appointments, health records, diet plans, messages, or profile settings.", suggestedDestinations: [], source: "LOCAL" };
  }

  /* Greetings */
  if (/^(hi|hello|hey|good morning|good afternoon|good evening|howdy|sup)[\s!?.]*$/i.test(text)) {
    return { answer: "Hello! Ã°Å¸â€˜â€¹ I can help you with appointments, health records, diet plans, messages, feedback, or your profile. What would you like to know?", suggestedDestinations: [], source: "LOCAL" };
  }

  /* Thank you */
  if (/^(thanks|thank you|thx|ty|cheers|appreciate)[\s!?.]*$/i.test(text)) {
    return { answer: "You're welcome! Let me know if you need anything else. Ã°Å¸ËœÅ ", suggestedDestinations: [], source: "LOCAL" };
  }

  /* Generic fallback */
  lastTopic = null;
  lastStep = -1;
  return { answer: "I can help you with:\n\nÃ¢â‚¬Â¢ **Appointments** Ã¢â‚¬â€ booking, rescheduling\nÃ¢â‚¬Â¢ **Health checks** Ã¢â‚¬â€ viewing your vitals\nÃ¢â‚¬Â¢ **Diet & progress** Ã¢â‚¬â€ meal plans, water tracking\nÃ¢â‚¬Â¢ **Messages** Ã¢â‚¬â€ contacting your care team\nÃ¢â‚¬Â¢ **Feedback** Ã¢â‚¬â€ rating consultations\nÃ¢â‚¬Â¢ **Profile** Ã¢â‚¬â€ updating your details\n\nWhat would you like to do?", suggestedDestinations: [], source: "LOCAL" };
}

