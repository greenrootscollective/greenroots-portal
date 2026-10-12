# GRC Recycling Initiative Portal: Plan (v2)

**Owner:** Mazen Choumari (Founder & Executive Director) · **Tech:** Hugo Torres
**Status:** v2 built and tested. Runs in demo mode now; goes live once Supabase is connected (see `SETUP.md`).
**Scope:** this portal covers the **recycling initiative only**. It is built so more GRC programmes (Garden Club, workshops…) can be added later, and these already appear as "Soon" in the menu.

---

## 1. What's in v2

| Area | What it does |
|---|---|
| **Public mini-site** | A scrolling GRC landing page with a sticky menu, a hero that has the slogan *"planting seeds, growing change"* under the name, live impact counters (kg recycled, bags, sessions, participants), the dossier numbers (600+ interactions, 50+ members, 240+ sessions, 100% reach), About / mission / vision / values, a 5-step "how it works", the Madrid bin guide, the management team, SDG 13 & 4, an FAQ, a call to action and a dark footer with shortcuts |
| **Formal sign-in** | Separate split-screen Sign in / Create account / Reset pages |
| **Schools** | Students **choose their school** at sign-up and must use that school's email domain. Admins add or hide schools |
| **Side menu** | A portal side bar with icons and badges (Activities to do, new announcements, absence requests). On phones it becomes a slide-out drawer |
| **Activities** | Replaces the old "Survey" tab. Everything a student must do has a date: the group survey, read & accept the agreement, external links/forms, and an automatic **CAS reflection** after every attended session |
| **Calendar** | A month view plus a list. **Add to phone calendar** (.ics) for one or all sessions. **"Can't make it"** sends an absence request, with a warning if it's under 24 h |
| **Attendance tracker** | For students: rate ring, present / late / excused / absent, CAS hours, streak, history with reflections and photo links. For admins: a full member × session grid (click to change), absence requests to approve or decline, CSV export |
| **Impact** | Admins log kg, bags and a photos link per session. This feeds the landing page counters, the group league and badges |
| **Group league** | Friendly ranking of groups by kg recycled and attendance |
| **Badges** | 10 badges (Seedling, Voice heard, Committed, First dig, Rooted, On a roll, Evergreen, Reflective, Deep roots, Team player) |
| **CAS summary** | A printable certificate-style PDF with sessions, hours, attendance and reflections |
| **Admin** | Overview with "needs your attention" alerts, members (+ Mainframe CSV export), activities with completion and "who's missing" nudges, survey results, group builder, sessions & impact, attendance, announcements (with pinning), schools, settings |

## 2. Numbers (Oct 2026)

There are 15 students on the email (Hugo and Alberto are in Cc). The recommended split is **4 groups: 4 · 4 · 4 · 3**, with one group per week, so each person goes about once a month. With one more person, it becomes 4 × 4.

## 3. Student journey

1. Landing page → **Join now** → choose school, name, school email, class, password, and consent.
2. Enter the **join code** to unlock the portal.
3. **Home** shows a greeting banner, an attendance ring, *Up next*, *To do*, stats, badges, the group league and announcements.
4. **Activities**: complete the survey and the agreement before their due dates.
5. Once groups are published, **Calendar / My group** show the team and session dates. Students can add these to their phone.
6. After each session, attendance is marked and a **reflection** activity appears. Badges unlock and hours add up.
7. At any time they can download the **CAS summary**.

## 4. Admin routine

- **Before the start:** set the codes (Settings), check the schools, and share the link and join code.
- **Week 1:** watch *Activities*, use *Who's missing* to copy a WhatsApp reminder, then run the **Group builder**, save and publish.
- **Each week:** go to *Sessions & impact* → Manage → mark attendance (or "Mark all present"), log kg and bags, paste the photos link and set it to *done*.
- **Ongoing:** approve or decline absence requests, post announcements, and export CSVs for the Mainframe.

## 5. The grouping formula

Each student rates the others 1–5 (unrated = 3). For two people in the same group, the pair score is `(A→B − 3) + (B→A − 3)`. The formula also adds a bonus for the least-happy person, and group sizes always differ by at most 1. It tries many random starting points and improves each one by swapping and moving people. The admin sees: % who got someone they wanted, the average rating of group mates, the least-happy score, and the number of clashes.

## 6. Privacy & safety

- Enforced by the database (Row Level Security), not just hidden in the page.
- Survey ratings are visible only to the student who wrote them and to admins.
- Students see others' name, class and group only. Never emails or phones.
- Students can't change their own role, status, group, school or GRC ID.
- Reflections can only be written for sessions the student attended. Absence requests only for their own group's sessions.
- Sign-up requires a school from the list and its email domain.
- Sessions a student attended stay visible to them even if groups are rebuilt later.
- Most participants are minors, so we collect the minimum here. Guardian info stays in the Mainframe. Check with Alberto / the school before going live.

## 7. Tech

Plain HTML/CSS/JS (ES modules, no build step) and **Supabase** (free) for logins and the database. It hosts on GitHub Pages, Vercel or Netlify.

```
index.html
assets/css/styles.css        all styling (brand tokens at the top)
assets/js/config.js          Supabase keys, programme name, classes
assets/js/app.js             router + portal shell (side menu)
assets/js/core.js            shared helpers, icons, badges, calendar export
assets/js/public.js          landing mini-site + sign in / sign up
assets/js/student.js         student portal
assets/js/admin.js           admin control room
assets/js/grouping.js        the group-building formula
assets/js/backend-supabase.js / backend-demo.js
supabase/schema.sql          tables + security rules (run once)
```

## 8. Next ideas

- [ ] Connect Supabase and go live; custom domain `recycling.greenroots.tech`
- [ ] Partner school names (Admin → Schools)
- [ ] Photo uploads straight into the portal (Supabase Storage) instead of album links
- [ ] Automatic email / WhatsApp reminder the day before a session
- [ ] "Full profile" step for Mainframe fields (DOB, tutor, guardian)
- [ ] Spanish language toggle
- [ ] Add the Garden Club as the second programme
