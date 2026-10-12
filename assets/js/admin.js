// Admin control room.
import {
  api, state, CONFIG, $, $$, esc, plural, nl2br, todayISO, fmtDate, relDay, duration, hoursText, toast, busy, download, csv, modal,
  attendanceStats, PRESENT, ring, ICON,
} from "./core.js";
import { makeGroups, evaluate, suggestGroupCount } from "./grouping.js";

const RATING = [null, "Rather not", "Not really", "Neutral", "Would like", "Really want"];
const short = (p) => esc((p?.full_name || "?").split(" ").slice(0, 2).join(" "));
const head = (title, sub = "", right = "") => `<div class="phead"><div><p class="eyebrow dark">Admin</p><h1>${title}</h1>${sub ? `<p class="phead-sub">${sub}</p>` : ""}</div>${right ? `<div class="head-actions">${right}</div>` : ""}</div>`;
const sizesText = (n, k) => { if (!n) return "—"; const b = Math.floor(n / k), e = n % k; return Array.from({ length: k }, (_, i) => b + (i < e ? 1 : 0)).join(" · "); };
const memberSessions = (m, sessions, att) => sessions.filter(s => s.group_id === m.group_id || att.some(a => a.session_id === s.id && a.user_id === m.id));
const kgTxt = (v) => (+v || 0).toFixed(1).replace(/\.0$/, "");

async function base() {
  const [profiles, settings] = await Promise.all([api.listProfiles(), api.getSettings()]);
  state.settings = settings;
  const students = profiles.filter(p => p.role === "student" && p.status === "member");
  return { profiles, settings, students };
}

export async function navBadges() {
  const reqs = await api.listAbsenceRequests();
  return { absences: reqs.filter(r => r.status === "pending").length };
}

