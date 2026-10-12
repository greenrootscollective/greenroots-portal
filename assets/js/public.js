// Public pages: landing mini-site, sign in / create account, join code.
import { api, state, CONFIG, $, $$, esc, first, toast, busy, ICON, treeImg, badgeLogo } from "./core.js";

const app = () => $("#app");

export function demoBanner() {
  return api.mode === "demo"
    ? `<div class="demo-banner">${ICON.spark}<span>Demo mode<span class="hide-sm">: fictional data, saved only in this browser</span></span><button class="linklike" id="demo-reset">Reset demo</button></div>` : "";
}
export function bindDemo(after) {
  $("#demo-reset")?.addEventListener("click", async () => { api.resetDemo(); await after?.(); location.hash = "#/"; toast("Demo data reset"); });
}

// ================================================================ LANDING
const NAV = [["#about", "About"], ["#initiative", "The initiative"], ["#impact", "Impact"], ["#team", "Team"], ["#faq", "FAQ"]];

const FAQ = [
  ["How often will I go?", "About once a month. Each group has one session in the weekly rotation, during CAS time, and you'll see every date on your calendar in the portal."],
  ["Does it count for CAS?", "Yes. It counts mainly as Action and Service. The portal tracks your attendance and hours and lets you write a reflection after every session, so your evidence is ready."],
  ["Can I be with my friends?", "That's the idea. You fill in a private survey about who you'd like to work with, and our group builder makes the fairest groups it can for everyone."],
  ["Who sees my survey answers?", "Only the GRC admin team, and only to build groups. Other students never see your answers or who rated them."],
  ["What if I can't make a session?", "Tap “Can't make it” on the session in your portal at least 24 hours before. The admin team will mark you as excused."],
  ["What do I need to bring?", "Nothing special: a water bottle and comfortable shoes. The admin team brings bags and gloves and handles access to every area."],
];

const TEAM = [
  ["Mazen Choumari", "Founder & Executive Director", "Leads the initiative, makes key decisions and coordinates the recycling programme."],
  ["Hugo Torres", "Technological Infrastructure Manager", "Runs sign-ups, attendance and the digital tools. Co-coordinates recycling."],
  ["Cristina Cárdenas", "Garden Program Manager", "Manages garden activities and keeps every space organised and clean."],
  ["Sammy Roy", "Activities Program Manager", "Plans activities and turns creative ideas into learning experiences."],
];

