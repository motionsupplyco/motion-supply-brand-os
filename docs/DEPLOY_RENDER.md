# Render deployment — easiest full-stack route

1. Create a private GitHub repo and push this project.
2. In Render, create **New → Web Service** and connect the repo.
3. Runtime: Node.
4. Build command: `npm install`
5. Start command: `npm start`
6. Add the required variables from `.env.example` in Render's Environment tab. Prefer `SUPABASE_PUBLISHABLE_KEY` + `SUPABASE_SECRET_KEY`; legacy names are supported only for migration.
7. Deploy.
8. Copy the Render HTTPS URL into `APP_URL`, then redeploy.
9. Add that same origin to Supabase Auth Site URL / redirect settings.
10. Create the Stripe webhook using `https://YOUR-RENDER-DOMAIN/api/stripe-webhook`.
11. After it works, connect your custom domain/subdomain.

Do not paste Stripe secret keys or the Supabase service-role key into GitHub files.