// ================================================================ OVERVIEW
export async function overview(page) {
  const [{ profiles, settings, students }, subs, sessions, attendance, reqs, league, tasks, done] = await Promise.all([
    base(), api.listSubmissions(), api.listSessions(), api.listAttendance(), api.listAbsenceRequests(), api.groupLeague(), api.listTasks(), api.listAllTaskDone()]);
  const pending = profiles.filter(p => p.status === "pending");
  const answered = new Set(subs.map(s => s.user_id));
  const surveyDone = students.filter(s => answered.has(s.id)).length;
  const att = attendanceStats(sessions, attendance);
  const doneSess = sessions.filter(s => s.status === "done");
  const kg = doneSess.reduce((t, s) => t + (+s.kg || 0), 0), bags = doneSess.reduce((t, s) => t + (+s.bags || 0), 0);
  const today = todayISO();
  const upcoming = sessions.filter(s => s.date >= today && s.status !== "cancelled").slice(0, 4);
  const toMark = sessions.filter(s => s.date < today && s.status !== "cancelled" && !attendance.some(a => a.session_id === s.id));
  const pendReq = reqs.filter(r => r.status === "pending");
  const byId = Object.fromEntries(profiles.map(p => [p.id, p]));
  const recent = doneSess.slice(-8);
  const rateOf = (s) => { const a = attendance.filter(x => x.session_id === s.id && x.status !== "excused"); return a.length ? Math.round(100 * a.filter(x => PRESENT.has(x.status)).length / a.length) : 0; };
  const k = suggestGroupCount(students.length);
  const overdueTasks = tasks.filter(t => t.active && t.type !== "survey" && t.due_date && t.due_date < today)
    .map(t => ({ t, missing: students.filter(s => !done.some(d => d.task_id === t.id && d.user_id === s.id)).length })).filter(x => x.missing);

  page.innerHTML = `
    ${head("Recycling Initiative overview", `${fmtDate(today, { weekday: "long", day: "numeric", month: "long" })} · ${settings.groups_published ? "groups published" : "groups in draft"} · survey ${settings.survey_open ? "open" : "closed"}`)}
    <div class="kpis">
      <div class="kpi reveal"><span class="kpi-ic">${ICON.users}</span><small>Members</small><b>${students.length}</b><em>${plural(pending.length, "account")} waiting for code</em></div>
      <div class="kpi reveal"><span class="kpi-ic">${ICON.tasks}</span><small>Survey answered</small><b>${surveyDone}<i>/${students.length}</i></b><div class="bar"><span style="width:${students.length ? (100 * surveyDone) / students.length : 0}%"></span></div></div>
      <div class="kpi reveal"><span class="kpi-ic">${ICON.calCheck}</span><small>Attendance rate</small><b>${att.rate ?? "—"}<i>${att.rate != null ? "%" : ""}</i></b><em>${att.attended} attendances · ${hoursText(att.hours)} h</em></div>
      <div class="kpi reveal"><span class="kpi-ic">${ICON.scale}</span><small>Recycled</small><b>${kgTxt(kg)}<i> kg</i></b><em>${bags} bags · ${doneSess.length} sessions</em></div>
    </div>

    <div class="ov-grid">
      <article class="card reveal"><header class="card-h"><h2>${ICON.bell} Needs your attention</h2></header>
        <ul class="alerts">
          ${pendReq.length ? `<li><a href="#/admin/attendance"><span class="al warn">${ICON.calCheck}</span><b>${plural(pendReq.length, "absence request")}</b><span>to review</span>${ICON.chev}</a></li>` : ""}
          ${toMark.length ? `<li><a href="#/admin/sessions"><span class="al warn">${ICON.pen}</span><b>${plural(toMark.length, "past session")}</b><span>without attendance</span>${ICON.chev}</a></li>` : ""}
          ${students.length - surveyDone ? `<li><a href="#/admin/activities"><span class="al">${ICON.users}</span><b>${students.length - surveyDone} haven't done the survey</b><span>send a nudge</span>${ICON.chev}</a></li>` : ""}
          ${overdueTasks.map(x => `<li><a href="#/admin/activities"><span class="al">${ICON.tasks}</span><b>${esc(x.t.title)}</b><span>${x.missing} still missing (overdue)</span>${ICON.chev}</a></li>`).join("")}
          ${pending.length ? `<li><a href="#/admin/members"><span class="al">${ICON.key}</span><b>${plural(pending.length, "account")}</b><span>signed up without a code</span>${ICON.chev}</a></li>` : ""}
          ${!pendReq.length && !toMark.length && !pending.length && surveyDone === students.length && !overdueTasks.length ? `<li class="all-good">${ICON.checkCircle} All caught up!</li>` : ""}
        </ul></article>

      <article class="card reveal"><header class="card-h"><h2>${ICON.cal} Next sessions</h2><a class="small-link" href="#/admin/sessions">Manage ${ICON.chev}</a></header>
        ${upcoming.length ? `<ul class="mini-sess">${upcoming.map(s => `<li><div class="sdate sm"><b>${fmtDate(s.date, { day: "numeric" })}</b><span>${fmtDate(s.date, { month: "short" })}</span></div>
          <div><b>Group ${s.group_id}</b><small>${fmtDate(s.date, { weekday: "short" })} · ${esc(s.start_time || "")} · ${relDay(s.date)}</small></div><span class="pill pill-up">${students.filter(m => m.group_id === s.group_id).length} people</span></li>`).join("")}</ul>`
          : `<div class="empty-mini">${ICON.cal}<p>No upcoming sessions. <a href="#/admin/sessions">Generate a rotation</a></p></div>`}</article>

      <article class="card reveal"><header class="card-h"><h2>${ICON.chart} Attendance per session</h2><span class="fine">last ${recent.length}</span></header>
        ${recent.length ? `<div class="vbars">${recent.map(s => `<div class="vbar" title="${fmtDate(s.date)} · Group ${s.group_id}: ${rateOf(s)}%"><i style="height:${rateOf(s)}%"></i><span>G${s.group_id}</span><small>${fmtDate(s.date, { day: "numeric", month: "numeric" })}</small></div>`).join("")}</div>`
          : `<div class="empty-mini">${ICON.chart}<p>Appears after the first sessions.</p></div>`}</article>

      <article class="card reveal"><header class="card-h"><h2>${ICON.trophy} Group league</h2></header>
        ${league.length ? `<ol class="ltable">${[...league].sort((a, b) => +b.kg - +a.kg).map((l, i) => `<li><span class="lpos">${i + 1}</span><b>Group ${l.group_id}</b><span>${kgTxt(l.kg)} kg</span><span>${l.bags} bags</span><span>${l.attendance_rate ?? "—"}${l.attendance_rate != null ? "%" : ""}</span></li>`).join("")}</ol>`
          : `<div class="empty-mini">${ICON.trophy}<p>No sessions yet.</p></div>`}
        <p class="fine">Suggested split for ${students.length} members: <b>${k} groups (${sizesText(students.length, k)})</b></p></article>
    </div>
    ${pendReq.length ? `<h2 class="sec-title">Latest absence requests</h2><ul class="slist">${pendReq.slice(0, 3).map(r => { const s = sessions.find(x => x.id === r.session_id); return `<li class="sline"><div class="sbody"><b>${short(byId[r.user_id])} · ${s ? fmtDate(s.date) : ""}</b><span>${esc(r.reason)}</span></div><a class="btn btn-ghost xs" href="#/admin/attendance">Review</a></li>`; }).join("")}</ul>` : ""}`;
}

// ================================================================ MEMBERS
const MAINFRAME_HEADER = ["GRC Participant ID", "Full Name", "Group", "Date of Birth", "Class", "Email", "Country Code (WhatsApp)", "Raw Phone Input", "WhatsApp Phone (+CC)", "School"];

export async function members(page) {
  const [{ profiles, settings }, subs, schools, sessions, attendance] = await Promise.all([base(), api.listSubmissions(), api.listSchools(), api.listSessions(), api.listAttendance()]);
  const answered = new Set(subs.map(s => s.user_id));
  const k = settings.num_groups || 4;
  const schoolName = (id) => schools.find(s => s.id === id)?.name || "";
  const rateOf = (p) => attendanceStats(memberSessions(p, sessions, attendance), attendance.filter(a => a.user_id === p.id)).rate;

  page.innerHTML = `
    ${head("Members", `${plural(profiles.length, "account")}`, `<button class="btn btn-ghost sm" id="copy-wa">${ICON.chat} Copy WhatsApp list</button><button class="btn btn-primary sm" id="export">${ICON.download} Export for Mainframe</button>`)}
    <div class="toolbar">
      <input type="search" id="mq" placeholder="Search name, email, ID…">
      <select id="mf"><option value="">All statuses</option><option value="member">Members</option><option value="pending">Waiting for code</option><option value="inactive">Inactive</option></select>
      <select id="ms"><option value="">All schools</option>${schools.map(s => `<option value="${s.id}">${esc(s.name)}</option>`).join("")}</select>
    </div>
    <div class="table-wrap"><table class="table" id="mt">
      <thead><tr><th>GRC ID</th><th>Name</th><th>Class</th><th>WhatsApp</th><th>Survey</th><th>Attend.</th><th>Group</th><th>Status</th><th>Role</th><th></th></tr></thead>
      <tbody>${profiles.map(p => `
        <tr data-id="${p.id}" data-s="${esc(`${p.full_name} ${p.email} ${p.grc_id}`.toLowerCase())}" data-status="${p.status}" data-school="${p.school_id || ""}">
          <td class="mono">${esc(p.grc_id || "")}</td>
          <td><b>${esc(p.full_name)}</b><br><small>${esc(p.email)}</small>${schools.length > 1 ? `<br><small class="muted">${esc(schoolName(p.school_id))}</small>` : ""}</td>
          <td>${esc(p.class || "")}</td>
          <td class="nowrap">${p.phone ? `${esc(p.phone_cc || "")} ${esc(p.phone)}` : `<span class="muted">—</span>`}</td>
          <td>${p.role === "student" ? (answered.has(p.id) ? `<span class="pill pill-present">done</span>` : `<span class="pill pill-pending">no</span>`) : ""}</td>
          <td>${p.role === "student" ? (rateOf(p) != null ? `${rateOf(p)}%` : "—") : ""}</td>
          <td>${p.role === "student" ? `<select data-f="group_id"><option value="">—</option>${Array.from({ length: k }, (_, i) => `<option value="${i + 1}" ${p.group_id === i + 1 ? "selected" : ""}>G${i + 1}</option>`).join("")}</select>` : ""}</td>
          <td><select data-f="status">${["pending", "member", "inactive"].map(s => `<option ${p.status === s ? "selected" : ""}>${s}</option>`).join("")}</select></td>
          <td><select data-f="role" ${p.id === state.profile.id ? "disabled" : ""}>${["student", "admin"].map(s => `<option ${p.role === s ? "selected" : ""}>${s}</option>`).join("")}</select></td>
          <td>${p.id === state.profile.id ? "" : `<button class="iconbtn danger" data-del title="Delete account" aria-label="Delete">${ICON.trash}</button>`}</td>
        </tr>`).join("")}</tbody></table></div>
    <p class="fine">The CSV uses the same column order as the Participants Mainframe (PM) sheet, so you can paste it straight in.</p>`;

  const filter = () => {
    const q = $("#mq").value.trim().toLowerCase(), f = $("#mf").value, sc = $("#ms").value;
    $$("#mt tbody tr").forEach(tr => { tr.hidden = (q && !tr.dataset.s.includes(q)) || (f && tr.dataset.status !== f) || (sc && tr.dataset.school !== sc); });
  };
  ["#mq", "#mf", "#ms"].forEach(s => $(s).addEventListener("input", filter));
  $$("#mt select").forEach(sel => sel.addEventListener("change", () => {
    const id = sel.closest("tr").dataset.id, f = sel.dataset.f; let v = sel.value; if (f === "group_id") v = v ? +v : null;
    busy(null, async () => { await api.updateProfile(id, { [f]: v }); toast("Saved"); });
  }));
  $$("[data-del]").forEach(b => b.addEventListener("click", () => {
    const tr = b.closest("tr"); if (!confirm(`Delete ${tr.querySelector("b").textContent}'s account data? This can't be undone.`)) return;
    busy(null, async () => { await api.deleteProfile(tr.dataset.id); tr.remove(); toast("Deleted"); });
  }));
  $("#export").addEventListener("click", () => {
    const rows = profiles.filter(p => p.role === "student" && p.status === "member").map(p => [p.grc_id, p.full_name, p.group_id ? `Group ${p.group_id}` : "", "", p.class, p.email,
      p.phone_cc || "Unknown (?)", p.phone || "Not provided", p.phone ? `(${p.phone_cc || ""}) ${p.phone}` : "", schoolName(p.school_id)]);
    download(`GRC-recycling-participants-${todayISO()}.csv`, csv([MAINFRAME_HEADER, ...rows]));
  });
  $("#copy-wa").addEventListener("click", () => {
    const list = profiles.filter(p => p.phone).map(p => `${p.full_name}: ${p.phone_cc || ""} ${p.phone}`).join("\n");
    navigator.clipboard.writeText(list || "(no numbers yet)").then(() => toast("WhatsApp list copied"));
  });
}

// ================================================================ ACTIVITIES
export async function activities(page) {
  const [{ students, settings }, tasks, done, subs, reflections, sessions] = await Promise.all([base(), api.listTasks(), api.listAllTaskDone(), api.listSubmissions(), api.listAllReflections(), api.listSessions()]);
  const byId = Object.fromEntries(students.map(s => [s.id, s]));
  const doneBy = (t) => t.type === "survey" ? new Set(subs.map(s => s.user_id)) : new Set(done.filter(d => d.task_id === t.id).map(d => d.user_id));
  const ICONS = { survey: "users", acknowledge: "handshake", link: "link" };
  const LABEL = { survey: "Survey", acknowledge: "Agreement", link: "Link / form" };

  page.innerHTML = `
    ${head("Activities", "Things students need to complete. They show up on each student's Home and Activities pages with their due date.", `<button class="btn btn-primary sm" id="new-task">${ICON.plus} New activity</button>`)}
    <div class="acts big">
      ${tasks.map(t => { const ds = doneBy(t); const n = students.filter(s => ds.has(s.id)).length; const pct = students.length ? Math.round(100 * n / students.length) : 0; return `
        <div class="act admin ${t.active ? "" : "off"}">
          <span class="act-ic t-${t.type === "acknowledge" ? "ack" : t.type}">${ICON[ICONS[t.type]]}</span>
          <span class="act-body"><small>${LABEL[t.type]}${t.active ? "" : " · hidden"}${t.due_date ? ` · due ${fmtDate(t.due_date, { day: "numeric", month: "short" })}` : ""}</small><b>${esc(t.title)}</b>
            <span class="mini-bar"><i style="width:${pct}%"></i></span><small>${n}/${students.length} done (${pct}%)</small></span>
          <div class="act-tools">
            <button class="btn btn-ghost xs" data-who="${t.id}">${ICON.users} Who's missing</button>
            ${t.type === "survey" ? `<a class="btn btn-ghost xs" href="#/admin/survey">${ICON.chart} Results</a>` : ""}
            <button class="iconbtn" data-edit="${t.id}" aria-label="Edit">${ICON.pen}</button>
          </div></div>`; }).join("") || `<div class="empty">${ICON.tasks}<p>No activities yet.</p></div>`}
    </div>
    <div class="card survey-ctl reveal"><label class="switch"><input type="checkbox" id="t-survey" ${settings.survey_open ? "checked" : ""}><span></span>Group survey open for answers</label></div>

    <h2 class="sec-title">CAS reflections <span class="count">${reflections.length}</span></h2>
    ${reflections.length ? `<div class="refl-list">${reflections.map(r => { const s = sessions.find(x => x.id === r.session_id); return `<article class="refl reveal">
      <header><b>${short(byId[r.user_id])}</b><span>${s ? `Group ${s.group_id} · ${fmtDate(s.date)}` : ""}</span>${r.outcome ? `<span class="pill pill-up">${esc(r.outcome.split(" · ")[0])}</span>` : ""}</header>
      <p><b>Did:</b> ${nl2br(r.did)}</p>${r.learned ? `<p><b>Learned:</b> ${nl2br(r.learned)}</p>` : ""}</article>`; }).join("")}</div>`
      : `<p class="muted">Reflections appear here after students write them in their Activities.</p>`}`;

  $("#t-survey").addEventListener("change", (e) => busy(null, async () => { state.settings = await api.updateSettings({ survey_open: e.target.checked }); toast(e.target.checked ? "Survey opened" : "Survey closed"); }));
  $$("[data-who]").forEach(b => b.addEventListener("click", () => {
    const t = tasks.find(x => x.id === +b.dataset.who); const ds = doneBy(t);
    const missing = students.filter(s => !ds.has(s.id));
    const m = modal(`Who's missing · ${t.title}`, missing.length ? `<ul class="namelist">${missing.map(s => `<li>${esc(s.full_name)}<span>${esc(s.class || "")}${s.group_id ? ` · G${s.group_id}` : ""}</span></li>`).join("")}</ul>
      <button class="btn btn-primary wide" id="nudge">${ICON.chat} Copy WhatsApp reminder</button>` : `<div class="notice ok">${ICON.check} Everyone has completed it!</div>`);
    $("#nudge", m.el)?.addEventListener("click", () => {
      const txt = `Hey! 🌱 Quick reminder to complete “${t.title}”${t.due_date ? ` by ${fmtDate(t.due_date, { weekday: "long", day: "numeric", month: "short" })}` : ""} in the GRC portal: ${location.origin + location.pathname}\n\n${missing.map(s => "• " + s.full_name).join("\n")}`;
      navigator.clipboard.writeText(txt).then(() => toast("Reminder copied"));
    });
  }));
  const form = (t = {}) => `<form class="form" id="f-task">
    <label>Type<select name="type" ${t.id ? "disabled" : ""}>${[["acknowledge", "Agreement (read & accept)"], ["link", "Link / external form"], ["survey", "Group preference survey"]].map(([v, l]) => `<option value="${v}" ${t.type === v ? "selected" : ""}>${l}</option>`).join("")}</select></label>
    <label>Title<input name="title" required maxlength="120" value="${esc(t.title || "")}" placeholder="e.g. Fill in the end-of-term feedback form"></label>
    <label>Description<textarea name="body" rows="4" maxlength="2000">${esc(t.body || "")}</textarea></label>
    <label>Link (for link activities)<input name="url" type="url" value="${esc(t.url || "")}" placeholder="https://forms.gle/…"></label>
    <div class="row-2 eq"><label>Due date<input name="due_date" type="date" value="${esc(t.due_date || "")}"></label>
      <label class="switch" style="align-self:end"><input type="checkbox" name="active" ${t.active !== false ? "checked" : ""}><span></span>Visible to students</label></div>
    <div class="btn-row"><button class="btn btn-primary">${t.id ? "Save" : "Create activity"}</button>${t.id ? `<button type="button" class="btn btn-ghost danger-text" id="del-task">${ICON.trash} Delete</button>` : ""}</div></form>`;
  const openForm = (t) => {
    const m = modal(t ? "Edit activity" : "New activity", form(t || {}), { wide: true });
    $("#f-task", m.el).addEventListener("submit", (e) => {
      e.preventDefault(); const f = e.target;
      const row = { title: f.title.value.trim(), body: f.body.value.trim() || null, url: f.url.value.trim() || null, due_date: f.due_date.value || null, active: f.active.checked };
      busy(e.submitter, async () => { t ? await api.updateTask(t.id, row) : await api.createTask({ ...row, type: f.type.value }); m.close(); toast("Saved"); activities(page); });
    });
    $("#del-task", m.el)?.addEventListener("click", () => { if (!confirm("Delete this activity?")) return; busy(null, async () => { await api.deleteTask(t.id); m.close(); activities(page); }); });
  };
  $("#new-task").addEventListener("click", () => openForm(null));
  $$("[data-edit]").forEach(b => b.addEventListener("click", () => openForm(tasks.find(t => t.id === +b.dataset.edit))));
}

// ================================================================ SURVEY RESULTS
export async function survey(page) {
  const [{ students }, ratings, subs] = await Promise.all([base(), api.listAllRatings(), api.listSubmissions()]);
  const ids = students.map(s => s.id);
  const byId = Object.fromEntries(students.map(s => [s.id, s]));
  const R = {}; ratings.forEach(r => { (R[r.rater_id] ||= {})[r.ratee_id] = r.score; });
  const answered = new Set(subs.map(s => s.user_id));
  const mutual = [], apart = [];
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
    const a = ids[i], b = ids[j], ab = R[a]?.[b], ba = R[b]?.[a];
    if (ab >= 4 && ba >= 4) mutual.push([a, b, ab + ba]);
    if (ab === 1 || ba === 1) apart.push([a, b]);
  }
  mutual.sort((x, y) => y[2] - x[2]);
  const nm = (id) => short(byId[id]);
  page.innerHTML = `
    <a class="back" href="#/admin/activities">${ICON.chevL} Activities</a>
    ${head("Survey results", `${answered.size} of ${students.length} answered · ${ratings.length} ratings`, `<button class="btn btn-ghost sm danger-text" id="reset-s">${ICON.trash} Reset all answers</button>`)}
    <div class="privacy">${ICON.shield}<div><b>Admin eyes only.</b> Students were told their answers are private. Please don't share screenshots of this page.</div></div>
    <div class="grid-2">
      <article class="card"><header class="card-h"><h2>${ICON.heart} Strong mutual pairs <span class="count">${mutual.length}</span></h2></header>
        <p class="fine">Both rated each other 4 or 5. The group builder tries hard to keep these together.</p>
        ${mutual.length ? `<ul class="pairs">${mutual.slice(0, 40).map(([a, b, s]) => `<li><span>${nm(a)}</span><i>⟷</i><span>${nm(b)}</span><b>${s}/10</b></li>`).join("")}</ul>` : `<p class="muted">None yet.</p>`}</article>
      <article class="card"><header class="card-h"><h2>${ICON.alert} Keep apart <span class="count">${apart.length}</span></h2></header>
        <p class="fine">At least one rated the other 1 (“rather not”).</p>
        ${apart.length ? `<ul class="pairs warn">${apart.map(([a, b]) => `<li><span>${nm(a)}</span><i>✕</i><span>${nm(b)}</span></li>`).join("")}</ul>` : `<p class="muted">No conflicts 🎉</p>`}</article>
    </div>
    <h2 class="sec-title">Rating matrix</h2>
    <p class="fine">Row = who rated, column = who was rated. Hover a cell for details.</p>
    <div class="legend inline">${[1, 2, 3, 4, 5].map(v => `<span class="rt rt-${v}"><i>${v}</i>${RATING[v]}</span>`).join("")}<span class="rt rt-0"><i></i>Not rated</span></div>
    ${ids.length ? `<div class="matrix-wrap"><table class="matrix"><thead><tr><th></th>${ids.map(id => `<th><span>${nm(id)}</span></th>`).join("")}</tr></thead>
      <tbody>${ids.map(a => `<tr><th>${nm(a)}${answered.has(a) ? "" : ` <small class="muted">(no answer)</small>`}</th>${ids.map(b => {
        if (a === b) return `<td class="self"></td>`; const v = R[a]?.[b];
        return `<td style="background:${v ? `var(--r${v})` : "transparent"}" title="${nm(a)} → ${nm(b)}: ${v ? v + " · " + RATING[v] : "not rated"}">${v || ""}</td>`;
      }).join("")}</tr>`).join("")}</tbody></table></div>` : `<p class="muted">No members yet.</p>`}
    <h2 class="sec-title">Availability &amp; notes</h2>
    <div class="table-wrap"><table class="table"><thead><tr><th>Name</th><th>Best days</th><th>Private note</th><th>Sent</th></tr></thead>
      <tbody>${subs.filter(s => byId[s.user_id]).map(s => `<tr><td><b>${esc(byId[s.user_id].full_name)}</b></td><td>${(s.days || []).map(d => `<span class="pill pill-up">${esc(d)}</span>`).join(" ") || "—"}</td><td>${esc(s.note || "") || "—"}</td><td class="nowrap">${fmtDate(s.submitted_at.slice(0, 10), { day: "numeric", month: "short" })}</td></tr>`).join("")}</tbody></table></div>`;
  $("#reset-s").addEventListener("click", () => {
    if (!confirm("Delete ALL survey answers from everyone? Use this only for a new term.")) return;
    busy(null, async () => { await api.resetSurvey(); toast("Survey answers cleared"); survey(page); });
  });
}

// ================================================================ GROUP BUILDER
export async function groups(page) {
  const [{ students, settings }, ratings] = await Promise.all([base(), api.listAllRatings()]);
  const ids = students.map(s => s.id);
  const byId = Object.fromEntries(students.map(s => [s.id, s]));
  let k = settings.num_groups || suggestGroupCount(ids.length);
  let grp = Array.from({ length: k }, (_, i) => students.filter(s => s.group_id === i + 1).map(s => s.id));
  let unassigned = students.filter(s => !s.group_id || s.group_id > k).map(s => s.id);
  let dirty = false;
  const R = {}; ratings.forEach(r => { (R[r.rater_id] ||= {})[r.ratee_id] = r.score; });

  const render = () => {
    const st = evaluate(ids, ratings, grp);
    const mood = (id, g) => g.some(b => b !== id && (R[id]?.[b] === 1 || R[b]?.[id] === 1)) ? "bad" : st.perPerson[id]?.gotWish ? "good" : "mid";
    const all = [...grp, unassigned];
    page.innerHTML = `
      ${head("Group builder", `${plural(ids.length, "member")} · balanced groups from the anonymous survey`)}
      <div class="card builder">
        <div class="builder-controls">
          <label>Number of groups<div class="stepper"><button type="button" id="k-dn" aria-label="Fewer groups">−</button><input id="k" type="number" min="1" max="${Math.max(1, ids.length)}" value="${k}"><button type="button" id="k-up" aria-label="More groups">+</button></div></label>
          <div class="sizes"><span>Sizes</span><b>${sizesText(ids.length, k)}</b></div>
          <button class="btn btn-primary" id="build">${ICON.spark} Build best groups</button>
        </div>
        <div class="builder-stats">
          <div><b>${Math.round(st.wishRate * 100)}%</b><span>got someone they wanted</span></div>
          <div><b>${st.avgHappiness.toFixed(1)}</b><span>avg. rating of group mates</span></div>
          <div><b>${st.minHappiness.toFixed(1)}</b><span>least-happy person</span></div>
          <div class="${st.conflicts ? "warn" : ""}"><b>${st.conflicts}</b><span>“rather not” clashes</span></div>
        </div>
      </div>
      <div class="legend inline"><span class="mood good"></span>has someone they wanted <span class="mood mid"></span>neutral <span class="mood bad"></span>clash with a mate</div>
      <div class="groups">${all.map((g, gi) => { const isU = gi === grp.length; if (isU && !g.length) return ""; return `
        <article class="group ${isU ? "unassigned" : ""}"><header><h3>${isU ? "Not assigned" : `Group ${gi + 1}`}</h3><span>${g.length} ${g.length === 1 ? "person" : "people"}</span></header>
          <ul>${g.map(id => `<li><span class="mood ${isU ? "" : mood(id, g)}"></span><span class="gname">${esc(byId[id]?.full_name || "?")}<small>${esc(byId[id]?.class || "")}</small></span>
            <select data-move="${id}" aria-label="Move">${grp.map((_, j) => `<option value="${j}" ${j === gi ? "selected" : ""}>G${j + 1}</option>`).join("")}<option value="u" ${isU ? "selected" : ""}>—</option></select></li>`).join("")}</ul></article>`; }).join("")}</div>
      <div class="savebar"><span>${dirty ? "Unsaved changes" : settings.groups_published ? "Saved · visible to students" : "Saved · hidden from students"}</span>
        <label class="switch inline"><input type="checkbox" id="pub" ${settings.groups_published ? "checked" : ""}><span></span>Publish</label>
        <button class="btn btn-primary" id="save-g" ${dirty ? "" : "disabled"}>Save groups</button></div>`;
    const setK = (v) => { v = Math.max(1, Math.min(ids.length || 1, v)); if (v === k) return; const flat = [...grp.flat(), ...unassigned]; k = v; grp = Array.from({ length: k }, () => []); unassigned = flat; dirty = true; render(); };
    $("#k-dn").addEventListener("click", () => setK(k - 1)); $("#k-up").addEventListener("click", () => setK(k + 1));
    $("#k").addEventListener("change", (e) => setK(+e.target.value || 1));
    $("#build").addEventListener("click", (e) => {
      const btn = e.currentTarget; btn.disabled = true; btn.innerHTML = `<span class="spinner"></span> Thinking…`;
      setTimeout(() => { const res = makeGroups(ids, ratings, k, { seed: Date.now() % 100000 }); grp = res.groups; unassigned = []; dirty = true; render(); toast("Groups built. Review, adjust, then save."); }, 30);
    });
    $$("[data-move]").forEach(sel => sel.addEventListener("change", () => {
      const id = sel.dataset.move; grp = grp.map(g => g.filter(x => x !== id)); unassigned = unassigned.filter(x => x !== id);
      if (sel.value === "u") unassigned.push(id); else grp[+sel.value].push(id); dirty = true; render();
    }));
    $("#save-g").addEventListener("click", (e) => busy(e.currentTarget, async () => {
      const assign = {}; grp.forEach((g, i) => g.forEach(id => { assign[id] = i + 1; }));
      await api.saveGroups(k, assign); dirty = false; students.forEach(s => { s.group_id = assign[s.id] ?? null; }); toast("Groups saved"); render();
    }));
    $("#pub").addEventListener("change", (e) => busy(null, async () => {
      if (e.target.checked && dirty) { e.target.checked = false; toast("Save the groups first", "err"); return; }
      Object.assign(settings, await api.updateSettings({ groups_published: e.target.checked })); state.settings = settings;
      toast(e.target.checked ? "Groups are now visible to students" : "Groups hidden from students"); render();
    }));
  };
  render();
}

// ================================================================ SESSIONS & IMPACT
export async function sessions(page) {
  const [{ students, settings }, list, attendance, reqs] = await Promise.all([base(), api.listSessions(), api.listAttendance(), api.listAbsenceRequests()]);
  const k = settings.num_groups || 4;
  const today = todayISO();
  let openId = null, filter = "upcoming";

  const render = () => {
    const nextMon = (() => { const d = new Date(); d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7)); return d.toISOString().slice(0, 10); })();
    const shown = list.filter(s => filter === "all" ? true : filter === "upcoming" ? s.date >= today : s.date < today);
    if (filter === "past") shown.reverse();
    page.innerHTML = `
      ${head("Sessions & impact", `${plural(list.length, "session")} · ${k} groups`, `<button class="btn btn-ghost sm" id="exp-s">${ICON.download} Export CSV</button>`)}
      <details class="card gen" ${list.length ? "" : "open"}><summary><h2 class="card-title">${ICON.calPlus} Generate a rotation</h2><span class="fine">One group per week, Group 1 → ${k}</span></summary>
        <form id="f-gen" class="form gen-form">
          <label>First session<input type="date" name="start" value="${nextMon}" required></label>
          <label>Weeks<input type="number" name="weeks" value="${k * 2}" min="1" max="40" required></label>
          <label>Start<input type="time" name="start_time" value="10:50" required></label>
          <label>End<input type="time" name="end_time" value="11:40" required></label>
          <label>Meeting point<input name="location" value="Pick up at class"></label>
          <label>Lead admin<input name="supervisor" value="${esc(state.profile.full_name.split(" ")[0])}"></label>
          <button class="btn btn-primary">Create sessions</button></form></details>
      <details class="card gen"><summary><h2 class="card-title">${ICON.plus} Add a single session</h2></summary>
        <form id="f-one" class="form gen-form">
          <label>Date<input type="date" name="date" required></label>
          <label>Group<select name="group_id">${Array.from({ length: k }, (_, i) => `<option value="${i + 1}">Group ${i + 1}</option>`).join("")}</select></label>
          <label>Start<input type="time" name="start_time" value="10:50"></label><label>End<input type="time" name="end_time" value="11:40"></label>
          <label>Meeting point<input name="location" value="Pick up at class"></label><label>Lead admin<input name="supervisor"></label>
          <button class="btn btn-primary">Add session</button></form></details>
      <div class="tabs-inline">${[["upcoming", "Upcoming"], ["past", "Past"], ["all", "All"]].map(([v, l]) => `<button data-f="${v}" class="${filter === v ? "on" : ""}">${l}</button>`).join("")}</div>
      ${shown.length ? `<div class="slist2">${shown.map(s => {
        const mem = students.filter(m => m.group_id === s.group_id);
        const marks = attendance.filter(a => a.session_id === s.id);
        const pres = marks.filter(a => PRESENT.has(a.status)).length;
        const pend = reqs.filter(r => r.session_id === s.id && r.status === "pending").length;
        return `<article class="srow ${s.date < today ? "past" : ""} ${openId === s.id ? "open" : ""} st-${s.status}">
          <div class="srow-main">
            <div class="sdate"><b>${fmtDate(s.date, { day: "numeric" })}</b><span>${fmtDate(s.date, { month: "short" })}</span></div>
            <div class="sbody"><b>Group ${s.group_id} · ${fmtDate(s.date, { weekday: "long" })}</b>
              <span>${esc(s.start_time || "")}${s.end_time ? "–" + esc(s.end_time) : ""}${s.location ? " · " + esc(s.location) : ""}${s.supervisor ? " · " + esc(s.supervisor) : ""}</span></div>
            ${pend ? `<span class="pill pill-excused">${pend} absence req.</span>` : ""}
            ${s.status === "done" ? `<span class="pill pill-present">${kgTxt(s.kg)} kg · ${s.bags || 0} bags</span>` : s.status === "cancelled" ? `<span class="pill pill-absent">Cancelled</span>` : ""}
            <span class="pill ${marks.length ? "pill-present" : "pill-up"}">${marks.length ? `${pres}/${mem.length} present` : `${mem.length} people`}</span>
            <button class="btn btn-ghost xs" data-open="${s.id}">${openId === s.id ? "Close" : "Manage"}</button>
          </div>
          ${openId === s.id ? `<div class="spanel">
            <form class="impact" data-impact="${s.id}">
              <label>Status<select name="status">${["scheduled", "done", "cancelled"].map(v => `<option ${s.status === v ? "selected" : ""}>${v}</option>`).join("")}</select></label>
              <label>${ICON.scale} kg recycled<input name="kg" type="number" step="0.1" min="0" value="${s.kg ?? ""}"></label>
              <label>${ICON.bag} Bags<input name="bags" type="number" min="0" value="${s.bags ?? ""}"></label>
              <label class="wide">${ICON.camera} Photos link<input name="photos_url" type="url" value="${esc(s.photos_url || "")}" placeholder="Google Photos / Drive album"></label>
              <button class="btn btn-primary sm">Save session</button>
              <button type="button" class="iconbtn danger" data-sdel="${s.id}" title="Delete session" aria-label="Delete">${ICON.trash}</button>
            </form>
            <div class="att">
              <div class="att-head"><b>Attendance</b><button class="btn btn-ghost xs" data-allp="${s.id}">Mark all present</button></div>
              ${mem.length ? mem.map(m => { const cur = marks.find(a => a.user_id === m.id)?.status; const rq = reqs.find(r => r.session_id === s.id && r.user_id === m.id);
                return `<div class="att-row"><span>${esc(m.full_name)}${rq ? ` <small class="pill pill-excused" title="${esc(rq.reason)}">Request ${rq.status}</small>` : ""}</span><div class="att-btns">${["present", "late", "excused", "absent"].map(st =>
                  `<button class="att-b att-${st} ${cur === st ? "on" : ""}" data-sid="${s.id}" data-uid="${m.id}" data-st="${st}">${st}</button>`).join("")}</div></div>`; }).join("")
                : `<p class="muted">No one in Group ${s.group_id} yet.</p>`}
            </div></div>` : ""}
        </article>`; }).join("")}</div>` : `<div class="empty">${ICON.cal}<p>No ${filter === "all" ? "" : filter} sessions.</p></div>`}`;

    $$("[data-f]").forEach(b => b.addEventListener("click", () => { filter = b.dataset.f; render(); }));
    $("#f-gen").addEventListener("submit", (e) => {
      e.preventDefault(); const f = Object.fromEntries(new FormData(e.target)); const rows = []; const d0 = new Date(f.start + "T12:00");
      for (let w = 0; w < +f.weeks; w++) { const d = new Date(d0); d.setDate(d0.getDate() + 7 * w);
        rows.push({ date: d.toISOString().slice(0, 10), group_id: (w % k) + 1, start_time: f.start_time, end_time: f.end_time, location: f.location, supervisor: f.supervisor }); }
      busy(e.submitter, async () => { list.push(...await api.createSessions(rows)); list.sort((a, b) => a.date.localeCompare(b.date)); toast(`${rows.length} sessions created`); filter = "upcoming"; render(); });
    });
    $("#f-one").addEventListener("submit", (e) => {
      e.preventDefault(); const f = Object.fromEntries(new FormData(e.target)); f.group_id = +f.group_id;
      busy(e.submitter, async () => { list.push(...await api.createSessions([f])); list.sort((a, b) => a.date.localeCompare(b.date)); toast("Session added"); render(); });
    });
    $$("[data-open]").forEach(b => b.addEventListener("click", () => { openId = openId === +b.dataset.open ? null : +b.dataset.open; render(); }));
    $$("[data-impact]").forEach(f => f.addEventListener("submit", (e) => {
      e.preventDefault(); const id = +f.dataset.impact;
      const patch = { status: f.status.value, kg: f.kg.value === "" ? null : +f.kg.value, bags: f.bags.value === "" ? null : +f.bags.value, photos_url: f.photos_url.value.trim() || null };
      busy(e.submitter, async () => { await api.updateSession(id, patch); Object.assign(list.find(s => s.id === id), patch); toast("Session saved"); render(); });
    }));
    $$("[data-sdel]").forEach(b => b.addEventListener("click", () => {
      if (!confirm("Delete this session and its attendance?")) return;
      busy(null, async () => { const id = +b.dataset.sdel; await api.deleteSession(id); list.splice(list.findIndex(s => s.id === id), 1); openId = null; render(); });
    }));
    const setAtt = async (sid, uid, st) => {
      const cur = attendance.find(a => a.session_id === sid && a.user_id === uid);
      const next = cur?.status === st ? null : st; await api.setAttendance(sid, uid, next);
      const i = attendance.indexOf(cur); if (i >= 0) attendance.splice(i, 1); if (next) attendance.push({ session_id: sid, user_id: uid, status: next });
    };
    $$(".att-b").forEach(b => b.addEventListener("click", () => busy(null, async () => { await setAtt(+b.dataset.sid, b.dataset.uid, b.dataset.st); render(); })));
    $$("[data-allp]").forEach(b => b.addEventListener("click", () => busy(b, async () => {
      const sid = +b.dataset.allp; const s = list.find(x => x.id === sid);
      for (const m of students.filter(m => m.group_id === s.group_id)) if (!attendance.some(a => a.session_id === sid && a.user_id === m.id)) await setAtt(sid, m.id, "present");
      toast("Everyone marked present"); render();
    })));
    $("#exp-s").addEventListener("click", () => {
      download(`GRC-recycling-sessions-${todayISO()}.csv`, csv([["Date", "Day", "Group", "Start", "End", "Location", "Lead", "Status", "Present", "Group size", "kg", "Bags", "Photos"],
        ...list.map(s => [s.date, fmtDate(s.date, { weekday: "long" }), `Group ${s.group_id}`, s.start_time, s.end_time, s.location, s.supervisor, s.status,
          attendance.filter(a => a.session_id === s.id && PRESENT.has(a.status)).length, students.filter(m => m.group_id === s.group_id).length, s.kg ?? "", s.bags ?? "", s.photos_url || ""])]));
    });
  };
  render();
}

// ================================================================ ATTENDANCE MATRIX
export async function attendance(page) {
  const [{ students, profiles }, list, att, reqs] = await Promise.all([base(), api.listSessions(), api.listAttendance(), api.listAbsenceRequests()]);
  const byId = Object.fromEntries(profiles.map(p => [p.id, p]));
  const today = todayISO();
  let gFilter = "";
  const CYCLE = [null, "present", "late", "excused", "absent"];
  const SYM = { present: "✓", late: "L", excused: "E", absent: "✕" };

  const render = () => {
    const past = list.filter(s => s.date <= today && s.status !== "cancelled" && (!gFilter || s.group_id === +gFilter));
    const people = students.filter(s => !gFilter || s.group_id === +gFilter).sort((a, b) => (a.group_id || 99) - (b.group_id || 99) || a.full_name.localeCompare(b.full_name));
    const overall = attendanceStats(past, att);
    const pend = reqs.filter(r => r.status === "pending");
    page.innerHTML = `
      ${head("Attendance tracker", "Every member across every session. Click a cell to change it.", `<button class="btn btn-primary sm" id="exp-a">${ICON.download} Export CSV</button>`)}
      ${pend.length ? `<article class="card reqs reveal"><header class="card-h"><h2>${ICON.bell} Absence requests <span class="count">${pend.length}</span></h2></header>
        <ul class="slist">${pend.map(r => { const s = list.find(x => x.id === r.session_id); const late = s && (new Date(s.date + "T" + (s.start_time || "09:00")) - new Date(r.created_at)) < 864e5; return `<li class="sline">
          <div class="sbody"><b>${short(byId[r.user_id])} · Group ${s?.group_id ?? "?"} · ${s ? fmtDate(s.date) : ""}</b><span>${esc(r.reason)}${late ? ` <em class="warn-txt">· less than 24 h notice</em>` : ""}</span></div>
          <button class="btn btn-primary xs" data-req="${r.id}" data-st="approved">${ICON.check} Approve</button><button class="btn btn-ghost xs" data-req="${r.id}" data-st="declined">Decline</button></li>`; }).join("")}</ul></article>` : ""}
      <div class="att-summary">
        ${ring(overall.rate, "overall", 104)}
        <div class="tile tile-present"><b>${overall.present}</b><small>present</small></div><div class="tile tile-late"><b>${overall.late}</b><small>late</small></div>
        <div class="tile tile-excused"><b>${overall.excused}</b><small>excused</small></div><div class="tile tile-absent"><b>${overall.absent}</b><small>absent</small></div>
        <div class="tile tile-hours"><b>${hoursText(overall.hours)}</b><small>person-hours</small></div>
      </div>
      <div class="toolbar"><select id="gf"><option value="">All groups</option>${[...new Set(students.map(s => s.group_id).filter(Boolean))].sort().map(g => `<option value="${g}" ${+gFilter === g ? "selected" : ""}>Group ${g}</option>`).join("")}</select>
        <div class="legend inline">${Object.entries(SYM).map(([k2, v]) => `<span class="amx-key amx-${k2}">${v}</span>${k2}`).join(" ")}<span class="amx-key amx-na">·</span>not their group</div></div>
      ${past.length && people.length ? `<div class="matrix-wrap"><table class="amx"><thead><tr><th>Member</th><th>Rate</th>${past.map(s => `<th title="Group ${s.group_id}"><span>${fmtDate(s.date, { day: "numeric", month: "short" })}</span><small>G${s.group_id}</small></th>`).join("")}</tr></thead>
        <tbody>${people.map(m => { const st = attendanceStats(memberSessions(m, past, att), att.filter(a => a.user_id === m.id)); return `<tr><th>${esc(m.full_name)}<small>G${m.group_id || "–"}</small></th>
          <td class="rate ${st.rate == null ? "" : st.rate >= 80 ? "good" : st.rate >= 50 ? "mid" : "bad"}">${st.rate ?? "—"}${st.rate != null ? "%" : ""}</td>
          ${past.map(s => { const a = att.find(x => x.session_id === s.id && x.user_id === m.id)?.status; if (s.group_id !== m.group_id && !a) return `<td class="amx-na">·</td>`;
            return `<td><button class="amx-c ${a ? "amx-" + a : ""}" data-s="${s.id}" data-u="${m.id}" title="${a || "not marked"}">${a ? SYM[a] : ""}</button></td>`; }).join("")}</tr>`; }).join("")}</tbody></table></div>`
        : `<div class="empty">${ICON.calCheck}<p>Attendance appears here once sessions have taken place.</p></div>`}`;

    $("#gf").addEventListener("change", (e) => { gFilter = e.target.value; render(); });
    $$(".amx-c").forEach(b => b.addEventListener("click", () => busy(null, async () => {
      const sid = +b.dataset.s, uid = b.dataset.u; const cur = att.find(a => a.session_id === sid && a.user_id === uid);
      const next = CYCLE[(CYCLE.indexOf(cur?.status ?? null) + 1) % CYCLE.length];
      await api.setAttendance(sid, uid, next); const i = att.indexOf(cur); if (i >= 0) att.splice(i, 1); if (next) att.push({ session_id: sid, user_id: uid, status: next }); render();
    })));
    $$("[data-req]").forEach(b => b.addEventListener("click", () => busy(b, async () => {
      const id = +b.dataset.req, st = b.dataset.st; await api.setAbsenceStatus(id, st);
      const r = reqs.find(x => x.id === id); r.status = st;
      if (st === "approved") { const i = att.findIndex(a => a.session_id === r.session_id && a.user_id === r.user_id); if (i >= 0) att.splice(i, 1); att.push({ session_id: r.session_id, user_id: r.user_id, status: "excused" }); }
      toast(st === "approved" ? "Approved · marked as excused" : "Declined"); render();
      const nb = document.querySelector('[data-badge="absences"]'); if (nb) { const n = reqs.filter(x => x.status === "pending").length; nb.textContent = n; nb.hidden = !n; }
    })));
    $("#exp-a").addEventListener("click", () => {
      download(`GRC-recycling-attendance-${todayISO()}.csv`, csv([["GRC ID", "Name", "Group", "Rate %", "Present", "Late", "Excused", "Absent", "Hours", ...past.map(s => `${s.date} G${s.group_id}`)],
        ...people.map(m => { const st = attendanceStats(memberSessions(m, past, att), att.filter(a => a.user_id === m.id));
          return [m.grc_id, m.full_name, m.group_id ? `Group ${m.group_id}` : "", st.rate ?? "", st.present, st.late, st.excused, st.absent, hoursText(st.hours),
            ...past.map(s => att.find(a => a.session_id === s.id && a.user_id === m.id)?.status || "")]; })]));
    });
  };
  render();
}

// ================================================================ NEWS
export async function news(page) {
  const list = await api.listAnnouncements();
  page.innerHTML = `
    ${head("Announcements", "Shown on every student's Home page and in their Announcements.")}
    <form class="card form" id="f-news">
      <label>Title<input name="title" required maxlength="120" placeholder="e.g. Group 2: session moved to Thursday"></label>
      <label>Message<textarea name="body" rows="4" required maxlength="2000"></textarea></label>
      <div class="row-2 eq"><label>Signed as<input name="author" value="${esc(state.profile.full_name.split(" ")[0])} · GRC"></label>
        <label class="switch" style="align-self:end"><input type="checkbox" name="pinned"><span></span>Pin to top</label></div>
      <button class="btn btn-primary">${ICON.megaphone} Post announcement</button>
    </form>
    <div class="news">${list.map(n => `<article class="news-item ${n.pinned ? "pinned" : ""}"><header>${n.pinned ? `<span class="pill pill-up">📌 Pinned</span>` : ""}<h3>${esc(n.title)}</h3><time>${fmtDate(n.created_at.slice(0, 10), { day: "numeric", month: "short" })}</time>
      <button class="iconbtn" data-pin="${n.id}" title="${n.pinned ? "Unpin" : "Pin"}" aria-label="Pin">📌</button><button class="iconbtn danger" data-ndel="${n.id}" aria-label="Delete">${ICON.trash}</button></header>
      <p>${nl2br(n.body)}</p>${n.author ? `<footer>${esc(n.author)}</footer>` : ""}</article>`).join("") || `<p class="muted">Nothing posted yet.</p>`}</div>`;
  $("#f-news").addEventListener("submit", (e) => {
    e.preventDefault(); const f = e.target;
    busy(e.submitter, async () => { await api.postAnnouncement({ title: f.title.value.trim(), body: f.body.value.trim(), author: f.author.value.trim(), pinned: f.pinned.checked }); toast("Posted"); news(page); });
  });
  $$("[data-pin]").forEach(b => b.addEventListener("click", () => busy(null, async () => { const n = list.find(x => x.id === +b.dataset.pin); await api.updateAnnouncement(n.id, { pinned: !n.pinned }); news(page); })));
  $$("[data-ndel]").forEach(b => b.addEventListener("click", () => { if (!confirm("Delete this announcement?")) return; busy(null, async () => { await api.deleteAnnouncement(+b.dataset.ndel); news(page); }); }));
}

// ================================================================ SCHOOLS
export async function schools(page) {
  const [list, { profiles }] = await Promise.all([api.listSchools(), base()]);
  page.innerHTML = `
    ${head("Schools", "The schools Greenroots works with. Students choose theirs when they sign up and must use that school's email domain.", `<button class="btn btn-primary sm" id="add-s">${ICON.plus} Add school</button>`)}
    <div class="school-grid">${list.map(s => { const n = profiles.filter(p => p.school_id === s.id && p.role === "student").length; return `
      <article class="scard ${s.active ? "" : "off"} reveal"><span class="scard-ic">${ICON.school}</span>
        <h3>${esc(s.name)}</h3><p class="muted">${esc(s.city || "")}</p>
        <dl><div><dt>Students</dt><dd>@${esc(s.student_domain)}</dd></div><div><dt>Staff</dt><dd>${s.staff_domain ? "@" + esc(s.staff_domain) : "—"}</dd></div></dl>
        <footer><span class="pill ${s.active ? "pill-present" : "pill-pending"}">${s.active ? "Active" : "Hidden"}</span><span class="fine">${plural(n, "student")}</span><button class="btn btn-ghost xs" data-edit="${s.id}">${ICON.pen} Edit</button></footer></article>`; }).join("")}</div>`;
  const form = (s = {}) => `<form class="form" id="f-sch">
    <label>School name<input name="name" required value="${esc(s.name || "")}" placeholder="e.g. Agora Madrid International School"></label>
    <label>City<input name="city" value="${esc(s.city || "")}"></label>
    <div class="row-2 eq"><label>Student email domain<input name="student_domain" required value="${esc(s.student_domain || "")}" placeholder="student.school.com"></label>
      <label>Staff email domain<input name="staff_domain" value="${esc(s.staff_domain || "")}" placeholder="school.com"></label></div>
    <label class="switch"><input type="checkbox" name="active" ${s.active !== false ? "checked" : ""}><span></span>Show in the sign-up form</label>
    <button class="btn btn-primary">${s.id ? "Save" : "Add school"}</button></form>`;
  const open = (s) => {
    const m = modal(s ? "Edit school" : "Add school", form(s || {}));
    $("#f-sch", m.el).addEventListener("submit", (e) => {
      e.preventDefault(); const f = e.target; const clean = (v) => v.trim().toLowerCase().replace(/^@/, "");
      const row = { name: f.name.value.trim(), city: f.city.value.trim() || null, student_domain: clean(f.student_domain.value), staff_domain: clean(f.staff_domain.value) || null, active: f.active.checked };
      busy(e.submitter, async () => { s ? await api.updateSchool(s.id, row) : await api.createSchool(row); m.close(); state.schools = await api.listSchools(); toast("Saved"); schools(page); });
    });
  };
  $("#add-s").addEventListener("click", () => open(null));
  $$("[data-edit]").forEach(b => b.addEventListener("click", () => open(list.find(s => s.id === +b.dataset.edit))));
}

// ================================================================ SETTINGS
export async function settings(page) {
  const [st, secrets] = await Promise.all([api.getSettings(), api.getSecrets()]);
  page.innerHTML = `
    ${head("Settings")}
    <div class="grid-2">
      <form class="card form" id="f-codes"><header class="card-h"><h2>${ICON.key} Access codes</h2></header>
        <label>Student join code<input name="join_code" value="${esc(secrets.join_code)}" required class="mono"></label>
        <p class="fine">Share this in the email or WhatsApp Community. Anyone with a school email and this code becomes a participant.</p>
        <label>Admin code<input name="admin_code" value="${esc(secrets.admin_code)}" required class="mono"></label>
        <p class="fine">Only for GRC admins. It grants full admin access. Change it if it leaks.</p>
        <button class="btn btn-primary">Save codes</button></form>
      <form class="card form" id="f-set"><header class="card-h"><h2>${ICON.gear} Programme</h2></header>
        <label class="switch"><input type="checkbox" name="survey_open" ${st.survey_open ? "checked" : ""}><span></span>Group survey open for answers</label>
        <label class="switch"><input type="checkbox" name="groups_published" ${st.groups_published ? "checked" : ""}><span></span>Groups & sessions visible to students</label>
        <button class="btn btn-primary">Save</button>
        <div class="divider"></div>
        <p class="fine">Connected to: <b>${api.mode === "demo" ? "Demo (this browser only)" : "Live database"}</b></p>
        <p class="fine">Your password: <a href="#/settings" id="pw-link">change it below</a></p></form>
      <form class="card form" id="f-pw"><header class="card-h"><h2>${ICON.lock} Change password</h2></header>
        <label>New password<input name="pw" type="password" minlength="8" required autocomplete="new-password"></label>
        <button class="btn btn-ghost">Update password</button></form>
    </div>`;
  $("#pw-link").addEventListener("click", (e) => { e.preventDefault(); $("#f-pw input").focus(); });
  $("#f-codes").addEventListener("submit", (e) => {
    e.preventDefault(); const f = Object.fromEntries(new FormData(e.target));
    if (f.join_code.trim().toUpperCase() === f.admin_code.trim().toUpperCase()) { toast("The two codes must be different", "err"); return; }
    busy(e.submitter, async () => { await api.updateSecrets({ join_code: f.join_code.trim(), admin_code: f.admin_code.trim() }); toast("Codes saved"); });
  });
  $("#f-set").addEventListener("submit", (e) => {
    e.preventDefault(); const f = e.target;
    busy(e.submitter, async () => { state.settings = await api.updateSettings({ survey_open: f.survey_open.checked, groups_published: f.groups_published.checked }); toast("Settings saved"); });
  });
  $("#f-pw").addEventListener("submit", (e) => {
    e.preventDefault(); busy(e.submitter, async () => { await api.updatePassword(new FormData(e.target).get("pw")); e.target.reset(); toast("Password updated"); });
  });
}
