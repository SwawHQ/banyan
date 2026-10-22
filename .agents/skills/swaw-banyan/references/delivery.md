# Delivery checks

```text
swban base/hugo --minify --gc --cleanDestinationDir  #Build production output
swban check/delivery [dir]                           #Check delivery output and fingerprint paths
swban check/delivery ./public --base-path /base/     #Check a build published under /base/
```

The check reads a completed build, defaulting to `public`. Use a clean destination
after changing output switches so old files do not remain in the result.
The URL prefix defaults to `/`. For a site published under a subdirectory,
set `--base-path` to that prefix, as in the example above.

## Configuration

Module defaults live in `module/data/delivery.toml`. A site's
`data/delivery.toml` replaces declared top-level fields through Hugo's data loader.
Nested fields do not merge. Copy the complete table to change it. A declared
`routes` array replaces all default routes; `routes = []` removes them.

Keep general routes first and exceptions last. HTTP output retains declaration
order. SW uses only routes with `sw`, reverses them and takes the first match.

Both platforms are enabled by default. A site declaring `platform` replaces that
whole table. An omitted platform is disabled; each declared platform needs its
`enabled` switch. For example:

```toml
[platform.cloudflare.pages]
enabled = true

[platform.edgeone.makers]
enabled = false
```

Cloudflare Pages generates `_headers` and `_redirects` when enabled. EdgeOne Makers
generates `edgeone.json` when enabled; copy its default build fields when enabling
it in a site-owned table. SW `enable` also generates `sw-policy.json`, an exact copy
of its path/bucket array in matching order. SW `off` and `disable` omit that copy;
`disable` still generates the cleanup worker.

## Checked output

The command reads `_headers`, `_redirects`, `edgeone.json` and `sw-policy.json`
when present. It checks the generated formats, fingerprint paths and redirect
rules, then visits each published file name once.

- A path marked `fingerprinted` by SW or `immutable` by HTTP expects a full
  lowercase SHA-256 fingerprint in its file name. Missing fingerprints are reported.
- HTTP and SW policies are independent. Either HTTP `immutable` or SW
  `fingerprinted` is sufficient to mark a fingerprint path.
- Outside fingerprint paths, fingerprinted file names are reported.
- Other files follow their configured cache policy; file extensions do not
  restrict publication.

The check uses browser URL paths, preserving characters such as `+` and encoding
spaces and non-ASCII characters. It does not assume fixed resource directories.
Cloudflare matching includes inherited headers and explicit header removals.
EdgeOne redirects also support `$host` to `$wwwhost` and the reverse pair.
Conflicting overlapping EdgeOne cache headers are reported as undetermined,
because the platform does not define that precedence in its configuration guide.

## Limits

Missing output channels are reported as unchecked. Output alone cannot show
whether the site disabled a channel or failed to generate it. Module rendering
tests verify configuration switches and the SW policy copy.

The command does not read source TOML, parse `sw.js`, read resource bodies or
recalculate content hashes. It checks generated declarations and file names.
It does not compare manually maintained baselines or verify live CDN behavior.
Use the HTTP and browser checks for deployed behavior.
