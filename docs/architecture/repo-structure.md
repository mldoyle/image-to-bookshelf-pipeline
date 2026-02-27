# Repo Structure

```text
/
  apps/
    backend/
      pyproject.toml
      src/bookshelf_backend/
      tests/
      migrations/
      scripts/
      README.md
    client/
      package.json
      app.json
      src/
      assets/
      scripts/
      README.md
  tools/
    web-harness/
      package.json
      src/
      README.md
    scanner-core/
      package.json
      src/
      test/
      README.md
  docs/
    architecture/
    runbooks/
    archive/
  scripts/
    dev/
  .gitignore
  package.json
  README.md
```

## Placement Rules

- Deployable services live under `apps/`.
- Internal tooling and experimentation live under `tools/`.
- Backend Python package is `bookshelf_backend`.
- Runtime/build artifacts are never tracked.
