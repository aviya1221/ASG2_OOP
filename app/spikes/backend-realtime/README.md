# Spike: database, live updates and files (Supabase)

Hands-on test for the tools report: can Supabase's free plan carry a class of 50 students?

It measures how fast a new message reaches 50 connected clients, in two ways (database changes and direct broadcast) and at four paces, from one message every 2 s to the whole class sending within 1 s. It also measures signing in and storing a file.

## Run

1. Create a free project at <https://supabase.com>.
2. In the SQL Editor, paste and run [setup.sql](setup.sql).
3. Copy `.env.example` to `.env` and fill in the project URL and the two keys.
4. Run:

```sh
npm install
npm start
```

The results are written to `results/`. When you are done, run [cleanup.sql](cleanup.sql) in the SQL Editor.
