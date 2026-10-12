// Demo backend — everything is stored in this browser (localStorage).
// Same interface as backend-supabase.js, so the whole site works without a
// server. All people below are fictional sample data.

const KEY = "grc-recycling-demo-v2";
const SESSION_KEY = "grc-recycling-demo-session-v2";

const FIRST = ["Lucía", "Mateo", "Sofía", "Hugo", "Valeria", "Leo", "Martina", "Pablo", "Elena", "Álvaro", "Noa", "Diego", "Carla", "Iker", "Julia"];
const LAST = ["Navarro", "Romero", "Ortega", "Delgado", "Castro", "Morales", "Ruiz", "Iglesias", "Vidal", "Serrano", "Molina", "Rubio", "Marín", "Soler", "Gallego"];
const DEMO_CLASSES = ["1º Baccalaureate (International)", "1º Baccalaureate (National)", "4 ESO A", "4 ESO B"];

const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2) + Date.now());
const now = () => new Date().toISOString();
const clone = (x) => JSON.parse(JSON.stringify(x));
const wait = (ms = 120) => new Promise(r => setTimeout(r, ms));
const plain = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const iso = (d) => d.toISOString().slice(0, 10);
const addDays = (n) => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + n); return d; };

// Plain capital letters only, as in the Mainframe: "Álvaro" → "ALVARO", "Núñez" → "NUNEZ".
const letters = (w) => (w || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z]/g, "");

export function makeGrcId(name, phone) {
  const parts = (name || "").trim().split(/\s+/).map(letters).filter(Boolean);
  const digits = (phone || "").replace(/\D/g, "");
  const suffix = digits.length >= 2 ? digits.slice(-2) : parts[1] ? parts[1].slice(0, 2) : "XX";
  return (parts[0] || "").slice(0, 3) + "-" + suffix;
}

