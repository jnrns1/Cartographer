# Large codebases

Cartographer v0.1 targets codebases up to 5,000 CFML files (brief 9.2).

## How scanning scales

Files are scanned in chunks of 150. Each chunk runs in its own async
invocation inside the 15 minute consumer budget, so 5,000 files is about 34
chunks. Chunk events are enqueued linear-breadth (one continuation per batch of
50), so invocation depth stays far below the platform's 1000 cyclic cap.
Progress is derived from idempotent chunk markers, not accumulated counters, so
at-least-once redelivery never double counts.

## Over 5,000 files

The scan still runs but can degrade. Two options:

1. Continue. Acceptable for most repositories; total wall clock stays well
   under an hour.
2. Scope the first run. Add a `.cartographerignore` at the source root (gitignore
   syntax) to exclude generated code, vendored libraries, or test trees, then
   widen scope on a later scan. Only `.cfm`, `.cfc`, and `.cfml` files are
   scanned in the first place, which already bounds the work.

## Limits that matter

- KVS value cap 240 KiB. Work items and candidates are Custom Entities, not a
  single key, and are read back with cursor pagination.
- Resolver request 500 KB. Zip upload never crosses a resolver: it is a
  presigned Object Store upload, or chunked `<=200 KiB` parts.
- Resolver response 5 MB. Work item lists are paginated; exports are stored in
  the Object Store and the resolver returns only a presigned download URL.
