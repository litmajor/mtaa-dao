# Database deployment workflow

## Production

The application does not migrate the database from its normal production startup. Apply schema changes once, as a deployment step, before starting the new application image:

```sh
docker compose --env-file .env.production up -d --wait db redis
docker compose --env-file .env.production run --rm --no-deps api node server/dist/migrate.js
docker compose --env-file .env.production up -d --no-build --wait --wait-timeout 180
```

The migration command waits for PostgreSQL, takes a PostgreSQL advisory lock so two deployment runners do not execute concurrently, and exits non-zero on a reported migration failure. The deployment must stop if the command fails; do not continue to start the new app image.

Before the first production run, take a database backup and run the same release against a staging copy. The current TypeScript migration runner executes its registered migration sequence; it does not yet maintain a per-migration applied-version history. Existing migrations are expected to be repeat-safe, but this must be reviewed and verified against the actual database before rollout.

`RUN_MIGRATIONS=true` is rejected by production application startup. This prevents each replica from attempting schema changes during rollout.

## Local development

Use the explicit migration runner for application migrations:

```sh
npm run migrate
```

`npm run db:push` is only for disposable development databases and requires an explicit opt-in:

```sh
ALLOW_DRIZZLE_PUSH=true npm run db:push
```

It refuses to run when `NODE_ENV=production` or `DEPLOYMENT_ENV=production`. `drizzle-kit push` compares the current database to the Drizzle schema and may suggest destructive operations; inspect its full diff and abort if it proposes dropping or renaming data you need. Never set the opt-in for a production database.

## Migration authoring and CI

- Add application schema migrations under `server/db/migrations/` and register them in `server/db/migrations/index.ts`.
- Run migrations against a local database, then verify the result against a staging copy with representative data.
- The CI workflow uses guarded `db:push` only against its disposable PostgreSQL service to prepare a test schema; it does not use that path for production.
- Keep production database backups and a tested restore procedure. A successful application build is not a substitute for testing schema migrations.
