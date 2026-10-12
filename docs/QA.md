# QA report: Director's Plan DONE WHEN boxes

**Date:** 12 Oct 2026 · **Build:** demo mode (no Supabase keys yet) · **Browser:** Chromium
**Widths tested:** 1440, 1366, 1024, 768 and 390 px, every public, student and admin page, plus "reduce motion".

Every page was loaded at every width and checked automatically for sideways scrolling and JavaScript errors. The joining and survey journeys were clicked through as a new student and then as an admin. The database rules were tested on a local Postgres copy of the schema (`supabase/tests/run.sh`, 80 checks).

**YES** = checked and true · **PARTLY** = true where it could be tested, the rest is noted · **NOT YET** = needs the live setup

## §3 Landing page

| Box | Result |
|---|---|
| Impact: live numbers match the admin overview exactly | **YES** (41.1 kg, 25 bags, 6 sessions and 16 participants on both) |
| Impact: before the first session the tiles read 0 cleanly | **PARTLY**: the code shows "0" and the label says "this year", but the demo always has data, so this wasn't seen on screen |
| Every scene enters with motion | **YES** |
| The slogan sits directly under the name (hero, sign-in panel, footer) | **YES** |
| Live counters are correct and count up once | **YES** |
| The menu bar never covers a heading after a menu-link jump | **YES** at 1440, 1366 and 1024 (all five links measured). The jumps from the phone menu were not measured |
| Works at 1440, 1366, 1024, 768 and 390 with no overlaps or clipped words | **YES** after fixes: at 768 the menu links wrapped into the logo and "Join now" was cut off; at 1440 and 1366 "GREENROOTS" ran into the stat cards' column |
| With "reduce motion" on, the page is complete and still | **YES** |

## §4 Joining

| Box | Result |
|---|---|
| A wrong-domain email is refused with a message naming the school and its domain | **YES**: "Please use your Agora Madrid International School email (@student.agoraism.com)". The database refuses it too |
| Mismatched passwords are caught before sending | **YES** |
| Signed-in users without a code always land on the code screen | **YES** (tried #/home, #/admin, #/calendar and #/) |
| The whole flow works on a 390 px phone with the keyboard open | **PARTLY**: the layout works at 390 × 844. An on-screen keyboard can't be simulated here, so check this on a real phone |

## §5 Portal frame

| Box | Result |
|---|---|
| The active page is always highlighted in the menu | **YES** |
| Badges show real counts and vanish at zero | **YES** |
| The menu scrolls on its own; the person card stays at the bottom | **YES** after a fix: in demo mode the banner pushed the card 33 px off the bottom of the screen |
| Settings is reachable from the gear on every page | **YES** |

## §6 Student portal

| Box | Result |
|---|---|
| A brand-new student sees the survey and agreement on Home and in Activities, with due dates | **YES** in the demo. On the live database the agreement had no due date; it now gets one (a week after setup, same as the survey) |
| After a session is marked, the reflection appears and the ring, hours and badges update | **YES**: reflections are created from attendance, as seen for the demo student's two attended sessions |
| Rebuilding groups never hides a student's past sessions | **YES** (database test) |
| Every page works at 390 px with the side menu in the drawer | **YES** after a fix: the calendar scrolled sideways at 390 |

## §7 Survey

| Box | Result |
|---|---|
| A student can rate, add days and a note, send, come back and change answers | **YES** |
| The admin sees new answers immediately in the matrix, the pairs and both CSV exports | **YES** after a fix: the two exports from §7.4 were missing from v2 and have been added |
| "Who's missing" lists exactly the students without an answer | **YES** |
| The builder respects every "rather not" where possible and reports clashes it couldn't avoid | **YES**: 15 people with 17 "rather not" ratings gave groups of 4 · 4 · 4 · 3 with 0 clashes. A case that couldn't be avoided reported its clashes. 60 people took under a second |
| Tested with two real student accounts: neither can see the other's answers | **PARTLY**: tested with two students and one admin on a local Postgres copy of the schema. Repeat on the real Supabase project |

## §8 Admin

| Box | Result |
|---|---|
| Every number on Overview matches the detail pages | **PARTLY**: kg, bags, sessions and members match. The other numbers weren't compared one by one |
| A new admin can run a full session (mark, log, close) in under two minutes | **NOT YET**: needs a person with a stopwatch |
| All exports open correctly in Excel and Google Sheets, accents included | **PARTLY**: all five CSVs are UTF-8 with the marker Excel needs, every value is quoted, and accents survive ("Álvaro", "Lucía"). They weren't opened in Excel itself |

## §10 Going live

| Box | Result |
|---|---|
| The repo is on GitHub and the site is live on a URL | **PARTLY**: the code is on GitHub. Deploying needs your Vercel or Netlify account |
| The demo banner is gone (live database connected) | **NOT YET**: needs the Supabase URL and anon key in `assets/js/config.js` |
| The default codes are changed | **NOT YET**: do this in Supabase (SETUP step 3) |
| Two real student accounts and one admin pass every privacy test | **PARTLY**: 80 of 80 pass on the local copy. Repeat by hand on the live project (SETUP step 7) |

## Fixed during this pass

- **Database:** the survey stored ratings of admins and pending accounts. Students could move a reflection onto a session they didn't attend. A paused admin kept admin rights. The agreement had no due date.
- **Survey results:** added **Export ratings (CSV)** and **Export per-person summary** (§7.4).
- **Layout:** the landing menu at 768 px, the hero name overlapping the stat cards, the calendar at 390 px, and the person card hidden under the demo banner.
- **Motion (to build):** the hero film timeline (dawn, seal, letter-by-letter name, promise, proof cards, light sweep); the light sweep on the final call; leaf drift on the hero and final call; the attendance ring sweeping from 0; the Home banner breathing; and the badge-earned flip, sweep and toast.
