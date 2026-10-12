// Student portal pages.
import {
  api, state, CONFIG, $, $$, esc, cap, addDaysISO, first, initials, plural, nl2br, todayISO, parseDate, fmtDate, daysUntil, relDay,
  duration, hoursText, sessionStart, toast, busy, download, modal, sessionsToICS, attendanceStats, PRESENT,
  BADGES, earnedBadges, ring, ICON, treeImg, badgeLogo,
} from "./core.js";

const RATING = [null, "Rather not", "Not really", "Neutral", "Would like", "Really want"];
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];
const OUTCOMES = [
  "LO1 · Identify own strengths and areas for growth",
  "LO2 · Undertake challenges and develop new skills",
  "LO3 · Initiate and plan a CAS experience",
  "LO4 · Show commitment and perseverance",
  "LO5 · Work collaboratively",
  "LO6 · Engage with issues of global significance",
  "LO7 · Recognise the ethics of choices and actions",
];
const SEEN_KEY = "grc-news-seen";
const seenAt = () => { try { return localStorage.getItem(SEEN_KEY) || ""; } catch { return ""; } };
const markSeen = () => { try { localStorage.setItem(SEEN_KEY, new Date().toISOString()); } catch { /* ignore */ } };

// Badges earned since this browser last showed them get a small celebration (flip, light sweep, toast).
const badgesKey = () => `grc-badges-seen-${state.profile.id}`;
function freshBadges(badges) {
  let seen = null;
  try { seen = JSON.parse(localStorage.getItem(badgesKey()) || "null"); } catch { /* ignore */ }
  // first visit on this browser: only a brand-new member (just the Seedling) is celebrated
  if (!Array.isArray(seen)) return badges.size === 1 ? [...badges] : [];
  return [...badges].filter(b => !seen.includes(b));
}
function celebrate(fresh, badges) {
  try { localStorage.setItem(badgesKey(), JSON.stringify([...badges])); } catch { /* ignore */ }
  if (!fresh.length) return;
  const names = fresh.map(id => BADGES.find(b => b.id === id).name);
  const msg = names.length === 1 ? `Badge earned: ${names[0]} 🏅` : `${names.length} new badges: ${names.join(", ")} 🏅`;
  setTimeout(() => toast(msg), $(".toast") ? 3600 : 1400); // never cut off another toast, e.g. "You're in!"
}

// ---------------------------------------------------------------- data
async function load() {
  const [sessions, attendance, tasks, taskDone, submission, reflections, absences, league, news, settings] = await Promise.all([
    api.listMySessions(), api.listMyAttendance(), api.listTasks(), api.listMyTaskDone(), api.getMySubmission(),
    api.listMyReflections(), api.listMyAbsences(), api.groupLeague().catch(() => []), api.listAnnouncements(), api.getSettings(),
  ]);
  state.settings = settings;
  const p = state.profile;
  const published = settings.groups_published && p.group_id;
  const attended = new Set(attendance.map(a => a.session_id));
  const mySessions = sessions.filter(s => (published && s.group_id === p.group_id) || attended.has(s.id));
  const stats = attendanceStats(mySessions, attendance);
  const doneIds = new Set(taskDone.map(t => t.task_id));
  const agreeTask = tasks.find(t => t.type === "acknowledge");
  const myLeague = league.find(l => l.group_id === p.group_id);
  const activities = buildActivities({ tasks, doneIds, submission, settings, mySessions, attendance, reflections });
  const badges = earnedBadges({ survey: !!submission, agreed: agreeTask ? doneIds.has(agreeTask.id) : false, stats, reflections: reflections.length, groupKg: +(myLeague?.kg || 0) });
  return { sessions: mySessions, attendance, tasks, doneIds, submission, reflections, absences, league, myLeague, news, settings, published, stats, activities, badges };
}

function buildActivities({ tasks, doneIds, submission, settings, mySessions, attendance, reflections }) {
  const today = todayISO();
  const items = tasks.filter(t => t.active).map(t => {
    const done = t.type === "survey" ? !!submission : doneIds.has(t.id);
    const closed = t.type === "survey" && !settings.survey_open && !done;
    return { key: "t" + t.id, type: t.type, title: t.title, body: t.body, url: t.url, due: t.due_date, done, closed,
      overdue: !done && !closed && t.due_date && t.due_date < today, task: t };
  });
  const reflected = new Set(reflections.map(r => r.session_id));
  attendance.filter(a => PRESENT.has(a.status)).forEach(a => {
    const s = mySessions.find(x => x.id === a.session_id); if (!s) return;
    const due = addDaysISO(s.date, 7);
    const done = reflected.has(s.id);
    items.push({ key: "r" + s.id, type: "reflection", title: `Reflect on your ${fmtDate(s.date, { day: "numeric", month: "short" })} session`,
      body: "A few lines for your CAS portfolio: what you did and what you learned.", due, done, closed: false, overdue: !done && due < today, session: s });
  });
  const rank = (x) => x.done ? 3 : x.closed ? 2 : x.overdue ? 0 : 1;
  return items.sort((a, b) => rank(a) - rank(b) || (a.due || "9999").localeCompare(b.due || "9999"));
}

export async function navBadges() {
  const [tasks, taskDone, submission, attendance, reflections, news, settings] = await Promise.all([
    api.listTasks(), api.listMyTaskDone(), api.getMySubmission(), api.listMyAttendance(), api.listMyReflections(), api.listAnnouncements(), api.getSettings()]);
  const doneIds = new Set(taskDone.map(t => t.task_id));
  const reflected = new Set(reflections.map(r => r.session_id));
  let n = tasks.filter(t => t.active && !(t.type === "survey" ? (submission || !settings.survey_open) : doneIds.has(t.id))).length;
  n += attendance.filter(a => PRESENT.has(a.status) && !reflected.has(a.session_id)).length;
  const seen = seenAt();
  return { tasks: n, news: news.filter(a => a.created_at > seen).length };
}

const TYPE = {
  survey: { icon: "users", label: "Survey", cls: "t-survey" },
  acknowledge: { icon: "handshake", label: "Agreement", cls: "t-ack" },
  link: { icon: "link", label: "Link", cls: "t-link" },
  reflection: { icon: "pen", label: "CAS reflection", cls: "t-refl" },
};

