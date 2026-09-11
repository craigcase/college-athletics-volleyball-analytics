# Supabase Setup — One Time

Do not manually build tables in the dashboard. The migration creates the complete canonical schema.

## 1. Create the project

In Supabase, create one project for the volleyball platform. Choose a region close to the expected users and save the database password somewhere secure.

## 2. Apply the schema

Open **SQL Editor → New query**. Paste the complete contents of:

`supabase/migrations/202609090001_initial.sql`

Run it once. It creates the 23 application tables, indexes, fail-closed RLS, and the private `volleyball-evidence` Storage bucket.

## 3. Copy API values

In the Supabase project settings/API area, copy:

- Project URL
- Publishable key
- Secret key

The secret key is a secret. Never put it in client code, screenshots, or a committed file.

## 4. StackBlitz environment

Because this repository may be public, **do not paste the secret key into a normal project file or commit it to GitHub**. Use StackBlitz's encrypted Environment Variables feature (Settings → Variables, scoped to this GitHub repository), or the special encrypted `.env` editor provided by StackBlitz Codeflow. Add:

```text
NEXT_PUBLIC_SUPABASE_URL=<Project URL>
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<Publishable key>
SUPABASE_SECRET_KEY=<Secret key>
SUPABASE_EVIDENCE_BUCKET=volleyball-evidence
```

The first two values are browser-safe. `SUPABASE_SECRET_KEY` is server-only and must remain encrypted/private. Restart `npm run dev` after changing environment variables.

For development on your own computer instead of StackBlitz, you may put the same values in a gitignored `.env.local` file.

## 5. Authentication

The app uses Supabase email/password authentication. On first launch use **Create Account**. If the Supabase project requires email confirmation, confirm the email and then sign in.

## 6. Netlify environment

After StackBlitz is working, connect the GitHub repository in Netlify and add the same four variables under the site's environment variables. Netlify should detect Next.js automatically; the repository also includes `netlify.toml` with the Node version and build command.

## Security model

- The publishable key is intentionally browser-safe.
- The secret key is server-only.
- Program data is read/written only by server routes/components after verified Supabase Auth + program-membership checks.
- RLS is enabled with no broad browser policies, so accidental direct browser access to program intelligence fails closed.
- Imported evidence is stored in a private bucket before parser/canonical writes.
