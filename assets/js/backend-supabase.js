// Real backend — Supabase (auth + Postgres with Row Level Security).
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm";

export function createSupabaseBackend(CONFIG) {
  const sb = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
  const ok = ({ data, error }) => { if (error) throw new Error(friendly(error.message)); return data; };
  const friendly = (m) => /Database error saving new user/i.test(m)
    ? "Please choose your school and use that school's email address." : m;
  let _uid = null;
  const uid = async () => _uid ?? (_uid = (await sb.auth.getSession()).data.session?.user?.id);
  sb.auth.onAuthStateChange((_e, s) => { _uid = s?.user?.id ?? null; });

  return {
    mode: "live",

    // ---------- public ----------
    async listSchools() { return ok(await sb.from("schools").select("*").order("name")); },
    async publicStats() { return ok(await sb.rpc("public_stats")); },

    // ---------- auth ----------
    async getUser() { return (await sb.auth.getSession()).data.session?.user ?? null; },
    onAuthChange(cb) { sb.auth.onAuthStateChange((event, session) => cb(event, session?.user ?? null)); },
    async signUp({ full_name, email, password, klass, school_id }) {
      const data = ok(await sb.auth.signUp({
        email, password,
        options: { data: { full_name, class: klass, school_id: String(school_id) }, emailRedirectTo: location.origin + location.pathname },
      }));
      return { needsConfirm: !data.session };
    },
    async signIn(email, password) { ok(await sb.auth.signInWithPassword({ email, password })); },
    async signOut() { await sb.auth.signOut(); },
    async resetPassword(email) {
      ok(await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname + "#/reset" }));
    },
    async updatePassword(password) { ok(await sb.auth.updateUser({ password })); },

    // ---------- me ----------
    async getMyProfile() { return ok(await sb.from("profiles").select("*").eq("id", await uid()).single()); },
    async updateMyProfile(patch) {
      const { full_name, class: c, phone_cc, phone } = patch;
      return ok(await sb.from("profiles").update({ full_name, class: c, phone_cc, phone }).eq("id", await uid()).select().single());
    },
    async redeemCode(code) { return ok(await sb.rpc("redeem_code", { code })); },
    async getSettings() { return ok(await sb.from("app_settings").select("*").eq("id", 1).single()); },

    // ---------- student ----------
    async listDirectory() {
      const me = await uid();
      return ok(await sb.from("member_directory").select("*").order("full_name")).filter(m => m.id !== me);
    },
    async getMyRatings() {
      const rows = ok(await sb.from("ratings").select("ratee_id,score").eq("rater_id", await uid()));
      return Object.fromEntries(rows.map(r => [r.ratee_id, r.score]));
    },
    async getMySubmission() { return ok(await sb.from("survey_submissions").select("*").eq("user_id", await uid()).maybeSingle()); },
    async saveSurvey(ratings, days, note) { ok(await sb.rpc("save_survey", { p_ratings: ratings, p_days: days, p_note: note || null })); },
    async listMySessions() { return ok(await sb.from("sessions").select("*").order("date")); },
    async listMyAttendance() { return ok(await sb.from("attendance").select("*").eq("user_id", await uid())); },
    async listAnnouncements() { return ok(await sb.from("announcements").select("*").order("pinned", { ascending: false }).order("created_at", { ascending: false })); },
    async listTasks() { return ok(await sb.from("tasks").select("*").order("due_date", { nullsFirst: false })); },
    async listMyTaskDone() { return ok(await sb.from("task_done").select("*").eq("user_id", await uid())); },
    async markTaskDone(task_id) { ok(await sb.from("task_done").upsert({ task_id, user_id: await uid() })); },
    async listMyReflections() { return ok(await sb.from("reflections").select("*").eq("user_id", await uid())); },
    async saveReflection(session_id, r) {
      ok(await sb.from("reflections").upsert({ session_id, user_id: await uid(), did: r.did, learned: r.learned, outcome: r.outcome }));
    },
    async listMyAbsences() { return ok(await sb.from("absence_requests").select("*").eq("user_id", await uid())); },
    async requestAbsence(session_id, reason) { ok(await sb.from("absence_requests").insert({ session_id, user_id: await uid(), reason })); },
    async cancelAbsence(id) { ok(await sb.from("absence_requests").delete().eq("id", id)); },
    async groupLeague() { return ok(await sb.rpc("group_league")); },

    // ---------- admin ----------
    async listProfiles() { return ok(await sb.from("profiles").select("*").order("full_name")); },
    async updateProfile(id, patch) { return ok(await sb.from("profiles").update(patch).eq("id", id).select().single()); },
    async deleteProfile(id) { ok(await sb.from("profiles").delete().eq("id", id)); },
    async listAllRatings() { return ok(await sb.from("ratings").select("rater_id,ratee_id,score")); },
    async listSubmissions() { return ok(await sb.from("survey_submissions").select("*")); },
    async resetSurvey() { ok(await sb.rpc("reset_survey")); },
    async saveGroups(count, assign) { ok(await sb.rpc("save_groups", { p_count: count, p_assign: assign })); },
    async updateSettings(patch) { return ok(await sb.from("app_settings").update(patch).eq("id", 1).select().single()); },
    async getSecrets() { return ok(await sb.from("app_secrets").select("*").eq("id", 1).single()); },
    async updateSecrets(patch) { return ok(await sb.from("app_secrets").update(patch).eq("id", 1).select().single()); },
    async listSessions() { return ok(await sb.from("sessions").select("*").order("date")); },
    async createSessions(rows) { return ok(await sb.from("sessions").insert(rows).select()); },
    async updateSession(id, patch) { return ok(await sb.from("sessions").update(patch).eq("id", id).select().single()); },
    async deleteSession(id) { ok(await sb.from("sessions").delete().eq("id", id)); },
    async listAttendance() { return ok(await sb.from("attendance").select("*")); },
    async setAttendance(session_id, user_id, status) {
      if (!status) return ok(await sb.from("attendance").delete().match({ session_id, user_id }));
      ok(await sb.from("attendance").upsert({ session_id, user_id, status }));
    },
    async listAbsenceRequests() { return ok(await sb.from("absence_requests").select("*").order("created_at", { ascending: false })); },
    async setAbsenceStatus(id, status) { ok(await sb.from("absence_requests").update({ status }).eq("id", id)); },
    async createTask(t) { return ok(await sb.from("tasks").insert(t).select().single()); },
    async updateTask(id, patch) { return ok(await sb.from("tasks").update(patch).eq("id", id).select().single()); },
    async deleteTask(id) { ok(await sb.from("tasks").delete().eq("id", id)); },
    async listAllTaskDone() { return ok(await sb.from("task_done").select("*")); },
    async listAllReflections() { return ok(await sb.from("reflections").select("*").order("created_at", { ascending: false })); },
    async postAnnouncement(a) { ok(await sb.from("announcements").insert(a)); },
    async updateAnnouncement(id, patch) { ok(await sb.from("announcements").update(patch).eq("id", id)); },
    async deleteAnnouncement(id) { ok(await sb.from("announcements").delete().eq("id", id)); },
    async createSchool(s) { return ok(await sb.from("schools").insert(s).select().single()); },
    async updateSchool(id, patch) { return ok(await sb.from("schools").update(patch).eq("id", id).select().single()); },
  };
}
