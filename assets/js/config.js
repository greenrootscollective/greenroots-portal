// =====================================================================
//  Site configuration
//
//  Leave SUPABASE_URL empty and the site runs in DEMO MODE: data lives only
//  in your browser, which is perfect for trying everything out.
//
//  Fill both values in and the site uses the real Supabase database.
//  Find them in Supabase → Project Settings → API.
//  (The "anon public" key is meant to be public. Security is enforced by
//   the database rules in supabase/schema.sql, not by hiding this key.)
//
//  Schools (and which email domains each one uses) are managed from
//  Admin → Settings, not here.
// =====================================================================
export const CONFIG = {
  SUPABASE_URL: "",
  SUPABASE_ANON_KEY: "",

  ORG: "Greenroots Collective",
  SLOGAN: "planting seeds, growing change",
  PROGRAMME: "Recycling Initiative",
  YEAR: "2026–27",
  MAIN_SITE: "https://greenroots.tech/",
  CONTACT_EMAIL: "greenrootscollectiveorg@gmail.com",
  INSTAGRAM: "https://www.instagram.com/greenroots.collective/",

  CLASSES: [
    "1 ESO A", "1 ESO B", "2 ESO A", "2 ESO B", "3 ESO A", "3 ESO B", "4 ESO A", "4 ESO B",
    "1º Baccalaureate (National)", "1º Baccalaureate (International)",
    "2º Baccalaureate (National)", "2º Baccalaureate (International)", "Staff", "Other",
  ],
};