function dueChip(a) {
  if (a.done) return `<span class="pill pill-present">${ICON.check} Done</span>`;
  if (a.closed) return `<span class="pill pill-pending">Closed</span>`;
  if (!a.due) return `<span class="pill pill-up">To do</span>`;
  if (a.overdue) return `<span class="pill pill-absent">Overdue</span>`;
  const n = daysUntil(a.due);
  return `<span class="pill ${n <= 2 ? "pill-excused" : "pill-up"}">Due ${n === 0 ? "today" : n === 1 ? "tomorrow" : fmtDate(a.due, { day: "numeric", month: "short" })}</span>`;
}

function activityRow(a) {
  const t = TYPE[a.type];
  return `<a class="act ${a.done ? "done" : ""}" href="#/activity/${a.key}">
    <span class="act-ic ${t.cls}">${ICON[t.icon]}</span>
    <span class="act-body"><small>${t.label}</small><b>${esc(a.title)}</b></span>
    ${dueChip(a)}<span class="act-go">${ICON.chev}</span></a>`;
}

function sessionLine(s, { att, absence, actions = true } = {}) {
  const past = s.date < todayISO();
  const st = att?.status;
  let pill = "";
  if (s.status === "cancelled") pill = `<span class="pill pill-absent">Cancelled</span>`;
  else if (st) pill = `<span class="pill pill-${st}">${cap(st)}</span>`;
  else if (absence) pill = `<span class="pill pill-excused">Absence ${absence.status}</span>`;
  else pill = past ? `<span class="pill pill-pending">Not marked</span>` : `<span class="pill pill-up">${cap(relDay(s.date))}</span>`;
  return `<li class="sline ${past ? "past" : ""}">
    <div class="sdate"><b>${fmtDate(s.date, { day: "numeric" })}</b><span>${fmtDate(s.date, { month: "short" })}</span></div>
    <div class="sbody"><b>${fmtDate(s.date, { weekday: "long" })} · Group ${s.group_id}</b>
      <span>${ICON.clock}${esc(s.start_time || "")}${s.end_time ? "–" + esc(s.end_time) : ""}${s.location ? ` ${ICON.pin}${esc(s.location)}` : ""}</span></div>
    ${pill}
    ${actions && !past && s.status !== "cancelled" ? `<div class="sline-act">
      <button class="iconbtn" data-ics="${s.id}" title="Add to calendar" aria-label="Add to calendar">${ICON.calPlus}</button>
      ${absence ? "" : `<button class="btn btn-ghost xs" data-absent="${s.id}">Can't make it</button>`}</div>` : ""}
    ${past && s.photos_url ? `<a class="iconbtn" href="${esc(s.photos_url)}" target="_blank" rel="noopener" title="Session photos" aria-label="Session photos">${ICON.camera}</a>` : ""}
  </li>`;
}

function bindSessionActions(root, sessions, rerender) {
  $$("[data-ics]", root).forEach(b => b.addEventListener("click", () => {
    const s = sessions.find(x => x.id === +b.dataset.ics);
    download(`GRC-recycling-${s.date}.ics`, sessionsToICS([s]), "text/calendar"); toast("Calendar file downloaded. Open it to add the session.");
  }));
  $$("[data-absent]", root).forEach(b => b.addEventListener("click", () => {
    const s = sessions.find(x => x.id === +b.dataset.absent);
    const hrs = (sessionStart(s) - new Date()) / 36e5;
    const m = modal("Can't make it?", `
      <p class="muted">${fmtDate(s.date, { weekday: "long", day: "numeric", month: "long" })} · ${esc(s.start_time || "")}</p>
      ${hrs < 24 ? `<div class="notice warn">${ICON.alert} This is less than 24 hours away. Please also message the admin team on WhatsApp right now.</div>` : ""}
      <form class="form" id="f-abs"><label>Reason<textarea name="reason" rows="3" required maxlength="300" placeholder="e.g. Maths exam that period / school trip / feeling unwell"></textarea></label>
      <p class="fine">The admin team will review it. Approved requests are marked as excused and don't affect your attendance rate.</p>
      <button class="btn btn-primary wide">Send request</button></form>`);
    $("#f-abs", m.el).addEventListener("submit", (e) => {
      e.preventDefault();
      busy(e.submitter, async () => { await api.requestAbsence(s.id, new FormData(e.target).get("reason").trim()); m.close(); toast("Request sent to the admin team"); rerender(); });
    });
  }));
}

const pageHead = (eyebrow, title, sub = "", right = "") => `
  <div class="phead"><div><p class="eyebrow dark">${eyebrow}</p><h1>${title}</h1>${sub ? `<p class="phead-sub">${sub}</p>` : ""}</div>${right}</div>`;