function seed() {
  let s = 11;
  const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };

  const schools = [
    { id: 1, name: "Agora Madrid International School", city: "Madrid", student_domain: "student.agoraism.com", staff_domain: "agoraism.com", active: true },
    { id: 2, name: "Demo Partner School", city: "Example City", student_domain: "students.demo-school.org", staff_domain: "demo-school.org", active: true },
  ];
  const users = [], profiles = [];
  const add = (full_name, email, role, status, klass, phone, group_id = null) => {
    const id = uuid();
    users.push({ id, email, password: "demo1234" });
    profiles.push({ id, email, full_name, school_id: 1, class: klass, phone_cc: phone ? "+34" : null, phone: phone || null,
      grc_id: makeGrcId(full_name, phone), grc_id_manual: false, role, status, group_id, created_at: now() });
    return id;
  };
  add("Demo Admin", "admin.demo@agoraism.com", "admin", "member", "2º Baccalaureate (International)", "600 00 00 01");

  // friend circles → groups
  const circles = [[0, 1, 2, 3], [4, 5, 6], [7, 8, 9, 10], [11, 12, 13, 14]];
  const groupOf = (i) => circles.findIndex(c => c.includes(i)) + 1;
  const ids = FIRST.map((f, i) => add(`${f} ${LAST[i]}`, `${plain(f)}.${plain(LAST[i])}@student.agoraism.com`, "student", "member",
    DEMO_CLASSES[i % 4], i % 3 === 0 ? `6${10 + i} 12 34 ${String(10 + i * 3).slice(-2)}` : null, groupOf(i)));
  const alex = add("Alex Demo", "alex.demo@student.agoraism.com", "student", "member", "1º Baccalaureate (International)", null, 2);

  const ratings = [], submissions = [];
  ids.forEach((a, i) => {
    if (i === 6 || i === 13) return;
    ids.forEach((b, j) => {
      if (i === j) return;
      const score = groupOf(i) === groupOf(j) ? (rnd() < 0.8 ? 5 : 4) : rnd() < 0.08 ? 1 : rnd() < 0.25 ? 4 : rnd() < 0.35 ? 2 : null;
      if (score) ratings.push({ rater_id: a, ratee_id: b, score, updated_at: now() });
    });
    submissions.push({ user_id: a, days: ["Mon", "Wed", "Fri"].filter(() => rnd() > 0.4), note: null, submitted_at: now() });
  });

  // sessions: weekly rotation, 3 past (done) + upcoming
  const groupMembers = (g) => profiles.filter(p => p.role === "student" && p.group_id === g).map(p => p.id);
  const sessions = [], attendance = [];
  let sid = 1;
  for (let w = -6; w <= 9; w++) {
    const g = ((w + 6) % 4) + 1;
    const past = w < 0;
    const sess = { id: sid++, group_id: g, date: iso(addDays(w * 7 + 1)), start_time: "10:50", end_time: "11:40",
      location: "Pick up at class", supervisor: ["Mazen", "Hugo"][Math.abs(w) % 2], notes: null,
      status: past ? "done" : "scheduled", bags: past ? 2 + Math.floor(rnd() * 4) : null,
      kg: past ? Math.round((3 + rnd() * 6) * 10) / 10 : null, photos_url: past ? "https://photos.google.com/" : null, created_at: now() };
    sessions.push(sess);
    if (past) groupMembers(g).forEach(u => {
      const r = rnd();
      attendance.push({ session_id: sess.id, user_id: u, status: u === alex ? "present" : r < 0.78 ? "present" : r < 0.86 ? "late" : r < 0.94 ? "excused" : "absent" });
    });
  }

  const tasks = [
    { id: 1, type: "survey", title: "Group preference survey", body: "Tell us who you would like to be in a group with. Private: only the GRC admin team sees answers.", url: null, due_date: iso(addDays(5)), active: true, created_at: now() },
    { id: 2, type: "acknowledge", title: "Read & accept the participant agreement", body: "I will attend my scheduled sessions on time, give at least 24 hours notice if I cannot come, respect the team and the admin chain (Operations → Management → Executive Director), and not share GRC materials, photos or files outside the initiative without permission.", url: null, due_date: iso(addDays(3)), active: true, created_at: now() },
    { id: 3, type: "link", title: "Join the WhatsApp Community", body: "All reminders, photos and updates are shared there.", url: "https://www.whatsapp.com/", due_date: null, active: true, created_at: now() },
  ];
  const task_done = ids.filter((_, i) => i % 4 !== 2).map(u => ({ task_id: 2, user_id: u, done_at: now() }));

  return {
    schools, users, profiles, ratings, submissions, tasks, task_done,
    groups: [1, 2, 3, 4].map(i => ({ id: i, name: `Group ${i}` })),
    settings: { id: 1, survey_open: true, groups_published: true, num_groups: 4 },
    secrets: { id: 1, join_code: "RECYCLE26", admin_code: "GRC-ADMIN" },
    sessions, attendance, reflections: [], absences: [],
    announcements: [
      { id: 1, title: "Welcome to the 2026–27 recycling initiative 🌱", author: "Mazen · GRC", pinned: true,
        body: "Thanks for joining! Please complete your activities (the group survey and the participant agreement) this week. Groups and session dates are on your Calendar.", created_at: new Date(Date.now() - 864e5 * 6).toISOString() },
      { id: 2, title: "Bring a water bottle", author: "Hugo · GRC", pinned: false,
        body: "Sessions involve walking around campus and carrying bags. Bring water and wear comfortable shoes.", created_at: new Date(Date.now() - 864e5 * 2).toISOString() },
    ],
    nextId: 1000,
  };
}

