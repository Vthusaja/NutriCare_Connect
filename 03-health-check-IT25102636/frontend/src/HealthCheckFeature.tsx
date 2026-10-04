import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, HeartPulse, Save, Trash2 } from "lucide-react";
import type { HealthCheck, HealthCheckResult, WorkspacePerson } from "../../../frontend/src/api";

type CheckInput = { patientId: string; weightKg: number; bmi: number; systolic?: number; diastolic?: number; bloodSugar: number; temperature: number; notes?: string };
type Props = {
  patientOnly?: boolean;
  userName?: string;
  currentUserId: string;
  loadPeople: () => Promise<WorkspacePerson[]>;
  loadChecks: (patientId: string) => Promise<HealthCheck[]>;
  saveCheck: (check: CheckInput) => Promise<HealthCheckResult>;
  updateCheck?: (id: string, check: { weightKg: number; bmi: number; systolic?: number; diastolic?: number; bloodSugar: number; temperature: number; notes?: string }) => Promise<HealthCheckResult>;
  deleteCheck?: (id: string) => Promise<void>;
};

export function HealthCheckFeature({
  patientOnly = false,
  userName = "Patient",
  currentUserId,
  loadPeople,
  loadChecks,
  saveCheck,
  updateCheck,
  deleteCheck,
}: Props) {
  const [patients, setPatients] = useState<WorkspacePerson[]>([]);
  const [patientId, setPatientId] = useState(patientOnly ? currentUserId : "");
  const [checks, setChecks] = useState<HealthCheck[]>([]);
  const [editingCheck, setEditingCheck] = useState<HealthCheck | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (patientOnly) return;
    loadPeople().then(items => {
      const available = items.filter(item => item.role === "PATIENT");
      setPatients(available);
      setPatientId(current => current || available[0]?.id || "");
    }).catch(reason => setError(reason instanceof Error ? reason.message : "Patients could not be loaded."));
  }, [loadPeople, patientOnly]);

  useEffect(() => {
    if (!patientId) { setChecks([]); return; }
    setError("");
    loadChecks(patientId).then(setChecks).catch(reason => setError(reason instanceof Error ? reason.message : "Health records could not be loaded."));
  }, [loadChecks, patientId]);

  const selectedName = useMemo(() => patientOnly ? userName : patients.find(item => item.id === patientId)?.fullName ?? "Select a patient", [patientId, patientOnly, patients, userName]);
  const latest = checks[0];

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!patientId) { setError("Select a patient first."); return; }
    const form = event.currentTarget;
    const data = new FormData(form);
    setSaving(true); setError(""); setNotice("");
    try {
      const weightKg = Number(data.get("weight"));
      const bmi = Number(data.get("bmi"));
      const systolicRaw = String(data.get("systolic") ?? "").trim();
      const diastolicRaw = String(data.get("diastolic") ?? "").trim();
      const bloodSugar = Number(data.get("sugar"));
      const temperature = Number(data.get("temperature"));
      const notes = String(data.get("notes") ?? "").trim();

      if (!Number.isFinite(weightKg) || weightKg < 1 || weightKg > 500) {
        setError("Weight must be between 1 and 500 kg.");
        return;
      }
      if (!Number.isFinite(bmi) || bmi < 5 || bmi > 100) {
        setError("BMI must be between 5 and 100.");
        return;
      }
      if (!Number.isFinite(bloodSugar) || bloodSugar < 1 || bloodSugar > 1000) {
        setError("Blood sugar must be between 1 and 1000 mg/dL.");
        return;
      }
      if (!Number.isFinite(temperature) || temperature < 30 || temperature > 45) {
        setError("Temperature must be between 30 and 45 °C (use Celsius, e.g. 36.8).");
        return;
      }

      const result = await saveCheck({
        patientId,
        weightKg,
        bmi,
        systolic: systolicRaw ? Number(systolicRaw) : undefined,
        diastolic: diastolicRaw ? Number(diastolicRaw) : undefined,
        bloodSugar,
        temperature,
        notes: notes || undefined,
      });
      setChecks(current => [result.check, ...current]);
      setNotice(result.alerts.length ? `${result.alerts.length} health alert${result.alerts.length === 1 ? "" : "s"} created. ${result.disclaimer}` : `Health check saved. ${result.disclaimer}`);
      form.reset();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Health check could not be saved."); }
    finally { setSaving(false); }
  }

  async function handleUpdate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingCheck || !updateCheck) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    setSaving(true); setError(""); setNotice("");
    try {
      const weightKg = Number(data.get("weight"));
      const bmi = Number(data.get("bmi"));
      const systolicRaw = String(data.get("systolic") ?? "").trim();
      const diastolicRaw = String(data.get("diastolic") ?? "").trim();
      const bloodSugar = Number(data.get("sugar"));
      const temperature = Number(data.get("temperature"));
      const notes = String(data.get("notes") ?? "").trim();

      const result = await updateCheck(editingCheck.id, {
        weightKg,
        bmi,
        systolic: systolicRaw ? Number(systolicRaw) : undefined,
        diastolic: diastolicRaw ? Number(diastolicRaw) : undefined,
        bloodSugar,
        temperature,
        notes: notes || undefined,
      });
      setChecks(current => current.map(item => item.id === editingCheck.id ? result.check : item));
      setNotice("Health check updated successfully.");
      setEditingCheck(null);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Health check could not be updated."); }
    finally { setSaving(false); }
  }

  async function handleDelete(id: string) {
    if (!deleteCheck) return;
    if (!window.confirm("Are you sure you want to delete this health checkup record?")) return;
    try {
      await deleteCheck(id);
      setChecks(current => current.filter(item => item.id !== id));
      setNotice("Health check deleted.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Health check could not be deleted."); }
  }

  const summary = (
    <section className="panel">
      <div className="panel-title"><div><span className="eyebrow">{patientOnly ? "My latest database record" : "Patient database record"}</span><h2>{selectedName}</h2></div><HeartPulse size={21}/></div>
      {latest ? (
        <>
          <div className="metric-row">
            <article className="metric"><span>BMI</span><strong>{latest.bmi ?? "—"}</strong></article>
            <article className="metric"><span>Blood sugar</span><strong>{latest.bloodSugar ?? "—"}</strong><small>mg/dL</small></article>
            <article className="metric"><span>Blood pressure</span><strong>{latest.systolic && latest.diastolic ? `${latest.systolic}/${latest.diastolic}` : "—"}</strong><small>mmHg</small></article>
          </div>
          <div className="list">
            {checks.map(check => (
              <div className="list-item" key={check.id}>
                <span className="avatar">{new Date(check.recordedAt).getDate()}</span>
                <span className="grow">
                  <strong>{new Date(check.recordedAt).toLocaleDateString()} · Health check</strong>
                  <small>Weight {check.weightKg ?? "—"} kg · BMI {check.bmi ?? "—"} · Blood sugar {check.bloodSugar ?? "—"} mg/dL · Temp {check.temperature ?? "—"} °C</small>
                  {check.notes && <small style={{ display: "block", color: "#374151" }}>Notes: {check.notes}</small>}
                </span>
                {!patientOnly && (
                  <span style={{ display: "flex", gap: 6 }}>
                    <button className="text-button" type="button" onClick={() => setEditingCheck(check)}>Edit</button>
                    <button className="danger" type="button" onClick={() => void handleDelete(check.id)}><Trash2 size={14}/></button>
                  </span>
                )}
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="list-item"><span className="grow"><strong>No health checks recorded</strong><small>This account has no health-check rows in the database yet.</small></span></div>
      )}
    </section>
  );

  return (
    <div className="stack-xl">
      <div className="page-heading">
        <div>
          <span className="eyebrow">Module 03 · IT25102636</span>
          <h1>{patientOnly ? "My health check-ups" : "Health check-ups"}</h1>
          <p>{patientOnly ? "Review your own saved check-up history." : "Record clinical observations and highlight meaningful changes."}</p>
        </div>
        <span className="chip"><AlertTriangle size={13}/> Reference thresholds · non-diagnostic</span>
      </div>
      {error && <div className="form-error">{error}</div>}
      
      {patientOnly ? (
        <div className="feature-grid">
          {summary}
          <section className="panel tip-card"><HeartPulse/><div><span className="eyebrow">Private record</span><h2>Only your health history is available here</h2><p>Contact a qualified clinician for interpretation or medical advice.</p></div></section>
        </div>
      ) : (
        <div className="feature-grid">
          {summary}
          <section className="panel">
            <div className="panel-title">
              <div>
                <span className="eyebrow">{editingCheck ? "Edit record" : "New database record"}</span>
                <h2>{editingCheck ? "Update vital signs" : "Record vital signs"}</h2>
              </div>
            </div>
            
            {editingCheck ? (
              <form className="form-grid" onSubmit={handleUpdate} key={editingCheck.id}>
                <div className="field"><label htmlFor="edit-weight">Weight (kg)</label><input id="edit-weight" name="weight" type="number" min="1" max="500" step="0.1" defaultValue={editingCheck.weightKg} required/></div>
                <div className="field"><label htmlFor="edit-bmi">BMI</label><input id="edit-bmi" name="bmi" type="number" min="5" max="100" step="0.1" defaultValue={editingCheck.bmi} required/></div>
                <div className="field"><label htmlFor="edit-systolic">Systolic</label><input id="edit-systolic" name="systolic" type="number" min="40" max="300" defaultValue={editingCheck.systolic ?? ""}/></div>
                <div className="field"><label htmlFor="edit-diastolic">Diastolic</label><input id="edit-diastolic" name="diastolic" type="number" min="20" max="200" defaultValue={editingCheck.diastolic ?? ""}/></div>
                <div className="field"><label htmlFor="edit-sugar">Blood sugar (mg/dL)</label><input id="edit-sugar" name="sugar" type="number" min="1" max="1000" step="0.1" defaultValue={editingCheck.bloodSugar} required/></div>
                <div className="field"><label htmlFor="edit-temperature">Temperature (°C)</label><input id="edit-temperature" name="temperature" type="number" min="30" max="45" step="0.1" defaultValue={editingCheck.temperature} required/></div>
                <div className="field full"><label htmlFor="edit-notes">Clinical notes</label><textarea id="edit-notes" name="notes" rows={3} maxLength={2000} defaultValue={editingCheck.notes ?? ""}/></div>
                <div className="field full" style={{ display: "flex", gap: 8 }}>
                  <button className="primary" type="submit" disabled={saving}><Save size={16}/> {saving ? "Saving…" : "Save Changes"}</button>
                  <button className="secondary" type="button" onClick={() => setEditingCheck(null)}>Cancel</button>
                </div>
              </form>
            ) : (
              <form className="form-grid" onSubmit={save}>
                <div className="field full"><label htmlFor="health-patient">Patient</label><select id="health-patient" value={patientId} onChange={event => setPatientId(event.target.value)} required><option value="">Select patient</option>{patients.map(patient => <option value={patient.id} key={patient.id}>{patient.fullName} · {patient.id}</option>)}</select></div>
                <div className="field"><label htmlFor="weight">Weight (kg)</label><input id="weight" name="weight" type="number" min="1" max="500" step="0.1" required/></div>
                <div className="field"><label htmlFor="bmi">BMI</label><input id="bmi" name="bmi" type="number" min="5" max="100" step="0.1" required/></div>
                <div className="field"><label htmlFor="systolic">Systolic</label><input id="systolic" name="systolic" type="number" min="40" max="300"/></div>
                <div className="field"><label htmlFor="diastolic">Diastolic</label><input id="diastolic" name="diastolic" type="number" min="20" max="200"/></div>
                <div className="field"><label htmlFor="sugar">Blood sugar (mg/dL)</label><input id="sugar" name="sugar" type="number" min="1" max="1000" step="0.1" required/></div>
                <div className="field"><label htmlFor="temperature">Temperature (°C)</label><input id="temperature" name="temperature" type="number" min="30" max="45" step="0.1" required placeholder="e.g. 36.8"/></div>
                <div className="field full"><label htmlFor="notes">Clinical notes</label><textarea id="notes" name="notes" rows={4} maxLength={2000} placeholder="Observations and recommendations"/></div>
                <button className="primary field full" type="submit" disabled={saving || !patientId}><Save size={16}/> {saving ? "Saving…" : "Save & compare results"}</button>
              </form>
            )}
            {notice && <div className="success-note">{notice}</div>}
          </section>
        </div>
      )}
    </div>
  );
}

