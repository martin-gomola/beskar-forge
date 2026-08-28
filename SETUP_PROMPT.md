# Start a new project with a coding agent

Copy the prompt below into Codex, Claude Code, Cursor, or another coding agent.
Replace the four values in square brackets first.

```text
Create a new app from the Beskar Forge template.

App name: [APP NAME]
App description: [ONE-SENTENCE DESCRIPTION]
New project folder: [ABSOLUTE DESTINATION PATH]
Template folder: [ABSOLUTE PATH TO BESKAR FORGE]

Please complete the setup for me:

1. Copy the template into the new project folder. Do not change the source
   template.
2. Remove the copied Git history and initialize a new repository.
3. Replace the Beskar Forge names, descriptions, package names, page title,
   PWA manifest values, and agent-guide placeholders with values for my app.
4. Keep the existing mobile-first PWA shell, service-worker update flow,
   frontend API helper, FastAPI security defaults, Docker workflow, and tests.
5. Keep the included Field Notes workflow working until my first frontend and
   backend flow replaces it. Reuse its local-first storage and synchronization
   patterns when the feature needs offline data. Use the Garden Planner
   reference application at https://github.com/martin-gomola/garden-planner
   when you need an example of a fuller feature built from this template.
6. Create config/.env from config/env.example. Do not add secrets.
7. Run make check, then make setup.
8. Confirm that the frontend, backend health endpoint, API documentation, and
   example frontend-to-backend request work.
9. Report the files changed, checks run, local URLs, and anything I still need
   to choose. Do not add a database, router, state library, job queue, or other
   dependency unless my first feature requires it.
```

After setup, describe the first user action you want to build. For example:

```text
Replace the Field Notes screen with a tip calculator. The user enters the bill,
tip percentage, and number of people. Send the values to FastAPI and show the
per-person amount.
```