export async function viewLanding() {
  const stats = await api.publicStats().catch(() => ({ members: 0, sessions: 0, kg: 0, bags: 0, schools: 1 }));
  app().innerHTML = `
  ${demoBanner()}
  <header class="lnav" id="lnav">
    <div class="lnav-inner">
      <a class="lbrand" href="#/">${treeImg("sand", "lbrand-tree")}<span><b>GREENROOTS</b><small>COLLECTIVE</small></span></a>
      <nav class="lnav-links" aria-label="Sections">${NAV.map(([h, l]) => `<a href="${h}" data-scroll>${l}</a>`).join("")}</nav>
      <div class="lnav-cta"><a class="btn btn-line sm" href="#/signin">Sign in</a><a class="btn btn-sand sm" href="#/signup">Join now</a></div>
      <button class="iconbtn lnav-burger" id="burger" aria-label="Open menu">${ICON.menu}</button>
    </div>
  </header>
  <div class="ldrawer" id="ldrawer" aria-hidden="true">
    <div class="ldrawer-panel">
      <button class="iconbtn ldrawer-x" id="drawer-x" aria-label="Close menu">${ICON.x}</button>
      ${NAV.map(([h, l]) => `<a href="${h}" data-scroll>${l}</a>`).join("")}
      <a class="btn btn-sand wide" href="#/signup">Join now</a><a class="btn btn-line wide" href="#/signin">Sign in</a>
    </div>
  </div>

  <section class="lhero" id="lhero">
    ${leaves([58, 66, 74, 81, 88, 94, 3, 97])}
    <div class="lhero-inner">
      <div class="lhero-copy">
        <div class="lhero-mark">${badgeLogo("xl")}</div>
        <h1 class="lhero-name" aria-label="GREENROOTS">${[..."GREENROOTS"].map((c, k) => `<span aria-hidden="true" style="--t:${500 + k * 40}ms">${c}</span>`).join("")}</h1>
        ${[`<p class="lhero-coll">· COLLECTIVE ·</p>`,
           `<p class="lhero-slogan">“planting seeds, growing change”</p>`,
           `<div class="lhero-rule"></div>`,
           `<p class="eyebrow">${esc(CONFIG.PROGRAMME)} · ${esc(CONFIG.YEAR)}</p>`,
           `<h2 class="lhero-title">Small groups. <em>Real impact.</em></h2>`,
           `<p class="lhero-lede">The student-led recycling initiative at Agora Madrid. Join a small group of friends, recycle around school once a month, and earn meaningful CAS Action &amp; Service hours, all tracked in one place.</p>`,
           `<div class="lhero-ctas"><a class="btn btn-sand lg" href="#/signup">Join the initiative ${ICON.arrow}</a><a class="btn btn-line lg" href="#initiative" data-scroll>How it works</a></div>`,
          ].map((h, k) => h.replace(/^<(\w+) class="/, `<$1 style="--t:${900 + k * 70}ms" class="hf `)).join("\n        ")}
      </div>
      <div class="lhero-float" aria-hidden="true">
        <div class="fcard f1"><span class="fcard-ic">${ICON.scale}</span><div><b data-count="${stats.kg}" data-dec="1" data-delay="1200">0</b><small>kg recycled this year</small></div></div>
        <div class="fcard f2"><span class="fcard-ic">${ICON.users}</span><div><b data-count="${stats.members}" data-delay="1300">0</b><small>students taking part</small></div></div>
        <div class="fcard f3"><span class="fcard-ic">${ICON.calCheck}</span><div><b data-count="${stats.sessions}" data-delay="1400">0</b><small>sessions completed</small></div></div>
      </div>
    </div>
    <a class="scroll-cue" href="#about" data-scroll aria-label="Scroll down"><span></span></a>
  </section>

  <div class="marquee" aria-hidden="true"><div class="marquee-track">
    ${Array(2).fill(["SDG 13 · Climate Action", "SDG 4 · Quality Education", "CAS Action & Service", "Respect for life", "Student-led since 2024", "Agora Madrid International School", "Small groups, real impact"].map(t => `<span>${ICON.leaf}${t}</span>`).join("")).join("")}
  </div></div>

  <section class="lsec sand" id="about">
    <div class="lwrap about">
      <div class="about-lead reveal">
        <p class="eyebrow dark">Who we are</p>
        <h2 class="lh2">A student-led organisation teaching <em>respect for the living world.</em></h2>
        <p class="lp">Greenroots Collective was founded in October 2024 by Mazen Choumari at Agora Madrid International School. We started with a neglected corner of campus and turned it into a working garden. Now we run clubs, programmes and the recycling initiative, all built and led by students.</p>
        <p class="lp muted">Not greenwashing, not trends. Just real, hands-on action you can see around school every week.</p>
      </div>
      <div class="about-cards">
        <article class="acard reveal"><span class="acard-ic">${ICON.target}</span><h3>Our mission</h3><p>Create green spaces where students learn about sustainability through engaging, hands-on activities that inspire awareness and action.</p></article>
        <article class="acard reveal"><span class="acard-ic">${ICON.globe}</span><h3>Our vision</h3><p>A school where green spaces are respected and inspire curiosity, creativity and long-term care for our community and our planet.</p></article>
        <article class="acard reveal"><span class="acard-ic">${ICON.heart}</span><h3>Our values</h3><p>Innovation, education and collaboration, with student empowerment and environmental stewardship at the core.</p></article>
      </div>
    </div>
  </section>

  <section class="lsec dark" id="initiative">
    <div class="lwrap">
      <div class="sec-head reveal"><p class="eyebrow">The recycling initiative</p><h2 class="lh2 light">Structured, never stressful.</h2>
        <p class="lp light">Small groups of 4–6 run one session each in a weekly rotation. The admin team handles planning, reminders, access and tracking. You just show up and make a difference.</p></div>
      <ol class="steps">
        ${[["Create your account", "Sign up with your school email and choose your school. It takes 30 seconds.", "user"],
           ["Unlock with your code", "Enter the code from the GRC email or WhatsApp Community to open your portal.", "key"],
           ["Take the group survey", "Tell us privately who you'd like to work with. We build the fairest groups.", "users"],
           ["Recycle once a month", "Meet your group and the admin team, collect and sort around campus.", "recycle"],
           ["Reflect & log CAS", "Write a short reflection. Your hours, attendance and badges are tracked for you.", "pen"]]
          .map(([t, d, ic], n) => `<li class="step reveal" style="--d:${n * 80}ms"><span class="step-n">0${n + 1}</span><span class="step-ic">${ICON[ic]}</span><h3>${t}</h3><p>${d}</p></li>`).join("")}
      </ol>
      <div class="perks">
        ${[["clock", "About once a month", "A very manageable commitment that fits your timetable."], ["calPlus", "Calendar sync", "Add every session to your phone's calendar in one tap."],
           ["award", "Badges & certificate", "Earn badges and download a CAS participation summary."], ["camera", "Session photos", "We take great photos of every session for your evidence."]]
          .map(([ic, t, d]) => `<div class="perk reveal"><span>${ICON[ic]}</span><div><b>${t}</b><p>${d}</p></div></div>`).join("")}
      </div>
    </div>
  </section>

  <section class="lsec cream" id="impact">
    <div class="lwrap">
      <div class="sec-head center reveal"><p class="eyebrow dark">Impact</p><h2 class="lh2">From one student to a school-wide engine.</h2></div>
      <div class="counters">
        ${[[stats.kg, "kg recycled", "This year, logged session by session", "scale", 1], [stats.bags, "bags collected", "Sorted into the right bins", "bag", 0],
           [stats.sessions, "sessions done", "Run by groups of 4–6", "calCheck", 0], [stats.members, "participants", "Across ESO & Bachillerato", "users", 0]]
          .map(([v, l, s, ic, dec]) => `<div class="counter live reveal"><span class="counter-ic">${ICON[ic]}</span><b data-count="${v}" data-dec="${dec}">0</b><h3>${l}</h3><p>${s}</p></div>`).join("")}
      </div>
      <p class="counters-label reveal">${ICON.leaf} Greenroots Collective so far</p>
      <div class="counters small">
        ${[["600", "+", "interactions with students & staff"], ["50", "+", "active club members"], ["240", "+", "expected sessions"], ["100", "%", "school reach"]]
          .map(([v, suf, l]) => `<div class="counter reveal"><b data-count="${v}" data-suffix="${suf}">0</b><p>${l}</p></div>`).join("")}
      </div>
    </div>
  </section>

  <section class="lsec sand" id="bins">
    <div class="lwrap">
      <div class="sec-head reveal"><p class="eyebrow dark">Know your bins</p><h2 class="lh2">Madrid's colours, made simple.</h2></div>
      <div class="bins">
        ${[["yellow", "Yellow", "Packaging", "Plastic bottles, cans, cartons, wrappers"], ["blue", "Blue", "Paper & card", "Clean paper, notebooks, flattened boxes"],
           ["green", "Green", "Glass", "Bottles and jars, no lids"], ["brown", "Brown", "Organic", "Food scraps, peels, coffee grounds"],
           ["grey", "Grey", "General waste", "Everything else: dirty items, gum"], ["special", "Punto Limpio", "Special", "Batteries, electronics, cables"]]
          .map(([c, n, w, d], k) => `<article class="bin bin-${c} reveal" style="--d:${k * 60}ms"><span class="bin-lid"></span><h3>${n}</h3><p class="bin-what">${w}</p><p>${d}</p></article>`).join("")}
      </div>
    </div>
  </section>

  <section class="lsec cream" id="team">
    <div class="lwrap">
      <div class="sec-head reveal"><p class="eyebrow dark">Management team</p><h2 class="lh2">The people behind it.</h2>
        <p class="lp">Greenroots is run like a real organisation, with a management team for strategy and an operations team for every session.</p></div>
      <div class="team-grid">
        ${TEAM.map(([n, r, d], k) => `<article class="tcard reveal" style="--d:${k * 70}ms"><div class="tav">${n.split(" ").map(w => w[0]).join("")}</div><h3>${esc(n)}</h3><p class="trole">${esc(r)}</p><p>${esc(d)}</p></article>`).join("")}
      </div>
      <div class="sdgs">
        <article class="sdg sdg13 reveal"><b>13</b><div><h3>Climate Action</h3><p>More green spaces and real recycling habits build climate resilience and awareness at school.</p></div></article>
        <article class="sdg sdg4 reveal"><b>4</b><div><h3>Quality Education</h3><p>Hands-on, interactive learning about sustainability that goes far beyond the textbook.</p></div></article>
      </div>
    </div>
  </section>

  <section class="lsec sand" id="faq">
    <div class="lwrap faq-wrap">
      <div class="reveal"><p class="eyebrow dark">FAQ</p><h2 class="lh2">Good questions.</h2><p class="lp">Anything else? Write to <a href="mailto:${esc(CONFIG.CONTACT_EMAIL)}">${esc(CONFIG.CONTACT_EMAIL)}</a>.</p></div>
      <div class="faq">${FAQ.map(([q, a]) => `<details class="reveal"><summary>${esc(q)}<span>${ICON.plus}</span></summary><p>${esc(a)}</p></details>`).join("")}</div>
    </div>
  </section>

  <section class="lcta">
    ${leaves([4, 9, 15, 21, 79, 85, 91, 96])}
    <div class="lwrap lcta-inner reveal">
      ${badgeLogo("lg")}
      <h2>Ready to dig in?</h2>
      <p>Create your account, enter your code, and meet your group.</p>
      <div class="lhero-ctas center"><a class="btn btn-sand lg" href="#/signup">Create my account ${ICON.arrow}</a><a class="btn btn-line lg" href="#/signin">I already have one</a></div>
    </div>
  </section>

  ${footer()}`;

  bindDemo();
  bindLanding();
  const hero = $("#lhero");
  const play = () => hero.classList.add("play");
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) play();
  else Promise.race([document.fonts?.ready, new Promise(r => setTimeout(r, 700))]).then(() => requestAnimationFrame(play));
}

// Leaf drift: a few blurred leaf silhouettes falling behind the content, at the given left positions (%).
const LEAF = `<svg viewBox="0 0 24 24"><path fill="currentColor" d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/></svg>`;
function leaves(xs) {
  return `<div class="leaves" aria-hidden="true">${xs.map((x, k) => {
    const r = (n) => ((k * 37 + n * 53) % 100) / 100; // fixed pseudo-random, same on every visit
    return `<i style="--x:${x}%;--s:${16 + Math.round(r(1) * 22)}px;--o:${(0.04 + r(2) * 0.04).toFixed(3)};--b:${(1.2 + r(3) * 2).toFixed(1)}px;--dur:${18 + Math.round(r(4) * 14)}s;--delay:-${Math.round(r(5) * 30)}s">${LEAF}</i>`;
  }).join("")}</div>`;
}

export function footer() {
  return `<footer class="dfoot">
    <div class="lwrap dfoot-grid">
      <div class="dfoot-brand">
        <a class="lbrand" href="#/">${treeImg("sand", "lbrand-tree")}<span><b>GREENROOTS</b><small>COLLECTIVE</small></span></a>
        <p class="dfoot-slogan">“planting seeds, growing change”</p>
        <p>A student-led sustainability organisation founded in October 2024 at Agora Madrid International School.</p>
        <div class="dfoot-sdg"><span class="sdg-chip s13">SDG 13</span><span class="sdg-chip s4">SDG 4</span></div>
      </div>
      <div><h4>Explore</h4>${NAV.map(([h, l]) => `<a href="${h}" data-scroll>${l}</a>`).join("")}</div>
      <div><h4>Portal</h4><a href="#/signin">Sign in</a><a href="#/signup">Create account</a><a href="#/forgot">Reset password</a></div>
      <div><h4>Greenroots</h4>
        <a href="${esc(CONFIG.MAIN_SITE)}" target="_blank" rel="noopener">${ICON.globe} greenroots.tech</a>
        <a href="mailto:${esc(CONFIG.CONTACT_EMAIL)}">${ICON.mail} Email us</a>
        <span class="dfoot-note">${ICON.pin} Madrid, Spain</span>
      </div>
    </div>
    <div class="lwrap dfoot-bottom">
      <span>© 2024–2026 Greenroots Collective. All rights reserved.</span>
      <span>Personal data is processed under Spanish data protection law (LOPD) and visible only to the GRC admin team.</span>
    </div>
  </footer>`;
}

function bindLanding() {
  // smooth in-page scroll for #section links (the router uses #/…)
  $$("[data-scroll]").forEach(a => a.addEventListener("click", (e) => {
    const id = a.getAttribute("href").slice(1); const el = document.getElementById(id);
    if (!el) return; e.preventDefault(); closeDrawer();
    window.scrollTo({ top: el.getBoundingClientRect().top + scrollY - 64, behavior: "smooth" });
  }));
  const nav = $("#lnav");
  const onScroll = () => nav?.classList.toggle("solid", scrollY > 40);
  window.addEventListener("scroll", onScroll, { passive: true }); onScroll();
  const drawer = $("#ldrawer");
  const closeDrawer = () => { drawer.classList.remove("open"); drawer.setAttribute("aria-hidden", "true"); };
  $("#burger").addEventListener("click", () => { drawer.classList.add("open"); drawer.setAttribute("aria-hidden", "false"); });
  $("#drawer-x").addEventListener("click", closeDrawer);
  drawer.addEventListener("click", (e) => { if (e.target === drawer) closeDrawer(); });
  revealOnScroll();
}

export function revealOnScroll(root = document) {
  const els = $$(".reveal, [data-count]", root);
  const run = (el) => {
    el.classList.add("in");
    if (el.dataset.count != null && !el.dataset.done) {
      el.dataset.done = 1;
      if (el.dataset.delay) { const d = +el.dataset.delay; delete el.dataset.delay; el.dataset.done = ""; setTimeout(() => run(el), d); return; }
      const target = +el.dataset.count, dec = +(el.dataset.dec || 0), suf = el.dataset.suffix || "";
      const t0 = performance.now(), dur = 1300;
      const tick = (t) => {
        const p = Math.min(1, (t - t0) / dur), v = target * (1 - Math.pow(1 - p, 3));
        el.textContent = (dec ? v.toFixed(dec).replace(/\.0$/, "") : Math.round(v).toLocaleString("en-GB")) + suf;
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }
  };
  if (!("IntersectionObserver" in window) || matchMedia("(prefers-reduced-motion: reduce)").matches) { els.forEach(el => { el.classList.add("in"); if (el.dataset.count != null) el.textContent = (+el.dataset.count).toLocaleString("en-GB") + (el.dataset.suffix || ""); }); return; }
  const io = new IntersectionObserver((entries) => entries.forEach(en => { if (en.isIntersecting) { run(en.target); io.unobserve(en.target); } }), { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
  els.forEach(el => io.observe(el));
}

// ================================================================ AUTH PAGES
function authShell(inner, { title = "", sub = "" } = {}) {
  app().innerHTML = `
    ${demoBanner()}
    <div class="auth">
      <aside class="auth-side">
        <a class="auth-back" href="#/">${ICON.chevL} Back to home</a>
        <div class="auth-side-mid">
          ${badgeLogo("lg")}
          <h2 class="auth-name">GREENROOTS</h2>
          <p class="auth-coll">· COLLECTIVE ·</p>
          <p class="auth-slogan">“planting seeds, growing change”</p>
          <ul class="auth-points">
            <li>${ICON.users} Groups built from a private survey</li>
            <li>${ICON.calCheck} Sessions, attendance &amp; CAS hours in one place</li>
            <li>${ICON.shield} Your data is only visible to the GRC admin team</li>
          </ul>
        </div>
        <p class="auth-foot">${esc(CONFIG.PROGRAMME)} · ${esc(CONFIG.YEAR)}</p>
      </aside>
      <main class="auth-main">
        <div class="auth-box">
          <a class="auth-mobile-brand" href="#/">${badgeLogo("sm")}<span>GREENROOTS</span></a>
          ${title ? `<h1 class="auth-title">${title}</h1>` : ""}${sub ? `<p class="auth-sub">${sub}</p>` : ""}
          ${inner}
        </div>
      </main>
    </div>`;
  bindDemo();
}

export function viewSignIn() {
  authShell(`
    <form id="f-signin" class="form">
      <label>School email<input name="email" type="email" autocomplete="email" required placeholder="name.surname@student.agoraism.com"></label>
      <label><span class="lbl-row">Password <a class="small-link" href="#/forgot">Forgot?</a></span>
        <input name="password" type="password" autocomplete="current-password" required minlength="6"></label>
      <button class="btn btn-primary wide lg" type="submit">Sign in</button>
    </form>
    <p class="auth-switch">New here? <a href="#/signup">Create an account</a></p>
    ${api.mode === "demo" ? `<div class="demo-try"><span>Explore the demo as</span>
      <button class="chip-btn" data-demo="alex.demo@student.agoraism.com">${ICON.user} a student</button>
      <button class="chip-btn" data-demo="admin.demo@agoraism.com">${ICON.gear} an admin</button></div>` : ""}`,
    { title: "Welcome back", sub: "Sign in to your recycling portal." });
  $$("[data-demo]").forEach(b => b.addEventListener("click", () => busy(b, () => api.signIn(b.dataset.demo, "demo1234"))));
  $("#f-signin").addEventListener("submit", (e) => {
    e.preventDefault(); const f = new FormData(e.target);
    busy(e.submitter, () => api.signIn(f.get("email"), f.get("password")));
  });
}

export async function viewSignUp() {
  const schools = await api.listSchools().catch(() => []);
  authShell(`
    <form id="f-signup" class="form">
      <label>Your school
        <select name="school_id" required><option value="">Choose your school…</option>${schools.filter(s => s.active).map(s => `<option value="${s.id}">${esc(s.name)}${s.city ? ` · ${esc(s.city)}` : ""}</option>`).join("")}</select></label>
      <label>Full name<input name="full_name" autocomplete="name" required placeholder="As on your school records"></label>
      <label>School email<input name="email" type="email" autocomplete="email" required placeholder="Choose your school first"><small class="hint" id="dom-hint"></small></label>
      <label>Class<select name="klass" required><option value="">Choose your class…</option>${CONFIG.CLASSES.map(c => `<option>${esc(c)}</option>`).join("")}</select></label>
      <div class="row-2 eq">
        <label>Password<input name="password" type="password" autocomplete="new-password" required minlength="8" placeholder="8+ characters"></label>
        <label>Confirm<input name="password2" type="password" autocomplete="new-password" required minlength="8"></label>
      </div>
      <label class="check"><input type="checkbox" name="consent" required><span>I agree that Greenroots Collective stores my name, school email and class to run the initiative. Only the GRC admin team can see them.</span></label>
      <button class="btn btn-primary wide lg" type="submit">Create account</button>
    </form>
    <p class="auth-switch">Already have an account? <a href="#/signin">Sign in</a></p>`,
    { title: "Create your account", sub: "Step 1 of 2. Next you'll enter your initiative code." });

  const f = $("#f-signup");
  const hint = () => {
    const s = schools.find(x => x.id === +f.school_id.value);
    $("#dom-hint").textContent = s ? `Use your @${s.student_domain} address` : "";
    f.email.placeholder = s ? `name.surname@${s.student_domain}` : "Choose your school first";
  };
  f.school_id.addEventListener("change", hint);
  if (schools.length === 1) { f.school_id.value = schools[0].id; hint(); }

  f.addEventListener("submit", (e) => {
    e.preventDefault(); const d = Object.fromEntries(new FormData(f));
    const s = schools.find(x => x.id === +d.school_id);
    const email = d.email.trim().toLowerCase(); const dom = email.split("@")[1];
    if (s && dom !== s.student_domain && dom !== s.staff_domain) { toast(`Please use your ${s.name} email (@${s.student_domain})`, "err"); return; }
    if (d.password !== d.password2) { toast("The passwords don't match", "err"); return; }
    busy(e.submitter, async () => {
      const { needsConfirm } = await api.signUp({ full_name: d.full_name.trim(), email, password: d.password, klass: d.klass, school_id: +d.school_id });
      if (needsConfirm) {
        $(".auth-box").innerHTML = `<div class="confirm"><div class="big-ic">${ICON.mail}</div><h1 class="auth-title">Check your inbox</h1>
          <p class="auth-sub">We sent a confirmation link to <b>${esc(email)}</b>. Open it, then sign in to enter your code.</p>
          <a class="btn btn-primary wide" href="#/signin">Go to sign in</a></div>`;
      }
    });
  });
}

export function viewForgot() {
  authShell(`
    <form id="f-forgot" class="form"><label>School email<input name="email" type="email" required></label>
    <button class="btn btn-primary wide lg">Send reset link</button></form>
    <p class="auth-switch"><a href="#/signin">${ICON.chevL} Back to sign in</a></p>`,
    { title: "Reset your password", sub: "We'll email you a link to choose a new one." });
  $("#f-forgot").addEventListener("submit", (e) => {
    e.preventDefault();
    busy(e.submitter, async () => { await api.resetPassword(new FormData(e.target).get("email")); toast("If that email has an account, a reset link is on its way."); });
  });
}

export function viewReset(after) {
  authShell(`<form id="f-reset" class="form"><label>New password<input name="pw" type="password" minlength="8" required></label>
    <button class="btn btn-primary wide lg">Save password</button></form>`, { title: "Choose a new password" });
  $("#f-reset").addEventListener("submit", (e) => {
    e.preventDefault();
    busy(e.submitter, async () => { await api.updatePassword(new FormData(e.target).get("pw")); toast("Password updated"); await after(); });
  });
}

export function viewJoin(after) {
  const p = state.profile;
  authShell(`
    <form id="f-code" class="form">
      <input class="code-input" name="code" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="ENTER CODE" required aria-label="Initiative code">
      <button class="btn btn-primary wide lg">Unlock my portal ${ICON.arrow}</button>
    </form>
    <p class="fine center">The code is in the GRC email and the WhatsApp Community.</p>
    <div class="join-foot"><span>Signed in as ${esc(p.email)}</span><button class="linklike" id="join-out">Sign out</button></div>`,
    { title: `Welcome, ${first(p.full_name)}!`, sub: "Step 2 of 2. Enter your initiative code to unlock your portal." });
  $("#join-out").addEventListener("click", () => api.signOut());
  $("#f-code").addEventListener("submit", (e) => {
    e.preventDefault();
    busy(e.submitter, async () => {
      const role = await api.redeemCode(new FormData(e.target).get("code"));
      toast(role === "admin" ? "Admin access granted" : "You're in! Welcome to the initiative 🌱");
      await after();
    });
  });
}

export function viewInactive() {
  authShell(`<p class="auth-sub">If you think this is a mistake, contact the GRC team at <a href="mailto:${esc(CONFIG.CONTACT_EMAIL)}">${esc(CONFIG.CONTACT_EMAIL)}</a>.</p>
    <button class="btn btn-line-dark wide" id="in-out">Sign out</button>`, { title: "Your access is paused" });
  $("#in-out").addEventListener("click", () => api.signOut());
}
