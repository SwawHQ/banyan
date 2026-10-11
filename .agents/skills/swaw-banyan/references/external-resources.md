# External resources

Run `swban sync/ext [id...]` from the site root to fetch resources declared in
`data/external-resources.yaml`. With no IDs, it syncs all declarations. This
command writes the declared site files; it is not a check or a build step.

```yaml
resources:
  - id: catalogue
    source: https://example.com/catalogue.json
    target: data/catalogue.json
    validators: [json, "min-size:2KiB", "max-size:1MB"]
```

Each declaration needs `id`, HTTP(S) `source` and a site-relative `target`.
Optional validators are `json`, `json:<dot.path>`, `min-size:<size>` and
`max-size:<size>`. For example, `json:items` requires that property to exist.

The command validates downloaded bytes before replacing each target, preserves
identical files and stops on a failed fetch or validation. Earlier successful
resources remain updated if a later resource fails. No site npm packages are
needed.