// ================================================================ HOME
export async function viewHome(page) {
  const p = state.profile;
  const d = await load();
  const today = todayISO();
  const upcoming = d.sessions.filter(s => s.date >= today && s.status !== "cancelled");
  const next = upcoming[0];
  const todo = d.activities.filter(a => !a.done && !a.closed);
  const absOf = (id) => d.absences.find(a => a.session_id === id);
  const hour = new Date().getHours();
  const greet = hour < 12 ? "Good morning" : hour < 19 ? "Good afternoon" : "Good evening";
  const maxKg = Math.max(1, ...d.league.map(l => +l.kg));
  const fresh = freshBadges(d.badges);

  page.innerHTML = `
    <section class="hbanner reveal">
      <div class="hbanner-copy">
        <p class="hbanner-date">${fmtDate(today, { weekday: "long", day: "numeric", month: "long" })}</p>
        <h1>${greet}, ${first(p.full_name)}.</h1>
        <p>${todo.length ? `You have <b>${plural(todo.length, "activity", "activities")}</b> to complete${next ? ` and your next session is <b>${relDay(next.date)}</b>` : ""}.` : next ? `You're all caught up. Next session <b>${relDay(next.date)}</b>.` : "You're all caught up. Nice work!"}</p>
        <div class="hbanner-chips">
          <span class="hchip">${ICON.users}${d.published ? `Group ${p.group_id}` : "Group being built"}</span>
          <span class="hchip">${ICON.award}${d.badges.size}/${BADGES.length} badges</span>
          <span class="hchip">${ICON.flame}${d.stats.streak} streak</span>
        </div>
      </div>
      <div class="hbanner-ring">${ring(d.stats.rate, "attendance", 132)}</div>
    </section>

    <div class="hgrid">
      <article class="card next-card reveal">
        <header class="card-h"><h2>${ICON.cal} Up next</h2><a class="small-link" href="#/calendar">Calendar ${ICON.chev}</a></header>
        ${next ? `
          <div class="next">
            <div class="next-date"><span>${fmtDate(next.date, { month: "short" })}</span><b>${fmtDate(next.date, { day: "numeric" })}</b><em>${fmtDate(next.date, { weekday: "short" })}</em></div>
            <div class="next-info">
              <p class="next-when">${cap(relDay(next.date))}</p>
              <p class="meta">${ICON.clock}${esc(next.start_time || "")}${next.end_time ? "–" + esc(next.end_time) : ""}</p>
              ${next.location ? `<p class="meta">${ICON.pin}${esc(next.location)}</p>` : ""}
              ${next.supervisor ? `<p class="meta">${ICON.user}Led by ${esc(next.supervisor)}</p>` : ""}
            </div>
          </div>
          <div class="next-actions">
            <button class="btn btn-primary sm" data-ics="${next.id}">${ICON.calPlus} Add to calendar</button>
            ${absOf(next.id) ? `<span class="pill pill-excused">Absence ${absOf(next.id).status}</span>` : `<button class="btn btn-ghost sm" data-absent="${next.id}">Can't make it</button>`}
          </div>` : `<div class="empty-mini">${ICON.cal}<p>${d.published ? "No sessions scheduled yet." : "Your session dates appear once groups are published."}</p></div>`}
      </article>

      <article class="card todo-card reveal">
        <header class="card-h"><h2>${ICON.tasks} To do</h2><a class="small-link" href="#/activities">All activities ${ICON.chev}</a></header>
        ${todo.length ? `<div class="acts">${todo.slice(0, 4).map(activityRow).join("")}</div>`
          : `<div class="empty-mini done">${ICON.checkCircle}<p>All done! New activities will show up here.</p></div>`}
      </article>

      <article class="card stat-strip reveal">
        <div><span class="si">${ICON.calCheck}</span><b>${d.stats.attended}</b><small>sessions attended</small></div>
        <div><span class="si">${ICON.clock}</span><b>${hoursText(d.stats.hours)}</b><small>CAS hours</small></div>
        <div><span class="si">${ICON.scale}</span><b>${(+(d.myLeague?.kg || 0)).toFixed(1).replace(/\.0$/, "")}</b><small>kg by your group</small></div>
        <div><span class="si">${ICON.pen}</span><b>${d.reflections.length}</b><small>reflections</small></div>
      </article>

      <article class="card badges-card reveal">
        <header class="card-h"><h2>${ICON.award} Badges</h2><a class="small-link" href="#/profile">See all ${ICON.chev}</a></header>
        <div class="badge-row">${BADGES.map(b => `<span class="medal ${d.badges.has(b.id) ? "on" : ""} ${fresh.includes(b.id) ? "fresh" : ""}" title="${esc(b.name)}: ${esc(b.desc)}">${ICON[b.icon]}</span>`).join("")}</div>
        <p class="fine">${d.badges.size} of ${BADGES.length} earned. Next: <b>${esc(BADGES.find(b => !d.badges.has(b.id))?.desc || "you've got them all! 🎉")}</b></p>
      </article>

      <article class="card league-card reveal">
        <header class="card-h"><h2>${ICON.trophy} Group league</h2><span class="fine">kg recycled</span></header>
        ${d.league.length ? `<ul class="league">${d.league.map(l => `<li class="${l.group_id === p.group_id ? "me" : ""}">
          <span>G${l.group_id}${l.group_id === p.group_id ? " · you" : ""}</span><div class="lbar"><i style="width:${(100 * +l.kg) / maxKg}%"></i></div><b>${(+l.kg).toFixed(1).replace(/\.0$/, "")}</b></li>`).join("")}</ul>`
          : `<div class="empty-mini">${ICON.trophy}<p>The league starts after the first sessions.</p></div>`}
      </article>

      <article class="card news-card reveal">
        <header class="card-h"><h2>${ICON.megaphone} Announcements</h2><a class="small-link" href="#/news">All ${ICON.chev}</a></header>
        ${d.news.length ? d.news.slice(0, 2).map(n => `<div class="news-mini ${n.pinned ? "pinned" : ""}"><b>${esc(n.title)}</b><p>${esc(n.body.slice(0, 140))}${n.body.length > 140 ? "…" : ""}</p><small>${esc(n.author || "")} · ${fmtDate(n.created_at.slice(0, 10), { day: "numeric", month: "short" })}</small></div>`).join("")
          : `<div class="empty-mini">${ICON.megaphone}<p>No announcements yet.</p></div>`}
      </article>
    </div>`;
  bindSessionActions(page, d.sessions, () => viewHome(page));
  celebrate(fresh, d.badges);
}

// ================================================================ ACTIVITIES
export async function viewActivities(page) {
  const d = await load();
  const todo = d.activities.filter(a => !a.done && !a.closed), done = d.activities.filter(a => a.done || a.closed);
  page.innerHTML = `
    ${pageHead("Recycling Initiative", "Activities", "Surveys, agreements, forms and CAS reflections. Everything you need to complete, with dates.")}
    <div class="act-summary reveal">
      <div class="asum"><b>${todo.length}</b><span>to do</span></div>
      <div class="asum warn"><b>${todo.filter(a => a.overdue).length}</b><span>overdue</span></div>
      <div class="asum ok"><b>${done.length}</b><span>completed</span></div>
    </div>
    <div class="tabs-inline" role="tablist"><button class="on" data-t="todo">To do (${todo.length})</button><button data-t="done">Completed (${done.length})</button></div>
    <div class="acts big" id="list-todo">${todo.length ? todo.map(activityRow).join("") : `<div class="empty">${ICON.checkCircle}<p>Nothing to do right now. Enjoy! 🌱</p></div>`}</div>
    <div class="acts big" id="list-done" hidden>${done.length ? done.map(activityRow).join("") : `<div class="empty">${ICON.tasks}<p>Completed activities will appear here.</p></div>`}</div>`;
  $$("[data-t]", page).forEach(b => b.addEventListener("click", () => {
    $$("[data-t]", page).forEach(x => x.classList.toggle("on", x === b));
    $("#list-todo").hidden = b.dataset.t !== "todo"; $("#list-done").hidden = b.dataset.t !== "done";
  }));
}

export async function viewActivity(page, key) {
  const d = await load();
  const a = d.activities.find(x => x.key === key);
  if (!a) { page.innerHTML = `<div class="empty">${ICON.alert}<p>This activity isn't available anymore.</p><a class="btn btn-primary" href="#/activities">Back to activities</a></div>`; return; }
  const back = `<a class="back" href="#/activities">${ICON.chevL} Activities</a>`;
  const t = TYPE[a.type];
  const head = `${back}<div class="act-head reveal"><span class="act-ic lg ${t.cls}">${ICON[t.icon]}</span><div><small>${t.label}</small><h1>${esc(a.title)}</h1><div class="act-head-meta">${dueChip(a)}${a.due ? `<span class="fine">${ICON.cal} ${fmtDate(a.due, { weekday: "long", day: "numeric", month: "long" })}</span>` : ""}</div></div></div>`;

  if (a.type === "survey") return viewSurvey(page, head, d);
  if (a.type === "reflection") {
    const existing = d.reflections.find(r => r.session_id === a.session.id);
    page.innerHTML = `${head}
      <div class="card reveal"><p class="muted">${ICON.cal} Session on ${fmtDate(a.session.date, { weekday: "long", day: "numeric", month: "long" })} · Group ${a.session.group_id}${a.session.kg ? ` · your group recycled <b>${a.session.kg} kg</b>` : ""}</p>
      <form class="form" id="f-refl" style="margin-top:16px">
        <label>What did you do in this session?<textarea name="did" rows="3" required maxlength="1500" placeholder="e.g. We collected paper and plastics from the 2nd floor, sorted them into the right bins…">${esc(existing?.did || "")}</textarea></label>
        <label>What did you learn or find challenging?<textarea name="learned" rows="3" maxlength="1500" placeholder="e.g. How much plastic ends up in the wrong bin; working with people I didn't know…">${esc(existing?.learned || "")}</textarea></label>
        <label>Which CAS learning outcome fits best?<select name="outcome"><option value="">Choose one (optional)…</option>${OUTCOMES.map(o => `<option ${existing?.outcome === o ? "selected" : ""}>${esc(o)}</option>`).join("")}</select></label>
        <p class="fine">Tip: copy this into ManageBac afterwards as evidence for your CAS portfolio.</p>
        <button class="btn btn-primary">${existing ? "Update reflection" : "Save reflection"}</button>
      </form></div>`;
    $("#f-refl").addEventListener("submit", (e) => {
      e.preventDefault(); const f = Object.fromEntries(new FormData(e.target));
      busy(e.submitter, async () => { await api.saveReflection(a.session.id, { did: f.did.trim(), learned: f.learned.trim(), outcome: f.outcome || null }); toast("Reflection saved ✍️"); location.hash = "#/activities"; });
    });
    return;
  }
  page.innerHTML = `${head}
    <div class="card reveal">
      ${a.body ? `<div class="prose">${nl2br(a.body)}</div>` : ""}
      ${a.type === "acknowledge" ? (a.done ? `<div class="notice ok">${ICON.check} You accepted this.</div>` : `
        <label class="check big"><input type="checkbox" id="agree"><span>I have read this and I agree.</span></label>
        <button class="btn btn-primary" id="do" disabled>Accept</button>`) : ""}
      ${a.type === "link" ? `<div class="btn-row">${a.url ? `<a class="btn btn-primary" href="${esc(a.url)}" target="_blank" rel="noopener">${ICON.ext} Open link</a>` : ""}
        ${a.done ? `<span class="pill pill-present">${ICON.check} Done</span>` : `<button class="btn btn-ghost" id="do">Mark as done</button>`}</div>` : ""}
    </div>`;
  $("#agree")?.addEventListener("change", (e) => { $("#do").disabled = !e.target.checked; });
  $("#do")?.addEventListener("click", (e) => busy(e.currentTarget, async () => { await api.markTaskDone(a.task.id); toast("Done! ✔"); location.hash = "#/activities"; }));
}

async function viewSurvey(page, head, d) {
  const open = d.settings.survey_open;
  const [people, mine] = await Promise.all([api.listDirectory(), api.getMyRatings()]);
  const ratings = { ...mine };
  const sub = d.submission; const days = new Set(sub?.days || []);
  page.innerHTML = `${head}
    <div class="privacy reveal">${ICON.shield}<div><b>Private and anonymous to students.</b> Other participants never see your answers or who rated them. Only the GRC admin team can view responses, and only to build fair groups.</div></div>
    ${!open ? `<div class="notice">${ICON.lock} The survey is closed. Your saved answers are shown below.</div>` : ""}
    ${sub ? `<div class="notice ok">${ICON.check} Sent on ${fmtDate(sub.submitted_at.slice(0, 10), { day: "numeric", month: "long" })}.${open ? " You can still change your answers." : ""}</div>` : ""}
    <p class="lead-txt">How much would you like to be in a group with each person? Skip anyone you don't know, which counts as neutral.</p>
    <div class="legend">${RATING.slice(1).map((r, i) => `<span class="rt rt-${i + 1}"><i>${i + 1}</i>${r}</span>`).join("")}</div>
    <div class="survey-tools"><input type="search" id="q" placeholder="Search by name…" aria-label="Search people"><span class="progress-txt" id="prog"></span></div>
    ${people.length ? `<ul class="people">${people.map(m => `
      <li class="person" data-name="${esc(m.full_name.toLowerCase())}">
        <div class="pav">${initials(m.full_name)}</div>
        <div class="pinfo"><b>${esc(m.full_name)}</b><span>${esc(m.class || "")}</span></div>
        <div class="scale" role="radiogroup" aria-label="Rating for ${esc(m.full_name)}">
          ${[1, 2, 3, 4, 5].map(v => `<button type="button" role="radio" class="sc sc-${v} ${ratings[m.id] === v ? "on" : ""}" data-id="${m.id}" data-v="${v}" aria-checked="${ratings[m.id] === v}" title="${RATING[v]}" ${open ? "" : "disabled"}>${v}</button>`).join("")}
        </div></li>`).join("")}</ul>` : `<div class="empty">${ICON.users}<p>No other participants yet. Check back soon!</p></div>`}
    <div class="card extra">
      <h2 class="card-title">A couple more things <span class="opt">optional</span></h2>
      <p class="label">Which days usually work best for you?</p>
      <div class="days">${DAYS.map(x => `<label class="daychip"><input type="checkbox" value="${x}" ${days.has(x) ? "checked" : ""} ${open ? "" : "disabled"}><span>${x}</span></label>`).join("")}</div>
      <label class="label" for="note">Anything the admin team should know? (private)</label>
      <textarea id="note" rows="3" maxlength="500" placeholder="e.g. I'm only free in the mornings" ${open ? "" : "disabled"}>${esc(sub?.note || "")}</textarea>
    </div>
    ${open ? `<div class="savebar"><span id="prog2"></span><button class="btn btn-primary" id="save">${sub ? "Update my answers" : "Send my answers"}</button></div>` : ""}`;
  const upd = () => { const n = Object.keys(ratings).filter(k => people.some(p => p.id === k)).length; const t = `${n} of ${people.length} rated`; $("#prog").textContent = t; if ($("#prog2")) $("#prog2").textContent = t; };
  upd();
  $$(".sc", page).forEach(b => b.addEventListener("click", () => {
    const id = b.dataset.id, v = +b.dataset.v;
    if (ratings[id] === v) delete ratings[id]; else ratings[id] = v;
    $$(`.sc[data-id="${id}"]`, page).forEach(x => { const on = ratings[id] === +x.dataset.v; x.classList.toggle("on", on); x.setAttribute("aria-checked", on); });
    upd();
  }));
  $("#q")?.addEventListener("input", (e) => { const q = e.target.value.trim().toLowerCase(); $$(".person", page).forEach(li => { li.hidden = q && !li.dataset.name.includes(q); }); });
  $("#save")?.addEventListener("click", (e) => busy(e.currentTarget, async () => {
    await api.saveSurvey(ratings, $$(".days input:checked", page).map(i => i.value), $("#note").value.trim());
    toast("Thanks! Your answers were saved privately."); location.hash = "#/activities";
  }));
}

// ================================================================ CALENDAR
let calMonth = null;
export async function viewCalendar(page) {
  const d = await load();
  const today = todayISO();
  if (!calMonth) { const n = d.sessions.find(s => s.date >= today); calMonth = (n?.date || today).slice(0, 7); }
  const [y, m] = calMonth.split("-").map(Number);
  const firstDay = new Date(y, m - 1, 1), offset = (firstDay.getDay() + 6) % 7, daysIn = new Date(y, m, 0).getDate();
  const byDate = {}; d.sessions.forEach(s => (byDate[s.date] ||= []).push(s));
  const attOf = (id) => d.attendance.find(a => a.session_id === id);
  const absOf = (id) => d.absences.find(a => a.session_id === id);
  const cells = [];
  for (let k = 0; k < offset; k++) cells.push(`<div class="cday out"></div>`);
  for (let day = 1; day <= daysIn; day++) {
    const iso = `${calMonth}-${String(day).padStart(2, "0")}`;
    const ss = byDate[iso] || [];
    const cls = ss.length ? (ss[0].status === "cancelled" ? "cancel" : attOf(ss[0].id)?.status || (iso < today ? "pastsess" : "sess")) : "";
    cells.push(`<div class="cday ${iso === today ? "today" : ""} ${cls ? "has " + cls : ""}" ${ss.length ? `title="Group ${ss[0].group_id} · ${esc(ss[0].start_time || "")}"` : ""}>
      <span>${day}</span>${ss.length ? `<i>${esc(ss[0].start_time || "●")}</i>` : ""}</div>`);
  }
  const upcoming = d.sessions.filter(s => s.date >= today);
  const past = d.sessions.filter(s => s.date < today).reverse();

  page.innerHTML = `
    ${pageHead("Recycling Initiative", "Calendar", d.published ? `Group ${state.profile.group_id} · one session in each rotation` : "Session dates appear once groups are published.",
      d.sessions.length ? `<button class="btn btn-primary sm" id="ics-all">${ICON.calPlus} Add all to my calendar</button>` : "")}
    <div class="cal-layout">
      <article class="card cal reveal">
        <header class="cal-h"><button class="iconbtn" id="prev" aria-label="Previous month">${ICON.chevL}</button>
          <h2>${firstDay.toLocaleDateString("en-GB", { month: "long", year: "numeric" })}</h2>
          <button class="iconbtn" id="next" aria-label="Next month">${ICON.chev}</button></header>
        <div class="cgrid">${["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(x => `<div class="cdow">${x}</div>`).join("")}${cells.join("")}</div>
        <div class="cal-legend"><span><i class="k sess"></i>Upcoming</span><span><i class="k present"></i>Attended</span><span><i class="k excused"></i>Excused</span><span><i class="k absent"></i>Absent</span></div>
      </article>
      <div>
        <h2 class="sec-title">Upcoming</h2>
        ${upcoming.length ? `<ul class="slist">${upcoming.map(s => sessionLine(s, { att: attOf(s.id), absence: absOf(s.id) })).join("")}</ul>` : `<div class="empty-mini">${ICON.cal}<p>No upcoming sessions.</p></div>`}
        ${past.length ? `<h2 class="sec-title">Past</h2><ul class="slist">${past.slice(0, 6).map(s => sessionLine(s, { att: attOf(s.id), absence: absOf(s.id), actions: false })).join("")}</ul>` : ""}
      </div>
    </div>`;
  const shift = (n) => { const dt = new Date(y, m - 1 + n, 1); calMonth = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`; viewCalendar(page); };
  $("#prev").addEventListener("click", () => shift(-1)); $("#next").addEventListener("click", () => shift(1));
  $("#ics-all")?.addEventListener("click", () => { download("GRC-recycling-sessions.ics", sessionsToICS(upcoming.length ? upcoming : d.sessions), "text/calendar"); toast("Calendar file downloaded"); });
  bindSessionActions(page, d.sessions, () => viewCalendar(page));
}

// ================================================================ ATTENDANCE
export async function viewAttendance(page) {
  const d = await load();
  const s = d.stats;
  const today = todayISO();
  const past = d.sessions.filter(x => x.date <= today).reverse();
  const attOf = (id) => d.attendance.find(a => a.session_id === id);
  const refl = new Set(d.reflections.map(r => r.session_id));
  page.innerHTML = `
    ${pageHead("Recycling Initiative", "Attendance tracker", "Your sessions, hours and streak, ready for your CAS evidence.", `<a class="btn btn-primary sm" href="#/certificate">${ICON.printer} CAS summary</a>`)}
    <div class="att-top">
      <article class="card att-ring reveal">${ring(s.rate, "attendance rate", 150)}
        <p class="fine center">Excused sessions don't count against you.</p></article>
      <div class="att-tiles">
        ${[["present", "Present", s.present, "checkCircle"], ["late", "Late", s.late, "clock"], ["excused", "Excused", s.excused, "shield"], ["absent", "Absent", s.absent, "x"],
           ["hours", "CAS hours", hoursText(s.hours), "clock"], ["streak", "Current streak", s.streak, "flame"]]
          .map(([c, l, v, ic]) => `<div class="tile tile-${c} reveal"><span>${ICON[ic]}</span><b>${v}</b><small>${l}</small></div>`).join("")}
      </div>
    </div>
    <h2 class="sec-title">Session history</h2>
    ${past.length ? `<div class="table-wrap reveal"><table class="table">
      <thead><tr><th>Date</th><th>Time</th><th>Status</th><th>Hours</th><th>Reflection</th><th>Photos</th></tr></thead>
      <tbody>${past.map(x => { const a = attOf(x.id); const ok = a && PRESENT.has(a.status); return `<tr>
        <td><b>${fmtDate(x.date, { weekday: "short", day: "numeric", month: "short" })}</b></td>
        <td>${esc(x.start_time || "")}${x.end_time ? "–" + esc(x.end_time) : ""}</td>
        <td>${x.status === "cancelled" ? `<span class="pill pill-absent">Cancelled</span>` : a ? `<span class="pill pill-${a.status}">${cap(a.status)}</span>` : `<span class="pill pill-pending">Not marked</span>`}</td>
        <td>${ok ? hoursText(duration(x)) : "—"}</td>
        <td>${ok ? (refl.has(x.id) ? `<a class="pill pill-present" href="#/activity/r${x.id}">${ICON.check} Written</a>` : `<a class="pill pill-excused" href="#/activity/r${x.id}">${ICON.pen} Write</a>`) : "—"}</td>
        <td>${x.photos_url ? `<a class="small-link" href="${esc(x.photos_url)}" target="_blank" rel="noopener">${ICON.camera} View</a>` : "—"}</td></tr>`; }).join("")}</tbody></table></div>`
      : `<div class="empty">${ICON.calCheck}<p>Your attendance will appear here after your first session.</p></div>`}
    <h2 class="sec-title">Absence requests</h2>
    ${d.absences.length ? `<ul class="slist">${d.absences.map(a => { const x = d.sessions.find(z => z.id === a.session_id); return `<li class="sline">
      <div class="sbody"><b>${x ? fmtDate(x.date, { weekday: "long", day: "numeric", month: "short" }) : "Session"}</b><span>${esc(a.reason)}</span></div>
      <span class="pill pill-${a.status === "approved" ? "present" : a.status === "declined" ? "absent" : "excused"}">${cap(a.status)}</span>
      ${a.status === "pending" ? `<button class="btn btn-ghost xs" data-cancel="${a.id}">Cancel</button>` : ""}</li>`; }).join("")}</ul>`
      : `<p class="muted">No requests. Use “Can't make it” on a session at least 24 hours before.</p>`}`;
  $$("[data-cancel]", page).forEach(b => b.addEventListener("click", () => busy(b, async () => { await api.cancelAbsence(+b.dataset.cancel); toast("Request cancelled"); viewAttendance(page); })));
}

// ================================================================ GROUP
export async function viewGroup(page) {
  const p = state.profile;
  const d = await load();
  if (!d.published) {
    page.innerHTML = `${pageHead("Recycling Initiative", "My group")}
      <div class="empty big reveal">${treeImg("green", "empty-tree")}<h2>Groups are growing…</h2>
      <p>The admin team is building the groups from everyone's survey answers. Your team and session dates will appear here as soon as they're published.</p>
      <a class="btn btn-primary" href="#/activities">Check my activities</a></div>`;
    return;
  }
  const dir = await api.listDirectory();
  const mates = dir.filter(m => m.group_id === p.group_id);
  const L = d.myLeague || { kg: 0, bags: 0, sessions: 0, attendance_rate: null };
  const sorted = [...d.league].sort((a, b) => +b.kg - +a.kg);
  const rank = sorted.findIndex(l => l.group_id === p.group_id) + 1;
  const upcoming = d.sessions.filter(s => s.date >= todayISO());
  page.innerHTML = `
    <section class="gbanner reveal"><div><p class="eyebrow">Your team</p><h1>Group ${p.group_id}</h1><p>${plural(mates.length + 1, "member")} · ${rank ? `#${rank} in the league` : "league starts soon"}</p></div>
      <div class="gstats"><div><b>${(+L.kg).toFixed(1).replace(/\.0$/, "")}</b><small>kg recycled</small></div><div><b>${L.bags}</b><small>bags</small></div><div><b>${L.sessions}</b><small>sessions</small></div><div><b>${L.attendance_rate ?? "—"}${L.attendance_rate != null ? "%" : ""}</b><small>attendance</small></div></div></section>
    <div class="grid-2">
      <article class="card reveal"><header class="card-h"><h2>${ICON.users} Members</h2></header>
        <ul class="team">
          <li><div class="pav me">${initials(p.full_name)}</div><div><b>${esc(p.full_name)}</b><span>You · ${esc(p.class || "")}</span></div></li>
          ${mates.map(m => `<li><div class="pav">${initials(m.full_name)}</div><div><b>${esc(m.full_name)}</b><span>${esc(m.class || "")}</span></div></li>`).join("")}
        </ul></article>
      <article class="card reveal"><header class="card-h"><h2>${ICON.trophy} League table</h2><span class="fine">friendly competition</span></header>
        <ol class="ltable">${sorted.map((l, k) => `<li class="${l.group_id === p.group_id ? "me" : ""}"><span class="lpos">${k + 1}</span><b>Group ${l.group_id}</b>
          <span>${(+l.kg).toFixed(1).replace(/\.0$/, "")} kg</span><span>${l.bags} bags</span><span>${l.attendance_rate ?? "—"}${l.attendance_rate != null ? "%" : ""}</span></li>`).join("")}</ol></article>
    </div>
    <h2 class="sec-title">Upcoming group sessions</h2>
    ${upcoming.length ? `<ul class="slist">${upcoming.map(s => sessionLine(s, { att: null, absence: d.absences.find(a => a.session_id === s.id) })).join("")}</ul>` : `<p class="muted">No upcoming sessions yet.</p>`}`;
  bindSessionActions(page, d.sessions, () => viewGroup(page));
}

// ================================================================ NEWS
export async function viewNews(page) {
  const news = await api.listAnnouncements();
  const seen = seenAt(); markSeen();
  page.innerHTML = `${pageHead("Community", "Announcements", "Updates from the GRC admin team.")}
    ${news.length ? `<div class="news">${news.map(n => `<article class="news-item reveal ${n.pinned ? "pinned" : ""}">
      <header>${n.pinned ? `<span class="pill pill-up">📌 Pinned</span>` : ""}${n.created_at > seen ? `<span class="pill pill-present">New</span>` : ""}<h3>${esc(n.title)}</h3><time>${fmtDate(n.created_at.slice(0, 10), { day: "numeric", month: "short" })}</time></header>
      <p>${nl2br(n.body)}</p>${n.author ? `<footer>${esc(n.author)}</footer>` : ""}</article>`).join("")}</div>`
      : `<div class="empty">${ICON.megaphone}<p>No announcements yet.</p></div>`}`;
  const dot = document.querySelector('[data-badge="news"]'); if (dot) dot.hidden = true;
}

// ================================================================ GUIDE
export function viewGuide(page) {
  page.innerHTML = `
    ${pageHead("Community", "Participant guide", "Everything you need to know about the recycling initiative.")}
    <div class="guide">
      <article class="card reveal"><header class="card-h"><h2>${ICON.recycle} How a session works</h2></header>
        <ol class="numbered">
          <li><b>Reminder</b> in the WhatsApp Community and on your Calendar before your group's session.</li>
          <li><b>Meet the admin team</b> at the pickup point, usually at your class.</li>
          <li><b>Collect &amp; sort</b> recyclables around school with your group.</li>
          <li><b>Photos &amp; attendance</b> are taken by the team and shared with your group.</li>
          <li><b>Reflect</b> in Activities and log it as CAS Action &amp; Service.</li>
        </ol></article>
      <article class="card reveal"><header class="card-h"><h2>${ICON.handshake} Your responsibilities</h2></header>
        <ul class="ticks">
          <li>${ICON.check}Arrive on time for your scheduled sessions</li>
          <li>${ICON.check}Give at least 24 hours notice if you can't come</li>
          <li>${ICON.check}Respect the team and the admin chain: Operations → Management → Executive Director</li>
          <li>${ICON.check}No phones during tasks; don't share GRC files or photos outside the initiative without permission</li>
          <li>${ICON.check}Report any issue privately to the admin team</li>
        </ul></article>
    </div>
    <h2 class="sec-title">Sorting guide · Madrid bins</h2>
    <div class="bins">
      ${[["yellow", "Yellow", "Packaging", "Plastic bottles, cans, tetra briks, plastic bags and wrappers, yoghurt pots"], ["blue", "Blue", "Paper & cardboard", "Clean paper, notebooks, flattened boxes. Not greasy or wet paper"],
         ["green", "Green", "Glass", "Bottles and jars without lids. Not ceramics, mirrors or bulbs"], ["brown", "Brown", "Organic", "Food scraps, fruit peel, coffee grounds, used napkins"],
         ["grey", "Grey", "General waste", "Anything else: dirty items, chewing gum, sweepings"], ["special", "Punto Limpio", "Special waste", "Batteries, electronics, cables and ink cartridges"]]
        .map(([c, n, w, d2]) => `<article class="bin bin-${c} reveal"><span class="bin-lid"></span><h3>${n}</h3><p class="bin-what">${w}</p><p>${d2}</p></article>`).join("")}
    </div>
    <div class="card contact reveal"><div><h2 class="card-title">${ICON.chat} Questions?</h2><p class="muted">Ask in the WhatsApp Community, reply to the GRC email, or write to us any time.</p></div>
      <a class="btn btn-primary" href="mailto:${esc(CONFIG.CONTACT_EMAIL)}">${ICON.mail} ${esc(CONFIG.CONTACT_EMAIL)}</a></div>`;
}

// ================================================================ PROFILE & SETTINGS
function idCard(p, school, extra = "") {
  return `<article class="idcard">
    <div class="idcard-top">${treeImg("green", "idcard-tree")}<div><span class="wm-name sm">GREENROOTS</span><span class="wm-sub sm">· RECYCLING ·</span></div><span class="idcard-year">${esc(CONFIG.YEAR)}</span></div>
    <div class="idcard-name">${esc(p.full_name)}</div>
    <dl class="idcard-meta">
      <div><dt>GRC ID</dt><dd class="mono">${esc(p.grc_id || "—")}</dd></div>
      <div><dt>Group</dt><dd>${state.settings?.groups_published && p.group_id ? `Group ${p.group_id}` : p.role === "admin" ? "Admin team" : "Being assigned"}</dd></div>
      <div><dt>Class</dt><dd>${esc(p.class || "—")}</dd></div>
      <div><dt>School</dt><dd>${esc(school?.name || "—")}</dd></div>
    </dl>${extra}</article>`;
}

export async function viewProfile(page) {
  const p = state.profile;
  const school = state.schools.find(s => s.id === p.school_id);
  const isAdmin = p.role === "admin";
  const d = isAdmin ? null : await load();
  const fresh = isAdmin ? [] : freshBadges(d.badges);
  page.innerHTML = `
    ${pageHead("Account", "Profile", esc(p.email))}
    <div class="profile-grid">
      <div class="reveal">${idCard(p, school)}
        ${isAdmin ? "" : `<a class="btn btn-primary wide" style="margin-top:14px" href="#/certificate">${ICON.printer} Download CAS summary</a>`}</div>
      <form class="card form reveal" id="f-prof">
        <header class="card-h"><h2>${ICON.user} Your details</h2></header>
        <label>Full name<input name="full_name" value="${esc(p.full_name)}" required></label>
        <label>Class<select name="class">${CONFIG.CLASSES.map(c => `<option ${c === p.class ? "selected" : ""}>${esc(c)}</option>`).join("")}</select></label>
        <div class="row-2">
          <label>Country code<select name="phone_cc"><option value="">—</option>${CODES.map(c => `<option ${c === p.phone_cc ? "selected" : ""}>${c}</option>`).join("")}${p.phone_cc && !CODES.includes(p.phone_cc) ? `<option selected>${esc(p.phone_cc)}</option>` : ""}</select></label>
          <label>WhatsApp number<input name="phone" inputmode="tel" value="${esc(p.phone || "")}" placeholder="600 00 00 00"></label>
        </div>
        <p class="fine">${ICON.lock} Your number is only used for the WhatsApp Community. Only admins can see it.</p>
        <button class="btn btn-primary">Save changes</button>
      </form>
    </div>
    ${isAdmin ? "" : `<h2 class="sec-title">Badges · ${d.badges.size}/${BADGES.length}</h2>
      <div class="badge-grid">${BADGES.map(b => `<div class="bcard ${d.badges.has(b.id) ? "on" : ""} reveal"><span class="medal ${d.badges.has(b.id) ? "on" : ""} ${fresh.includes(b.id) ? "fresh" : ""}">${d.badges.has(b.id) ? ICON[b.icon] : ICON.lock}</span><b>${esc(b.name)}</b><small>${esc(b.desc)}</small></div>`).join("")}</div>`}`;
  if (!isAdmin) celebrate(fresh, d.badges);
  $("#f-prof").addEventListener("submit", (e) => {
    e.preventDefault();
    busy(e.submitter, async () => { state.profile = await api.updateMyProfile(Object.fromEntries(new FormData(e.target))); toast("Profile saved"); viewProfile(page); });
  });
}
const CODES = ["+34", "+971", "+44", "+1", "+33", "+49", "+39", "+351", "+52", "+54", "+57", "+58", "+966", "+974", "+7", "+86", "+91"];

export function viewSettings(page) {
  page.innerHTML = `
    ${pageHead("Account", "Settings")}
    <div class="grid-2">
      <form class="card form reveal" id="f-pw"><header class="card-h"><h2>${ICON.lock} Change password</h2></header>
        <label>New password<input name="pw" type="password" minlength="8" required autocomplete="new-password"></label>
        <label>Confirm<input name="pw2" type="password" minlength="8" required autocomplete="new-password"></label>
        <button class="btn btn-primary">Update password</button></form>
      <article class="card reveal"><header class="card-h"><h2>${ICON.shield} Privacy</h2></header>
        <ul class="ticks"><li>${ICON.check}Your survey answers are only visible to the GRC admin team</li>
        <li>${ICON.check}Other students only see your name, class and group</li>
        <li>${ICON.check}Your email and WhatsApp number are never shown to students</li></ul>
        <p class="fine">Want your data removed? Email <a href="mailto:${esc(CONFIG.CONTACT_EMAIL)}">${esc(CONFIG.CONTACT_EMAIL)}</a>.</p>
        <div class="divider"></div>
        <button class="btn btn-line-dark" id="so">${ICON.out} Sign out</button></article>
    </div>`;
  $("#f-pw").addEventListener("submit", (e) => {
    e.preventDefault(); const f = new FormData(e.target);
    if (f.get("pw") !== f.get("pw2")) { toast("The passwords don't match", "err"); return; }
    busy(e.submitter, async () => { await api.updatePassword(f.get("pw")); e.target.reset(); toast("Password updated"); });
  });
  $("#so").addEventListener("click", () => api.signOut());
}

// ================================================================ CERTIFICATE (printable)
export async function viewCertificate() {
  const p = state.profile;
  const d = await load();
  const school = state.schools.find(s => s.id === p.school_id);
  const s = d.stats;
  const rows = d.sessions.filter(x => d.attendance.some(a => a.session_id === x.id));
  document.querySelector("#app").innerHTML = `
    <div class="cert-bar no-print"><a class="btn btn-ghost sm" href="#/attendance">${ICON.chevL} Back</a><button class="btn btn-primary sm" id="print">${ICON.printer} Print / Save as PDF</button></div>
    <div class="cert">
      <div class="cert-inner">
        <div class="cert-head">${badgeLogo("lg")}<div><p class="cert-org">GREENROOTS COLLECTIVE</p><p class="cert-slogan">“planting seeds, growing change”</p></div></div>
        <p class="cert-kicker">CAS participation summary</p>
        <h1>${esc(p.full_name)}</h1>
        <p class="cert-sub">${esc(p.class || "")} · ${esc(school?.name || "")} · GRC ID ${esc(p.grc_id || "")}</p>
        <p class="cert-text">took part in the <b>${esc(CONFIG.PROGRAMME)}</b> (${esc(CONFIG.YEAR)}), a student-led Action &amp; Service programme run by Greenroots Collective.</p>
        <div class="cert-stats">
          <div><b>${s.attended}</b><span>sessions attended</span></div>
          <div><b>${hoursText(s.hours)}</b><span>hours</span></div>
          <div><b>${s.rate ?? "—"}${s.rate != null ? "%" : ""}</b><span>attendance</span></div>
          <div><b>${d.reflections.length}</b><span>reflections</span></div>
        </div>
        ${rows.length ? `<table class="cert-table"><thead><tr><th>Date</th><th>Time</th><th>Status</th><th>Group recycled</th></tr></thead><tbody>
          ${rows.map(x => { const a = d.attendance.find(z => z.session_id === x.id); return `<tr><td>${fmtDate(x.date, { day: "numeric", month: "short", year: "numeric" })}</td><td>${esc(x.start_time || "")}–${esc(x.end_time || "")}</td><td>${esc(a.status)}</td><td>${x.kg ? x.kg + " kg" : "—"}</td></tr>`; }).join("")}
        </tbody></table>` : `<p class="cert-text">No sessions recorded yet.</p>`}
        <div class="cert-sign"><div><span></span><p>Mazen Choumari<br><small>Founder &amp; Executive Director</small></p></div><div><span></span><p>Date<br><small>${fmtDate(todayISO(), { day: "numeric", month: "long", year: "numeric" })}</small></p></div></div>
        <p class="cert-foot">Generated from the GRC Recycling Portal · greenroots.tech</p>
      </div>
    </div>`;
  $("#print").addEventListener("click", () => window.print());
}
