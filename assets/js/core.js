// Shared state, backend, helpers and icons for every page.
import { CONFIG } from "./config.js";

const live = Boolean(CONFIG.SUPABASE_URL && CONFIG.SUPABASE_ANON_KEY);
export const api = live
  ? (await import("./backend-supabase.js")).createSupabaseBackend(CONFIG)
  : (await import("./backend-demo.js")).createDemoBackend();

export { CONFIG };
export const state = { user: null, profile: null, settings: null, schools: [] };

export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];

// ---------------------------------------------------------------- text
export const esc = (v) => String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const first = (name) => esc((name || "").split(" ")[0]);
export const initials = (name) => esc((name || "?").split(/\s+/).slice(0, 2).map(w => w[0]).join("").toUpperCase());
export const plural = (n, w, pl) => `${n} ${n === 1 ? w : pl || w + "s"}`;
export const cap = (s) => (s = String(s ?? "")) && s[0].toUpperCase() + s.slice(1);
export const nl2br = (s) => esc(s).replace(/\n/g, "<br>");

// ---------------------------------------------------------------- dates
export const todayISO = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); };
export function addDaysISO(iso, n) { const d = new Date(iso + "T12:00"); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }
export const parseDate = (d) => new Date(d + (d.length === 10 ? "T00:00" : ""));
export const fmtDate = (d, opts = { weekday: "short", day: "numeric", month: "short" }) => d ? parseDate(d).toLocaleDateString("en-GB", opts) : "";
export const daysUntil = (d) => Math.round((parseDate(d) - parseDate(todayISO())) / 864e5);
export function relDay(d) {
  const n = daysUntil(d);
  if (n === 0) return "today"; if (n === 1) return "tomorrow"; if (n === -1) return "yesterday";
  return n > 0 ? `in ${n} days` : `${-n} days ago`;
}
export const minutes = (t) => { const m = /^(\d{1,2}):(\d{2})/.exec(t || ""); return m ? +m[1] * 60 + +m[2] : null; };
export const duration = (s) => { const a = minutes(s.start_time), b = minutes(s.end_time); return a != null && b != null && b > a ? (b - a) / 60 : 0; };
export const hoursText = (h) => (Math.round(h * 10) / 10).toString();
export function sessionStart(s) { const d = parseDate(s.date); const m = minutes(s.start_time) ?? 9 * 60; d.setMinutes(m); return d; }

// ---------------------------------------------------------------- UI helpers
export function toast(msg, kind = "ok") {
  $$(".toast").forEach(t => t.remove());
  const t = document.createElement("div");
  t.className = `toast toast-${kind}`; t.setAttribute("role", "status");
  t.innerHTML = `${kind === "err" ? ICON.alert : ICON.check}<span>${esc(msg)}</span>`;
  document.body.appendChild(t);
  requestAnimationFrame(() => t.classList.add("show"));
  setTimeout(() => { t.classList.remove("show"); setTimeout(() => t.remove(), 300); }, 3400);
}
export async function busy(btn, fn) {
  const label = btn?.innerHTML; if (btn) { btn.disabled = true; btn.innerHTML = `<span class="spinner"></span>`; }
  try { return await fn(); }
  catch (e) { toast(e.message || String(e), "err"); }
  finally { if (btn && btn.isConnected) { btn.disabled = false; btn.innerHTML = label; } }
}
export function download(name, text, type = "text/csv") {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([type === "text/csv" ? "﻿" + text : text], { type: type + ";charset=utf-8" }));
  a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
