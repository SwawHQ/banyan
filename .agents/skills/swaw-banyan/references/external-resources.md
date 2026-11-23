# External resources

Run `swban sync/resources [--force] [id...]` from the site root to fetch resources declared in
`assets/site/external-resources.toml`. With no IDs, it syncs all declarations. If any selected target exists, the command stops before downloading. Add `--force` to replace existing files after validation.

```toml
[[resources]]
id = "catalogue"
source = "https://example.com/catalogue.json"
target = "assets/site/catalogue.json"
validators = ["json", "min-size:2KiB", "max-size:1MB"]
```

Each declaration needs `id`, HTTP(S) `source` and a site-relative `target`.
Use `assets/site/` for site resources or `content/<page>/` for page-bundle files.
The target is relative to the site root, not the registry's directory.
Optional validators are `json`, `json:<dot.path>`, `min-size:<size>` and
`max-size:<size>`. For example, `json:items` requires that property to exist.

The command validates downloaded bytes before replacing each target, and stops on a failed fetch or validation. Earlier successful
resources remain updated if a later resource fails. No site npm packages are
needed.
