---
name: code-quality
description: Reviews changed React, TypeScript, FastAPI, Python, Docker, and configuration code for correctness, security, regressions, and ship readiness. Use for code review, TDD, test-first features, regression tests, lint or build failures, and issue verification. Avoid service architecture design, deployment operations, and PWA-specific UX work.
---

# Code Quality

Use one evidence-led workflow for reviewing changes and delivering test-backed fixes.

## Review Workflow

1. Inspect the working tree, relevant diff or commit, surrounding code, documentation, and existing tests.
2. Confirm the intended behavior before judging the implementation.
3. Check correctness, security boundaries, error behavior, loading states, data loss risk, compatibility, and missing regression coverage.
4. Report only concrete, actionable, high-confidence findings. Keep line ranges tight and omit style preferences that are not repository conventions.
5. When asked to fix a verified issue, add or identify a test that can fail for the real behavior, apply the smallest fix, and rerun the original failing path.

## Test-First Workflow

1. Select one observable behavior through a public interface.
2. Add one focused test and watch it fail for the expected reason.
3. Implement only enough behavior to make it pass.
4. Run the focused check, then the applicable repository validation.
5. Refactor only while the checks remain green.

## Project Checks

Use the narrowest relevant check first:

```bash
cd backend && python -m unittest discover -s tests
cd frontend && npm run build
make check
make doctor
```

`make doctor` is diagnostic and may report environment warnings; read its output instead of treating every warning as a code failure.

## Review Priorities

1. Exposed secrets, authorization gaps, injection, path traversal, or unsafe user-controlled input.
2. Incorrect behavior, regressions, data loss, stale state, swallowed failures, or external calls without bounded failure handling.
3. Missing tests at the public behavior seam.
4. Maintainability problems that materially increase change risk.
5. Measured performance problems.

For service-worker, manifest, installed-mode, or iOS PWA findings, also use the `pwa-app-design` skill.

## Completion

For reviews, lead with findings ordered by severity, then note validation and remaining gaps. For implemented fixes, report the root cause, changed behavior, commands run, and fresh results. Do not claim remote CI, deployment, or device behavior was verified unless it was observed.

## Dependencies

This skill uses Git, repository files, and existing project commands. It requires no MCP server, network service, credential, or additional package.
