<p align="center"><img src="assets/img/icon.png" width="96" alt="Greenroots Collective"></p>

<h1 align="center">Greenroots Portal</h1>
<p align="center"><i>“planting seeds, growing change”</i><br>Greenroots Collective · Agora Madrid International School · CAS 2026–27</p>

---

The Greenroots Portal is Greenroots Collective's website and participant portal: a scrolling GRC mini-site plus a private portal for each student and a control room for admins. Its first programme is the **CAS Recycling Initiative**; more GRC programmes (Garden Club, workshops) will plug into the same portal later. Students sign up with their school email, unlock their portal with a code, and take a **private survey** about who they'd like to work with. The admin team then builds **fair, balanced groups** with one click, schedules the weekly rotation, marks attendance, and exports everything to the GRC Mainframe.

**Students get:** a home dashboard, **Activities** with due dates (group survey, agreement, forms, CAS reflections), a calendar with *add to phone* and *can't make it*, an **attendance tracker** (rate, hours, streak), their group and the group league, badges, announcements, the participant guide and a printable **CAS summary**.

**Admins get:** an overview with alerts, members with **Mainframe CSV export**, activities with completion and WhatsApp nudges, confidential survey results, the **group builder**, sessions & impact logging (kg, bags, photos), an attendance grid with absence approvals, announcements, **schools** and settings.

## Deploy on Vercel

It's a plain static site: no build step. `vercel.json` tells Vercel to serve the repo root as-is (framework *Other*, no build command, output directory `.`). `.vercelignore` keeps `docs/` and `supabase/` off the public site.

## Try it now

Open `index.html` through any static server (e.g. `python3 -m http.server`) , go to **Sign in** and click **Explore the demo as a student / an admin**. With no database connected it runs in demo mode with fictional names.

## Go live

See **[docs/SETUP.md](docs/SETUP.md)**. It takes about 20 minutes: create a free Supabase project, run `supabase/schema.sql`, paste two keys into `assets/js/config.js`, and deploy.

## Tested

`supabase/tests/run.sh` checks every privacy rule in the database (80 checks). **[docs/QA.md](docs/QA.md)** reports each DONE WHEN box from the Director's Plan (`docs/Directors-Plan.pdf`).

## How it's planned

See **[docs/PLAN.md](docs/PLAN.md)** for the user journeys, the grouping formula, privacy rules and the roadmap.

---

© 2024–2026 Greenroots Collective. All rights reserved. Branding, designs and content are the property of Greenroots Collective and may not be reused without written permission from the Executive Director.
