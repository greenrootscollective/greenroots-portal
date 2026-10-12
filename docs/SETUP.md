# Setup: from demo to live (about 20 minutes)

Until step 2 is done, the site runs in **demo mode**: it's fully clickable with fictional people, and data stays in your browser. Use the "Try the demo as a student / an admin" buttons.

## 1. Create the database (Supabase, free)

1. Go to <https://supabase.com>, sign in with GitHub and click **New project**. Name it `grc-recycling` and pick the region **EU (Frankfurt or Paris)**.
2. Open **SQL Editor → New query**, paste the whole of `supabase/schema.sql` and click **Run**. It should say "Success".
3. **Authentication → URL Configuration:** set **Site URL** to where the site will live (e.g. `https://recycling.greenroots.tech` or your GitHub Pages / Vercel link).
4. **Authentication → Providers → Email:** keep "Confirm email" **on**, so students must confirm their school email.

## 2. Connect the website

Supabase → **Project Settings → API**. Copy the **Project URL** and the **anon public** key into `assets/js/config.js`:

```js
SUPABASE_URL: "https://xxxxx.supabase.co",
SUPABASE_ANON_KEY: "eyJhbGciOi...",
```

The anon key is designed to be public. The security comes from the rules in `schema.sql`.

## 3. Change the codes

In Supabase → **SQL Editor**, run (with your own codes):

```sql
update app_secrets set join_code = 'RECYCLE26', admin_code = 'PICK-A-SECRET-ONE' where id = 1;
```

You can change them later from **Admin → Settings** too.

## 4. Check the schools

Agora Madrid International School (`@student.agoraism.com` / `@agoraism.com`) is added automatically. Add partner schools later in **Admin → Schools**. Students choose their school when they sign up and must use that school's email domain.

## 5. Make yourself admin

1. Open the site, **Create account** with your school email, and confirm the email.
2. On the code screen, type the **admin code**. You're now an admin.
   (Alternatively, in the SQL Editor: `update profiles set role='admin', status='member' where email='mazen.alchoumari@student.agoraism.com';`)
3. Give Hugo and Alberto the admin code, or promote them in **Admin → Members**.

## 6. Put it online

**Option A, GitHub Pages:** the repo must be public on a free plan. Go to Repo → Settings → Pages → Source: *Deploy from a branch* → `main` / root. The link appears in about 1 minute.

**Option B, Vercel / Netlify** (works with a private repo): go to vercel.com → *Add New Project* → import this repo → Framework: *Other* → Deploy. No build settings are needed.

**Custom domain (later):** in Vercel/Pages add `recycling.greenroots.tech`, then add the CNAME record it shows in your domain's DNS. Add the same URL to Supabase → Auth → URL Configuration.

## 7. Launch checklist

- [ ] The schema ran without errors
- [ ] `config.js` has the URL and key
- [ ] The codes have been changed from the defaults
- [ ] You can sign up, confirm, enter the admin code and see the admin pages
- [ ] A test student can sign up, join, and take the survey, and **cannot** see admin pages
- [ ] The school / Alberto is OK with collecting names, school emails and WhatsApp numbers
- [ ] The join code and the link have been sent in the email / WhatsApp Community

## Troubleshooting

| Problem | Fix |
|---|---|
| "Please choose your school and use that school's email address" | The email domain doesn't match the chosen school. Check the domains in Admin → Schools. |
| Confirmation email link opens the wrong site | Set the Site URL (step 1.3). |
| Students don't see their group | Admin → Groups → **Save groups**, then switch on **Publish**. |
| Demo data is messy | Click "Reset demo" in the yellow banner. |