export const csv = (rows) => rows.map(r => r.map(v => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\r\n");

/** Simple modal. Returns {el, close}. */
export function modal(title, bodyHtml, { wide = false } = {}) {
  const wrap = document.createElement("div");
  wrap.className = "modal-wrap";
  wrap.innerHTML = `<div class="modal ${wide ? "wide" : ""}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
    <header><h2>${esc(title)}</h2><button class="iconbtn" data-close aria-label="Close">${ICON.x}</button></header>
    <div class="modal-body">${bodyHtml}</div></div>`;
  document.body.appendChild(wrap);
  requestAnimationFrame(() => wrap.classList.add("show"));
  const close = () => { wrap.classList.remove("show"); setTimeout(() => wrap.remove(), 200); document.removeEventListener("keydown", onKey); };
  const onKey = (e) => { if (e.key === "Escape") close(); };
  document.addEventListener("keydown", onKey);
  wrap.addEventListener("click", (e) => { if (e.target === wrap || e.target.closest("[data-close]")) close(); });
  setTimeout(() => wrap.querySelector("input,textarea,select,button:not([data-close])")?.focus(), 50);
  return { el: wrap, close };
}

// ---------------------------------------------------------------- calendar (.ics)
const icsDate = (d) => `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}T${String(d.getHours()).padStart(2, "0")}${String(d.getMinutes()).padStart(2, "0")}00`;
const icsEsc = (s) => String(s || "").replace(/([,;\\])/g, "\\$1").replace(/\n/g, "\\n");
export function sessionsToICS(sessions) {
  const ev = sessions.map(s => {
    const st = sessionStart(s), en = new Date(st.getTime() + (duration(s) || 0.84) * 3600e3);
    return ["BEGIN:VEVENT", `UID:grc-recycling-${s.id}@greenroots.tech`, `DTSTAMP:${icsDate(new Date())}`,
      `DTSTART:${icsDate(st)}`, `DTEND:${icsDate(en)}`, `SUMMARY:${icsEsc(`GRC Recycling · Group ${s.group_id}`)}`,
      `LOCATION:${icsEsc(s.location)}`, `DESCRIPTION:${icsEsc(`Greenroots Collective recycling session${s.supervisor ? ` led by ${s.supervisor}` : ""}.`)}`,
      "BEGIN:VALARM", "TRIGGER:-PT30M", "ACTION:DISPLAY", "DESCRIPTION:GRC recycling session", "END:VALARM", "END:VEVENT"].join("\r\n");
  });
  return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Greenroots Collective//Recycling//EN", "CALSCALE:GREGORIAN", ...ev, "END:VCALENDAR"].join("\r\n");
}

// ---------------------------------------------------------------- stats & badges
export const PRESENT = new Set(["present", "late"]);

export function attendanceStats(sessions, attendance) {
  const byId = new Map(sessions.map(s => [s.id, s]));
  const marked = attendance.filter(a => byId.has(a.session_id));
  const count = (st) => marked.filter(a => a.status === st).length;
  const attended = marked.filter(a => PRESENT.has(a.status));
  const counted = marked.filter(a => a.status !== "excused");
  const hours = attended.reduce((t, a) => t + duration(byId.get(a.session_id)), 0);
  // streak: consecutive attended sessions, newest first (excused doesn't break it)
  const ordered = marked.map(a => ({ ...a, date: byId.get(a.session_id).date })).sort((a, b) => b.date.localeCompare(a.date));
  let streak = 0;
  for (const a of ordered) { if (a.status === "excused") continue; if (PRESENT.has(a.status)) streak++; else break; }
  return {
    present: count("present"), late: count("late"), excused: count("excused"), absent: count("absent"),
    attended: attended.length, marked: marked.length, hours, streak,
    rate: counted.length ? Math.round((100 * attended.filter(a => a.status !== "excused").length) / counted.length) : null,
  };
}

export const BADGES = [
  { id: "seedling", name: "Seedling", desc: "Joined the initiative", icon: "sprout" },
  { id: "voice", name: "Voice heard", desc: "Completed the group survey", icon: "users" },
  { id: "promise", name: "Committed", desc: "Accepted the participant agreement", icon: "handshake" },
  { id: "first", name: "First dig", desc: "Attended your first session", icon: "recycle" },
  { id: "rooted", name: "Rooted", desc: "Attended 3 sessions", icon: "tree" },
  { id: "streak", name: "On a roll", desc: "3 sessions in a row", icon: "flame" },
  { id: "evergreen", name: "Evergreen", desc: "100% attendance (3+ sessions)", icon: "award" },
  { id: "reflect", name: "Reflective", desc: "Wrote a CAS reflection", icon: "pen" },
  { id: "deep", name: "Deep roots", desc: "Wrote 3 reflections", icon: "book" },
  { id: "team", name: "Team player", desc: "Your group recycled 20 kg+", icon: "trophy" },
];
export function earnedBadges({ survey, agreed, stats, reflections, groupKg }) {
  const e = new Set(["seedling"]);
  if (survey) e.add("voice");
  if (agreed) e.add("promise");
  if (stats.attended >= 1) e.add("first");
  if (stats.attended >= 3) e.add("rooted");
  if (stats.streak >= 3) e.add("streak");
  if (stats.rate === 100 && stats.marked >= 3) e.add("evergreen");
  if (reflections >= 1) e.add("reflect");
  if (reflections >= 3) e.add("deep");
  if (groupKg >= 20) e.add("team");
  return e;
}

export function ring(pct, label, size = 120) {
  const r = 52, c = 2 * Math.PI * r, v = pct == null ? 0 : Math.max(0, Math.min(100, pct));
  return `<div class="ring" style="width:${size}px;height:${size}px">
    <svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="${r}" class="ring-bg"/>
    <circle cx="60" cy="60" r="${r}" class="ring-fg" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - v / 100)}"/></svg>
    <div class="ring-txt"><b>${pct == null ? "—" : pct + "%"}</b><span>${esc(label)}</span></div></div>`;
}

// ---------------------------------------------------------------- brand bits
export const treeImg = (variant = "green", cls = "") => `<img class="${cls}" src="assets/img/tree-${variant}.png" alt="" aria-hidden="true">`;
export const badgeLogo = (cls = "") => `<span class="logo-badge ${cls}">${treeImg("green")}</span>`;

// ---------------------------------------------------------------- icons (Lucide, ISC licence)
const i = (p) => `<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
export const ICON = {
  home: i(`<path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>`),
  tasks: i(`<path d="m3 17 2 2 4-4"/><path d="m3 7 2 2 4-4"/><path d="M13 6h8"/><path d="M13 12h8"/><path d="M13 18h8"/>`),
  cal: i(`<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>`),
  calPlus: i(`<path d="M8 2v4M16 2v4M21 13V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h8M3 10h18M16 19h6M19 16v6"/>`),
  calCheck: i(`<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/><path d="m9 16 2 2 4-4"/>`),
  users: i(`<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>`),
  user: i(`<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>`),
  megaphone: i(`<path d="m3 11 18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/>`),
  book: i(`<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>`),
  gear: i(`<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>`),
  out: i(`<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5M21 12H9"/>`),
  leaf: i(`<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/>`),
  sprout: i(`<path d="M7 20h10"/><path d="M10 20c5.5-2.5.8-6.4 3-10"/><path d="M9.5 9.4c1.1.8 1.8 2.2 2.3 3.7-2 .4-3.5.4-4.8-.3-1.2-.6-2.3-1.9-3-4.2 2.8-.5 4.4 0 5.5.8z"/><path d="M14.1 6a7 7 0 0 0-1.1 4c1.9-.1 3.3-.6 4.3-1.4 1-1 1.6-2.3 1.7-4.6-2.7.1-4 1-4.9 2z"/>`),
  tree: i(`<path d="M10 10v.2A3 3 0 0 1 8.9 16H5a3 3 0 0 1-1-5.8V10a3 3 0 0 1 6 0Z"/><path d="M7 16v6"/><path d="M13 19v3"/><path d="M12 19h8.3a1 1 0 0 0 .7-1.7L18 14h.3a1 1 0 0 0 .7-1.7L16 9h.2a1 1 0 0 0 .8-1.7L13 3l-1.4 1.5"/>`),
  recycle: i(`<path d="M7 19H4.815a1.83 1.83 0 0 1-1.57-.881 1.785 1.785 0 0 1-.004-1.784L7.196 9.5"/><path d="M11 19h8.203a1.83 1.83 0 0 0 1.556-.89 1.784 1.784 0 0 0 0-1.775l-1.226-2.12"/><path d="m14 16-3 3 3 3"/><path d="M8.293 13.596 7.196 9.5 3.1 10.598"/><path d="m9.344 5.811 1.093-1.892A1.83 1.83 0 0 1 11.985 3a1.784 1.784 0 0 1 1.546.888l3.943 6.843"/><path d="m13.378 9.633 4.096 1.098 1.097-4.096"/>`),
  shield: i(`<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>`),
  spark: i(`<path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/>`),
  key: i(`<circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6M15.5 7.5l3 3L22 7l-3-3"/>`),
  pin: i(`<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>`),
  clock: i(`<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>`),
  check: i(`<path d="M20 6 9 17l-5-5"/>`),
  checkCircle: i(`<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>`),
  x: i(`<path d="M18 6 6 18M6 6l12 12"/>`),
  menu: i(`<path d="M4 6h16M4 12h16M4 18h16"/>`),
  arrow: i(`<path d="M5 12h14M12 5l7 7-7 7"/>`),
  chev: i(`<path d="m9 18 6-6-6-6"/>`),
  chevL: i(`<path d="m15 18-6-6 6-6"/>`),
  down: i(`<path d="m6 9 6 6 6-6"/>`),
  download: i(`<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5M12 15V3"/>`),
  bell: i(`<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>`),
  award: i(`<circle cx="12" cy="8" r="6"/><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/>`),
  trophy: i(`<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>`),
  school: i(`<path d="M14 22v-4a2 2 0 1 0-4 0v4"/><path d="m18 10 4 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-8l4-2"/><path d="M18 5v17M6 5v17"/><path d="m4 6 8-4 8 4"/><circle cx="12" cy="9" r="2"/>`),
  scale: i(`<path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="M7 21h10M12 3v18M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2"/>`),
  bag: i(`<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18M16 10a4 4 0 0 1-8 0"/>`),
  camera: i(`<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/>`),
  pen: i(`<path d="M12 20h9"/><path d="M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 18.635a2 2 0 0 1-.855.506l-2.872.838a.5.5 0 0 1-.62-.62l.838-2.872a2 2 0 0 1 .506-.854z"/>`),
  alert: i(`<circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>`),
  plus: i(`<path d="M5 12h14M12 5v14"/>`),
  trash: i(`<path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>`),
  lock: i(`<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>`),
  globe: i(`<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20M2 12h20"/>`),
  mail: i(`<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>`),
  chat: i(`<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>`),
  chart: i(`<path d="M3 3v16a2 2 0 0 0 2 2h16"/><path d="M18 17V9M13 17V5M8 17v-3"/>`),
  printer: i(`<path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 9V3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v6"/><rect x="6" y="14" width="12" height="8" rx="1"/>`),
  ext: i(`<path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>`),
  flame: i(`<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>`),
  handshake: i(`<path d="m11 17 2 2a1 1 0 1 0 3-3"/><path d="m14 14 2.5 2.5a1 1 0 1 0 3-3l-3.88-3.88a3 3 0 0 0-4.24 0l-.88.88a1 1 0 1 1-3-3l2.81-2.81a5.79 5.79 0 0 1 7.06-.87l.47.28a2 2 0 0 0 1.42.25L21 4"/><path d="m21 3 1 11h-2M3 3 2 14l6.5 6.5a1 1 0 1 0 3-3M3 4h8"/>`),
  link: i(`<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>`),
  file: i(`<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4M10 9H8M16 13H8M16 17H8"/>`),
  target: i(`<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>`),
  heart: i(`<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>`),
  grid: i(`<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/>`),
  layers: i(`<path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65M22 12.65l-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/>`),
  instagram: i(`<rect x="2" y="2" width="20" height="20" rx="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37zM17.5 6.5h.01"/>`),
  github: i(`<path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"/><path d="M9 18c-4.51 2-5-2-7-2"/>`),
};
