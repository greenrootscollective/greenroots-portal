// =====================================================================
//  GRC Recycling Initiative — router + portal shell (side menu)
//  Public:   #/  #/signin  #/signup  #/forgot  #/reset
//  Student:  #/home #/activities #/activity/<key> #/calendar #/attendance
//            #/group #/news #/guide #/profile #/settings #/certificate
//  Admin:    #/admin #/admin/members #/admin/activities #/admin/survey
//            #/admin/groups #/admin/sessions #/admin/attendance
//            #/admin/news #/admin/schools #/admin/settings
// =====================================================================
import { api, state, $, $$, esc, initials, ICON, treeImg, toast } from "./core.js";
import * as pub from "./public.js";
import * as stu from "./student.js";
import * as adm from "./admin.js";

const app = $("#app");

async function refreshMe() {
  state.user = await api.getUser();
  state.profile = state.user ? await api.getMyProfile().catch(() => null) : null;
  state.settings = state.user ? await api.getSettings().catch(() => null) : null;
  state.schools = await api.listSchools().catch(() => []);
}
const after = async () => {
  await refreshMe();
  const h = homeFor(state.profile);
  if (location.hash !== h) location.hash = h; else route();
};

function homeFor(p) {
  if (!p) return "#/";
  if (p.status !== "member") return "#/join";
  return p.role === "admin" ? "#/admin" : "#/home";
}

const STUDENT_NAV = [
  ["Recycling", [
    ["#/home", "Home", "home", stu.viewHome],
    ["#/activities", "Activities", "tasks", stu.viewActivities, "tasks"],
    ["#/calendar", "Calendar", "cal", stu.viewCalendar],
    ["#/attendance", "Attendance", "calCheck", stu.viewAttendance],
    ["#/group", "My group", "users", stu.viewGroup],
  ]],
  ["Community", [
    ["#/news", "Announcements", "megaphone", stu.viewNews, "news"],
    ["#/guide", "Guide", "book", stu.viewGuide],
  ]],
];
const STUDENT_EXTRA = [["#/profile", "Profile", "user", stu.viewProfile], ["#/settings", "Settings", "gear", stu.viewSettings]];

const ADMIN_NAV = [
  ["Control room", [
    ["#/admin", "Overview", "grid", adm.overview],
    ["#/admin/members", "Members", "users", adm.members],
    ["#/admin/activities", "Activities", "tasks", adm.activities],
    ["#/admin/groups", "Group builder", "spark", adm.groups],
  ]],
  ["Sessions", [
    ["#/admin/sessions", "Sessions & impact", "cal", adm.sessions],
    ["#/admin/attendance", "Attendance", "calCheck", adm.attendance, "absences"],
  ]],
  ["Community", [
    ["#/admin/news", "Announcements", "megaphone", adm.news],
    ["#/admin/schools", "Schools", "school", adm.schools],
  ]],
];
const ADMIN_EXTRA = [["#/admin/survey", "Survey results", "chart", adm.survey], ["#/profile", "Profile", "user", stu.viewProfile], ["#/admin/settings", "Settings", "gear", adm.settings], ["#/guide", "Guide", "book", stu.viewGuide]];

async function route() {
  const hash = location.hash || "#/";
  const p = state.profile;
  document.body.classList.remove("no-scroll");

  if (hash === "#/reset") return pub.viewReset(after);
  if (!state.user) {
    window.scrollTo(0, 0);
    if (hash === "#/signin") return pub.viewSignIn();
    if (hash === "#/signup") return pub.viewSignUp();
    if (hash === "#/forgot") return pub.viewForgot();
    if (hash !== "#/" && hash.startsWith("#/")) { location.replace("#/signin"); return; }
    return pub.viewLanding();
  }
  if (!p) { toast("Your profile could not be loaded.", "err"); await api.signOut(); return; }
  if (p.status === "inactive") return pub.viewInactive();
  if (p.status !== "member") return pub.viewJoin(after);
  if (hash === "#/certificate") return stu.viewCertificate();

  const isAdmin = p.role === "admin";
  const nav = isAdmin ? ADMIN_NAV : STUDENT_NAV;
  const all = [...nav.flatMap(([, items]) => items), ...(isAdmin ? ADMIN_EXTRA : STUDENT_EXTRA)];
  let entry = all.find(x => x[0] === hash);
  let view = entry?.[3];
  if (!entry && !isAdmin && hash.startsWith("#/activity/")) { entry = all.find(x => x[0] === "#/activities"); view = (page) => stu.viewActivity(page, decodeURIComponent(hash.slice(11))); }
  if (!entry) { location.replace(homeFor(p)); return; }
  window.scrollTo(0, 0);
  shell(nav, entry, view, isAdmin);
}