export function createDemoBackend() {
  let db;
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch { /* storage blocked */ } };
  try { db = JSON.parse(localStorage.getItem(KEY)); } catch { db = null; }
  if (!db) { db = seed(); save(); }
  let sessionUid = null;
  try { sessionUid = localStorage.getItem(SESSION_KEY); } catch { /* ignore */ }
  const setSession = (v) => { sessionUid = v; try { v ? localStorage.setItem(SESSION_KEY, v) : localStorage.removeItem(SESSION_KEY); } catch { /* ignore */ } };

  const listeners = [];
  const currentUser = () => { const u = db.users.find(u => u.id === sessionUid); return u ? { id: u.id, email: u.email } : null; };
  const emit = (ev) => listeners.forEach(cb => cb(ev, currentUser()));
  const me = () => db.profiles.find(p => p.id === sessionUid);
  const need = () => { if (!me()) throw new Error("Not signed in"); return me(); };
  const admin = () => { if (need().role !== "admin") throw new Error("Admins only"); };
  const member = () => me()?.status === "member";
  const isAdmin = () => me()?.role === "admin";
  const fix = (p) => { if (!p.grc_id_manual) p.grc_id = makeGrcId(p.full_name, p.phone); };
  const nid = () => db.nextId++;

  return {
    mode: "demo",
    resetDemo() { db = seed(); save(); setSession(null); },

    async listSchools() { return clone(isAdmin() ? db.schools : db.schools.filter(s => s.active)).sort((a, b) => a.name.localeCompare(b.name)); },
    async publicStats() {
      const done = db.sessions.filter(s => s.status === "done");
      return { members: db.profiles.filter(p => p.status === "member" && p.role === "student").length, sessions: done.length,
        kg: done.reduce((t, s) => t + (+s.kg || 0), 0), bags: done.reduce((t, s) => t + (+s.bags || 0), 0), schools: db.schools.filter(s => s.active).length };
    },

    async getUser() { return currentUser(); },
    onAuthChange(cb) { listeners.push(cb); },
    async signUp({ full_name, email, password, klass, school_id }) {
      await wait();
      email = email.trim().toLowerCase();
      const sch = db.schools.find(s => s.id === +school_id && s.active);
      if (!sch) throw new Error("Please choose your school.");
      const dom = email.split("@")[1];
      if (dom !== sch.student_domain && dom !== sch.staff_domain) throw new Error(`Please use your school email address for ${sch.name} (@${sch.student_domain}).`);
      if (db.users.some(u => u.email === email)) throw new Error("An account with this email already exists. Try signing in.");
      const id = uuid();
      db.users.push({ id, email, password });
      const p = { id, email, full_name: full_name.trim(), school_id: sch.id, class: klass, phone_cc: null, phone: null, grc_id: null, grc_id_manual: false, role: "student", status: "pending", group_id: null, created_at: now() };
      fix(p); db.profiles.push(p); save(); setSession(id); emit("SIGNED_IN");
      return { needsConfirm: false };
    },
    async signIn(email, password) {
      await wait();
      const u = db.users.find(u => u.email === email.trim().toLowerCase());
      if (!u || u.password !== password) throw new Error("Invalid login credentials");
      setSession(u.id); emit("SIGNED_IN");
    },
    async signOut() { setSession(null); emit("SIGNED_OUT"); },
    async resetPassword() { await wait(); },
    async updatePassword(password) { const u = db.users.find(u => u.id === sessionUid); if (u) { u.password = password; save(); } },

    async getMyProfile() { return clone(need()); },
    async updateMyProfile(patch) {
      const p = need(); for (const k of ["full_name", "class", "phone_cc", "phone"]) if (k in patch) p[k] = patch[k];
      fix(p); save(); return clone(p);
    },
    async redeemCode(code) {
      await wait(); const p = need(); const c = String(code || "").trim().toUpperCase();
      if (c === db.secrets.admin_code.toUpperCase()) { p.role = "admin"; p.status = "member"; save(); return "admin"; }
      if (c === db.secrets.join_code.toUpperCase()) { if (p.status !== "inactive") p.status = "member"; save(); return "member"; }
      throw new Error("That code is not valid. Check with the GRC team.");
    },
    async getSettings() { return clone(db.settings); },

    async listDirectory() {
      if (!member()) return [];
      const show = db.settings.groups_published || isAdmin();
      return db.profiles.filter(p => p.status === "member" && p.role === "student" && p.id !== sessionUid)
        .map(p => ({ id: p.id, full_name: p.full_name, class: p.class, school_id: p.school_id, group_id: show ? p.group_id : null }))
        .sort((a, b) => a.full_name.localeCompare(b.full_name));
    },
    async getMyRatings() { return Object.fromEntries(db.ratings.filter(r => r.rater_id === sessionUid).map(r => [r.ratee_id, r.score])); },
    async getMySubmission() { return clone(db.submissions.find(s => s.user_id === sessionUid) || null); },
    async saveSurvey(ratings, days, note) {
      await wait(250);
      if (!member()) throw new Error("Join the initiative first.");
      if (!db.settings.survey_open) throw new Error("The survey is closed.");
      db.ratings = db.ratings.filter(r => r.rater_id !== sessionUid);
      for (const [ratee, score] of Object.entries(ratings)) if (ratee !== sessionUid && score >= 1 && score <= 5) db.ratings.push({ rater_id: sessionUid, ratee_id: ratee, score: +score, updated_at: now() });
      db.submissions = db.submissions.filter(s => s.user_id !== sessionUid);
      db.submissions.push({ user_id: sessionUid, days: days || [], note: note || null, submitted_at: now() });
      save();
    },
    async listMySessions() {
      const p = need();
      if (p.role === "admin") return clone(db.sessions);
      if (!db.settings.groups_published) return clone(db.sessions.filter(s => db.attendance.some(a => a.user_id === p.id && a.session_id === s.id)));
      const mine = new Set(db.attendance.filter(a => a.user_id === p.id).map(a => a.session_id));
      return clone(db.sessions.filter(s => s.group_id === p.group_id || mine.has(s.id))).sort((a, b) => a.date.localeCompare(b.date));
    },
    async listMyAttendance() { return clone(db.attendance.filter(a => a.user_id === sessionUid)); },
    async listAnnouncements() {
      return member() ? clone(db.announcements).sort((a, b) => (b.pinned - a.pinned) || b.created_at.localeCompare(a.created_at)) : [];
    },
    async listTasks() { return member() ? clone(isAdmin() ? db.tasks : db.tasks.filter(t => t.active)) : []; },
    async listMyTaskDone() { return clone(db.task_done.filter(t => t.user_id === sessionUid)); },
    async markTaskDone(task_id) {
      if (!member()) throw new Error("Join first");
      if (!db.task_done.some(t => t.task_id === task_id && t.user_id === sessionUid)) db.task_done.push({ task_id, user_id: sessionUid, done_at: now() });
      save();
    },
    async listMyReflections() { return clone(db.reflections.filter(r => r.user_id === sessionUid)); },
    async saveReflection(session_id, r) {
      await wait(200);
      const att = db.attendance.find(a => a.session_id === session_id && a.user_id === sessionUid && ["present", "late"].includes(a.status));
      if (!att) throw new Error("You can only reflect on sessions you attended.");
      db.reflections = db.reflections.filter(x => !(x.session_id === session_id && x.user_id === sessionUid));
      db.reflections.push({ session_id, user_id: sessionUid, did: r.did, learned: r.learned, outcome: r.outcome, created_at: now() });
      save();
    },
    async listMyAbsences() { return clone(db.absences.filter(a => a.user_id === sessionUid)); },
    async requestAbsence(session_id, reason) {
      await wait(200); const p = need();
      const s = db.sessions.find(s => s.id === session_id);
      if (!s || s.group_id !== p.group_id) throw new Error("That isn't your group's session.");
      if (db.absences.some(a => a.session_id === session_id && a.user_id === sessionUid)) throw new Error("You already sent a request for this session.");
      db.absences.push({ id: nid(), session_id, user_id: sessionUid, reason, status: "pending", created_at: now() }); save();
    },
    async cancelAbsence(id) { db.absences = db.absences.filter(a => !(a.id === id && a.user_id === sessionUid && a.status === "pending")); save(); },
    async groupLeague() {
      if (!(member() && db.settings.groups_published) && !isAdmin()) return [];
      const gids = [...new Set(db.sessions.map(s => s.group_id))].sort((a, b) => a - b);
      return gids.map(g => {
        const ss = db.sessions.filter(s => s.group_id === g), done = ss.filter(s => s.status === "done");
        const att = db.attendance.filter(a => ss.some(s => s.id === a.session_id));
        return { group_id: g, sessions: done.length, kg: done.reduce((t, s) => t + (+s.kg || 0), 0), bags: done.reduce((t, s) => t + (+s.bags || 0), 0),
          attendance_rate: att.length ? Math.round(100 * att.filter(a => ["present", "late"].includes(a.status)).length / att.length) : null };
      });
    },

    // ---------- admin ----------
    async listProfiles() { admin(); return clone(db.profiles).sort((a, b) => a.full_name.localeCompare(b.full_name)); },
    async updateProfile(pid, patch) { admin(); const p = db.profiles.find(p => p.id === pid); Object.assign(p, patch); fix(p); save(); return clone(p); },
    async deleteProfile(pid) {
      admin(); db.profiles = db.profiles.filter(p => p.id !== pid); db.users = db.users.filter(u => u.id !== pid);
      db.ratings = db.ratings.filter(r => r.rater_id !== pid && r.ratee_id !== pid); db.attendance = db.attendance.filter(a => a.user_id !== pid); save();
    },
    async listAllRatings() { admin(); return clone(db.ratings); },
    async listSubmissions() { admin(); return clone(db.submissions); },
    async resetSurvey() { admin(); db.ratings = []; db.submissions = []; save(); },
    async saveGroups(count, assign) {
      admin(); await wait(200);
      db.groups = Array.from({ length: count }, (_, i) => ({ id: i + 1, name: `Group ${i + 1}` }));
      db.profiles.forEach(p => { if (p.role === "student") p.group_id = assign[p.id] ?? null; });
      db.sessions = db.sessions.filter(s => s.group_id <= count); db.settings.num_groups = count; save();
    },
    async updateSettings(patch) { admin(); Object.assign(db.settings, patch); save(); return clone(db.settings); },
    async getSecrets() { admin(); return clone(db.secrets); },
    async updateSecrets(patch) { admin(); Object.assign(db.secrets, patch); save(); return clone(db.secrets); },
    async listSessions() { admin(); return clone(db.sessions).sort((a, b) => a.date.localeCompare(b.date)); },
    async createSessions(rows) {
      admin(); const out = rows.map(r => ({ status: "scheduled", bags: null, kg: null, photos_url: null, notes: null, ...r, id: nid(), created_at: now() }));
      db.sessions.push(...out); save(); return clone(out);
    },
    async updateSession(sid, patch) { admin(); const s = db.sessions.find(s => s.id === sid); Object.assign(s, patch); save(); return clone(s); },
    async deleteSession(sid) { admin(); db.sessions = db.sessions.filter(s => s.id !== sid); db.attendance = db.attendance.filter(a => a.session_id !== sid); save(); },
    async listAttendance() { admin(); return clone(db.attendance); },
    async setAttendance(session_id, user_id, status) {
      admin(); db.attendance = db.attendance.filter(a => !(a.session_id === session_id && a.user_id === user_id));
      if (status) db.attendance.push({ session_id, user_id, status }); save();
    },
    async listAbsenceRequests() { admin(); return clone(db.absences).sort((a, b) => b.created_at.localeCompare(a.created_at)); },
    async setAbsenceStatus(id, status) {
      admin(); const a = db.absences.find(a => a.id === id); a.status = status;
      if (status === "approved") { db.attendance = db.attendance.filter(x => !(x.session_id === a.session_id && x.user_id === a.user_id)); db.attendance.push({ session_id: a.session_id, user_id: a.user_id, status: "excused" }); }
      save();
    },
    async createTask(t) { admin(); const row = { active: true, created_at: now(), ...t, id: nid() }; db.tasks.push(row); save(); return clone(row); },
    async updateTask(id, patch) { admin(); const t = db.tasks.find(t => t.id === id); Object.assign(t, patch); save(); return clone(t); },
    async deleteTask(id) { admin(); db.tasks = db.tasks.filter(t => t.id !== id); db.task_done = db.task_done.filter(d => d.task_id !== id); save(); },
    async listAllTaskDone() { admin(); return clone(db.task_done); },
    async listAllReflections() { admin(); return clone(db.reflections).sort((a, b) => b.created_at.localeCompare(a.created_at)); },
    async postAnnouncement(a) { admin(); db.announcements.push({ pinned: false, ...a, id: nid(), created_at: now() }); save(); },
    async updateAnnouncement(id, patch) { admin(); Object.assign(db.announcements.find(a => a.id === id), patch); save(); },
    async deleteAnnouncement(id) { admin(); db.announcements = db.announcements.filter(a => a.id !== id); save(); },
    async createSchool(s) { admin(); const row = { active: true, ...s, id: nid() }; db.schools.push(row); save(); return clone(row); },
    async updateSchool(id, patch) { admin(); Object.assign(db.schools.find(s => s.id === id), patch); save(); },
  };
}
