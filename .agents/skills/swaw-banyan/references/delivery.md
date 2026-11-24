# Delivery configuration and checks

```text
swban build                                       #Build pages and search index
swban check/delivery [dir]                           #Check delivery output and fingerprint paths
swban check/delivery ./public --base-path /base/     #Check a build published under /base/
```

The check reads a completed build, defaulting to `public`. Use a clean destination
after changing output switches so old files do not remain in the result.
The URL prefix defaults to `/`. For a site published under a subdirectory,
set `--base-path` to that prefix, as in the example above.

## Configuration

Choose platforms, SW mode, content check interval and prefetch in `assets/deploy/settings.toml`. Add ordered URL redirects to the optional `assets/deploy/redirects.toml`. The Module supplies `assets/deploy/policy.toml` with cache routes and prefetch profiles. To customize these rules, copy the complete policy to the same path in the site.

Keep general routes first and exceptions last. HTTP output retains declaration
order. SW uses only routes with `sw`, reverses them and takes the first match.

The Banyan reference file enables both platform products. Disable outputs the
site does not use. An omitted product is disabled; each declared product needs
its `enabled` switch. Set `pages.enabled` and `makers.enabled` in the complete site file:

```toml
[platform.cloudflare]
pages.enabled = true

[platform.edgeone]
makers.enabled = false
```

Cloudflare Pages generates `_headers` and `_redirects` when enabled. EdgeOne Makers
generates `edgeone.json` with headers and redirects when enabled. Configure build
commands and tool versions on the hosting platform. SW `enable` also generates `sw-policy.json`, an exact copy
of its path/bucket array in matching order. SW `off` and `disable` omit that copy;
`disable` still generates the cleanup worker.
When a managed navigation misses the cache and the network fails, the worker returns a self-contained English 503 page.

## Prefetch and Service Worker settings

`[prefetch]` and `[sw]` apply to all languages. Routes use independent `http`
and `sw.bucket` fields. `versioned` selects the SW versioned cache bucket;
`fingerprinted` selects the SW fingerprint cache bucket; `off` bypasses SW caching.
The versioned bucket follows the site build version published in `sw-version.json`.
The fingerprint bucket retains resources across builds by their fingerprint URLs.
For deployment preparation, use `swban help/en deploy`; see [EdgeOne](edgeone.md)
for its Git-build configuration requirements.

Configure these fields in `assets/deploy/settings.toml`:

```toml
[prefetch]
enabled = true

[sw]
mode = "enable"
content_check_interval = 5
```

`prefetch.prerender` settings control native prerender for selected icon scopes.
The Banyan reference policy uses moderate prerender for tail folder links.
Column scopes are `root`, `tail`, `"root+N"`, `"tail-N"`, and `all`.
The example omits icon-specific settings; add icon scopes when needed.

For status controls and diagnostic pages, read [Status and diagnostics](diagnostics.md).

## Checked output

The command reads `_headers`, `_redirects`, `edgeone.json` and `sw-policy.json`
when present. It checks the generated formats, fingerprint paths and redirect
rules, then visits each published file name once.

- A path marked `fingerprinted` by SW or `immutable` by HTTP expects a Hugo
  SHA-256 fingerprint or a native esbuild resource hash. Missing hashes are reported.
- HTTP and SW policies are independent. Either HTTP `immutable` or SW
  `fingerprinted` is sufficient to mark a fingerprint path.
- Outside fingerprint paths, fingerprinted file names are reported.
- Other files follow their configured cache policy; file extensions do not
  restrict publication.

The check uses browser URL paths, preserving characters such as `+` and encoding
spaces and non-ASCII characters. It does not assume fixed resource directories.
Cloudflare matching includes inherited headers and explicit header removals.
EdgeOne redirects also support `$host` to `$wwwhost` and the reverse pair.
For EdgeOne, the check uses the last matching declaration of `Cache-Control`.
Put the default rule first and exceptions after it. See the
[EdgeOne header order test](edgeone.md#response-header-order).

## Limits

Missing output channels are reported as unchecked. Output alone cannot show
whether the site disabled a channel or failed to generate it. Module rendering
tests verify configuration switches and the SW policy copy.

The command does not read source TOML, parse `sw.js`, read resource bodies or
recalculate content hashes. It checks generated declarations and file names.
It does not compare manually maintained baselines or verify live CDN behavior.
Use the HTTP and browser checks for deployed behavior.
