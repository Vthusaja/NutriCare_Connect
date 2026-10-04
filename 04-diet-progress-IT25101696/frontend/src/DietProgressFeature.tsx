import { useCallback, useEffect, useMemo, useState } from "react";
import { Droplets, Edit, Leaf, Plus, Trash2 } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type Person = { id: string; fullName: string; role: string; enabled: boolean };
type Plan = { id: string; patientId: string; dietitianId: string; title: string; calorieTarget?: number; exclusions?: string; mealSchedule: string; status: string; createdAt: string };
type Progress = { id: string; patientId: string; logDate: string; weightKg?: number; bmi?: number; waterGlasses?: number; mealsCompleted?: number };

export function DietProgressFeature({
  canManagePlans,
  currentUserId,
  loadPeople,
  loadPlans,
  loadProgress,
  savePlan,
  updatePlan,
  deletePlan,
}: {
  canManagePlans: boolean;
  currentUserId: string;
  loadPeople: () => Promise<Person[]>;
  loadPlans: (patientId: string) => Promise<Plan[]>;
  loadProgress: (patientId: string) => Promise<Progress[]>;
  savePlan: (plan: { patientId: string; title: string; calorieTarget: number; exclusions?: string; mealSchedule: string }) => Promise<Plan>;
  updatePlan?: (id: string, plan: { title: string; calorieTarget: number; exclusions?: string; mealSchedule: string; status?: string }) => Promise<Plan>;
  deletePlan?: (id: string) => Promise<void>;
}) {
  const [people, setPeople] = useState<Person[]>([]);
  const [patientId, setPatientId] = useState(canManagePlans ? "" : currentUserId);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [progress, setProgress] = useState<Progress[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!canManagePlans) return;
    loadPeople().then(rows => {
      const patients = rows.filter(person => person.role === "PATIENT");
      setPeople(patients);
      setPatientId(current => current || patients[0]?.id || "");
    }).catch(reason => setNotice(reason instanceof Error ? reason.message : "Patients could not be loaded."));
  }, [canManagePlans, loadPeople]);

  const refresh = useCallback(async () => {
    if (!patientId) { setLoading(false); return; }
    setLoading(true);
    try {
      const [planRows, progressRows] = await Promise.all([loadPlans(patientId), loadProgress(patientId)]);
      setPlans(planRows); setProgress(progressRows);
    } catch (reason) { setNotice(reason instanceof Error ? reason.message : "Diet records could not be loaded."); }
    finally { setLoading(false); }
  }, [loadPlans, loadProgress, patientId]);

  useEffect(() => { void refresh(); }, [refresh]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await savePlan({ patientId, title: String(form.get("title")), calorieTarget: Number(form.get("calories")), exclusions: String(form.get("exclusions")), mealSchedule: String(form.get("schedule")) });
      setNotice("Diet plan saved to the database for this patient."); setShowForm(false); await refresh();
    } catch (reason) { setNotice(reason instanceof Error ? reason.message : "Diet plan could not be saved."); }
  }

  async function handleUpdate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingPlan || !updatePlan) return;
    const form = new FormData(event.currentTarget);
    try {
      await updatePlan(editingPlan.id, {
        title: String(form.get("title")),
        calorieTarget: Number(form.get("calories")),
        exclusions: String(form.get("exclusions")),
        mealSchedule: String(form.get("schedule")),
        status: String(form.get("status")),
      });
      setNotice("Diet plan updated.");
      setEditingPlan(null);
      await refresh();
    } catch (reason) { setNotice(reason instanceof Error ? reason.message : "Diet plan could not be updated."); }
  }

  async function handleDelete(id: string) {
    if (!deletePlan) return;
    if (!window.confirm("Are you sure you want to delete this diet plan?")) return;
    try {
      await deletePlan(id);
      setNotice("Diet plan removed.");
      await refresh();
    } catch (reason) { setNotice(reason instanceof Error ? reason.message : "Diet plan could not be deleted."); }
  }

  const selectedPatient = people.find(person => person.id === patientId);
  const chartData = useMemo(() => progress.filter(row => row.weightKg != null).map(row => ({ date: row.logDate.slice(5), weight: Number(row.weightKg) })), [progress]);
  const latest = progress.at(-1);

  return (
    <div className="stack-xl">
      <div className="page-heading">
        <div>
          <span className="eyebrow">Module 04 · IT25101696</span>
          <h1>Diet plans & progress</h1>
          <p>Personalized nutrition records loaded from the NutriCare database.</p>
        </div>
        {canManagePlans && <button className="primary" onClick={() => { setShowForm(v => !v); setEditingPlan(null); }}><Plus size={16}/> Create plan</button>}
      </div>
      {canManagePlans && <section className="panel"><div className="field"><label htmlFor="diet-patient">Patient</label><select id="diet-patient" value={patientId} onChange={event => setPatientId(event.target.value)}>{people.map(patient => <option value={patient.id} key={patient.id}>{patient.fullName} ({patient.id})</option>)}</select></div></section>}
      {notice && <div className="success-note">{notice}</div>}
      
      {canManagePlans && showForm && (
        <section className="panel">
          <div className="panel-title"><div><span className="eyebrow">New plan</span><h2>Create diet plan for {selectedPatient?.fullName ?? patientId}</h2></div></div>
          <form className="form-grid" onSubmit={submit}>
            <div className="field full"><label htmlFor="plan-title">Plan title</label><input id="plan-title" name="title" required placeholder="e.g. High-protein recovery plan"/></div>
            <div className="field"><label htmlFor="plan-calories">Calorie target</label><input id="plan-calories" name="calories" type="number" min="1" required placeholder="1850"/></div>
            <div className="field"><label htmlFor="plan-exclusions">Exclusions</label><input id="plan-exclusions" name="exclusions" placeholder="e.g. Gluten, dairy"/></div>
            <div className="field full"><label htmlFor="plan-notes">Meal schedule</label><textarea id="plan-notes" name="schedule" required rows={4} placeholder="Breakfast 07:30 - oats and fruit..."/></div>
            <button className="primary field full" type="submit" disabled={!patientId}><Plus size={16}/> Save diet plan</button>
          </form>
        </section>
      )}

      {canManagePlans && editingPlan && (
        <section className="panel">
          <div className="panel-title"><div><span className="eyebrow">Edit plan</span><h2>Update diet plan</h2></div></div>
          <form className="form-grid" onSubmit={handleUpdate}>
            <div className="field full"><label htmlFor="edit-plan-title">Plan title</label><input id="edit-plan-title" name="title" defaultValue={editingPlan.title} required /></div>
            <div className="field"><label htmlFor="edit-plan-calories">Calorie target</label><input id="edit-plan-calories" name="calories" type="number" min="1" defaultValue={editingPlan.calorieTarget ?? 2000} required /></div>
            <div className="field"><label htmlFor="edit-plan-exclusions">Exclusions</label><input id="edit-plan-exclusions" name="exclusions" defaultValue={editingPlan.exclusions ?? ""} /></div>
            <div className="field"><label htmlFor="edit-plan-status">Status</label><select id="edit-plan-status" name="status" defaultValue={editingPlan.status}><option value="DRAFT">DRAFT</option><option value="PUBLISHED">PUBLISHED</option></select></div>
            <div className="field full"><label htmlFor="edit-plan-notes">Meal schedule</label><textarea id="edit-plan-notes" name="schedule" defaultValue={editingPlan.mealSchedule} required rows={4} /></div>
            <div className="field full" style={{ display: "flex", gap: 8 }}>
              <button className="primary" type="submit">Save Changes</button>
              <button className="secondary" type="button" onClick={() => setEditingPlan(null)}>Cancel</button>
            </div>
          </form>
        </section>
      )}

      <div className="feature-grid equal">
        <section className="panel">
          <div className="panel-title">
            <div>
              <span className="eyebrow">Diet Plans ({plans.length})</span>
              <h2>{selectedPatient?.fullName ?? "Patient"} Plans</h2>
            </div>
          </div>
          <div className="list">
            {plans.map((plan) => (
              <div className="list-item" key={plan.id} style={{ flexDirection: "column", alignItems: "stretch", marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <strong>{plan.title}</strong>
                    <div className="chip-row" style={{ marginTop: 4 }}>
                      <span className="chip active"><Leaf size={12}/> {plan.calorieTarget ?? "—"} kcal</span>
                      {plan.exclusions && <span className="chip">Avoid: {plan.exclusions}</span>}
                      <span className={plan.status === "PUBLISHED" ? "status confirmed" : "status pending"}>{plan.status}</span>
                    </div>
                  </div>
                  {canManagePlans && (
                    <div style={{ display: "flex", gap: 6 }}>
                      <button className="text-button" type="button" onClick={() => { setEditingPlan(plan); setShowForm(false); }}>Edit</button>
                      <button className="danger" type="button" onClick={() => void handleDelete(plan.id)}><Trash2 size={14}/></button>
                    </div>
                  )}
                </div>
                <div style={{ marginTop: 8, padding: 8, background: "#f8faf9", borderRadius: 8, fontSize: "0.88rem" }}>
                  <strong>Schedule:</strong> {plan.mealSchedule}
                </div>
              </div>
            ))}
            {!loading && plans.length === 0 && (
              <div className="list-item">
                <span className="grow">
                  <strong>No plans stored</strong>
                  <small>A doctor or dietitian can create the first plan.</small>
                </span>
              </div>
            )}
          </div>
          <div className="tip-card" style={{ marginTop: 14, padding: 14, borderRadius: 12 }}>
            <Droplets/>
            <div>
              <h2>{latest?.waterGlasses ?? 0} glasses</h2>
              <p>Latest stored water log.</p>
            </div>
          </div>
        </section>
        
        <section className="panel">
          <div className="panel-title">
            <div>
              <span className="eyebrow">Recorded measurements</span>
              <h2>Weight progress</h2>
            </div>
            <strong style={{ color: "var(--green)" }}>{progress.length} logs</strong>
          </div>
          {chartData.length > 0 ? (
            <div className="chart-box">
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <AreaChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#d7e4dc"/>
                  <XAxis dataKey="date" stroke="#687e74" fontSize={11}/>
                  <YAxis domain={["dataMin - 2", "dataMax + 2"]} stroke="#687e74" fontSize={11}/>
                  <Tooltip/>
                  <Area type="monotone" dataKey="weight" stroke="#2b795d" strokeWidth={3} fill="#dcefe5"/>
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="list-item">
              <span className="grow">
                <strong>No weight logs</strong>
                <small>The chart will appear after progress is saved.</small>
              </span>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