function shell(nav, entry, view, isAdmin) {
  const p = state.profile;
  const [hash, title, icon] = entry;
  const school = state.schools.find(s => s.id === p.school_id);
  app.innerHTML = `
    ${pub.demoBanner()}
    <div class="portal">
      <aside class="side" id="side" aria-label="Main menu">
        <div class="side-top">
          <a class="side-brand" href="${homeFor(p)}">${treeImg("sand", "side-tree")}<span><b>GREENROOTS</b><small>planting seeds, growing change</small></span></a>
          <button class="iconbtn side-x" id="side-x" aria-label="Close menu">${ICON.x}</button>
        </div>
        <div class="prog">
          <span class="prog-ic">${ICON.recycle}</span>
          <div><b>Recycling Initiative</b><small>${isAdmin ? "Admin · " : ""}${esc(school?.name?.replace(" International School", "") || "GRC")}</small></div>
        </div>
        <nav class="side-nav">
          ${nav.map(([label, items]) => `<p class="side-label">${label}</p>${items.map(([h, l, ic, , badge]) => `
            <a href="${h}" class="${h === hash ? "active" : ""}">${ICON[ic]}<span>${l}</span>${badge ? `<i class="nbadge" data-badge="${badge}" hidden></i>` : ""}</a>`).join("")}`).join("")}
          ${isAdmin ? "" : `<p class="side-label">More programmes</p>
            <span class="side-soon">${ICON.sprout}<span>Garden Club</span><em>Soon</em></span>
            <span class="side-soon">${ICON.book}<span>Workshops</span><em>Soon</em></span>`}
        </nav>
        <div class="side-bottom">
          <a href="#/profile" class="side-me ${hash === "#/profile" ? "active" : ""}"><span class="avatar">${initials(p.full_name)}</span><span><b>${esc(p.full_name)}</b><small>${esc(p.grc_id || "")}</small></span></a>
          <div class="side-actions">
            <a href="${isAdmin ? "#/admin/settings" : "#/settings"}" class="iconbtn ${/settings/.test(hash) ? "on" : ""}" title="Settings" aria-label="Settings">${ICON.gear}</a>
            <button class="iconbtn" id="signout" title="Sign out" aria-label="Sign out">${ICON.out}</button>
          </div>
        </div>
      </aside>
      <div class="side-scrim" id="scrim"></div>
      <div class="pmain-wrap">
        <header class="ptop">
          <button class="iconbtn ptop-burger" id="burger" aria-label="Open menu">${ICON.menu}</button>
          <div class="ptop-title">${ICON[icon]}<span>${esc(title)}</span></div>
          <div class="ptop-right">
            ${isAdmin ? `<a class="chip-link" href="#/admin/survey">${ICON.chart}<span>Survey results</span></a>` : ""}
            <a class="iconbtn bell" href="${isAdmin ? "#/admin/attendance" : "#/news"}" aria-label="Notifications">${ICON.bell}<i class="dot" id="bell-dot" hidden></i></a>
            <a class="avatar sm" href="#/profile" title="Profile">${initials(p.full_name)}</a>
          </div>
        </header>
        <main class="pmain" id="page"><div class="loading"><span class="spinner dark"></span></div></main>
        <footer class="pfoot"><span>© 2024–2026 Greenroots Collective · “planting seeds, growing change”</span><a href="#/guide">Guide</a><a href="mailto:greenrootscollectiveorg@gmail.com">Contact</a></footer>
      </div>
    </div>`;

  pub.bindDemo(refreshMe);
  const side = $("#side"), scrim = $("#scrim");
  const open = () => { side.classList.add("open"); scrim.classList.add("show"); document.body.classList.add("no-scroll"); };
  const close = () => { side.classList.remove("open"); scrim.classList.remove("show"); document.body.classList.remove("no-scroll"); };
  $("#burger").addEventListener("click", open);
  $("#side-x").addEventListener("click", close); scrim.addEventListener("click", close);
  $$(".side-nav a, .side-me").forEach(a => a.addEventListener("click", close));
  $("#signout").addEventListener("click", () => api.signOut().then(() => { location.hash = "#/"; }));

  (isAdmin ? adm.navBadges() : stu.navBadges()).then(b => {
    for (const [k, n] of Object.entries(b || {})) {
      const el = $(`[data-badge="${k}"]`); if (el && n) { el.textContent = n; el.hidden = false; }
    }
    if (Object.values(b || {}).some(Boolean)) $("#bell-dot").hidden = false;
  }).catch(() => {});

  Promise.resolve(view($("#page"))).then(() => pub.revealOnScroll($("#page"))).catch(e => {
    $("#page").innerHTML = `<div class="card error">${ICON.alert} Something went wrong: ${esc(e.message)}</div>`; console.error(e);
  });
}

api.onAuthChange(async (event) => {
  if (event === "PASSWORD_RECOVERY") { location.hash = "#/reset"; return; }
  if (event === "SIGNED_IN" || event === "SIGNED_OUT") {
    await refreshMe();
    const target = event === "SIGNED_IN" && ["#/", "#/signin", "#/signup", ""].includes(location.hash) ? homeFor(state.profile) : null;
    if (target && target !== location.hash) { location.hash = target; return; } // hashchange will route
    route();
  }
});
window.addEventListener("hashchange", () => { if (/^#\/|^$/.test(location.hash)) route(); });
await refreshMe();
route();
