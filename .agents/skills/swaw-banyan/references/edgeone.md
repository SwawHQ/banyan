# EdgeOne delivery configuration

Enable `platform.edgeone.makers.enabled` in the site-owned
`assets/site/delivery.toml`. Banyan generates headers and redirects in
`edgeone.json`; build commands, output directory and tool versions belong
to platform settings.

## Git hosting

Read [Git build preparation](../tasks/deploy/edgeone/git/help.json).
Only sites using EdgeOne Git builds need a committed root `edgeone.json`.
Build and check locally, then copy `public/edgeone.json` to the site root
with PowerShell `Copy-Item`, as shown in the guide. Maintain delivery rules
in `delivery.toml`, not by hand in the generated root file. Regenerate and
copy it when delivery rules or CSP change.

In the 2026-11-14 Git build test, root headers and redirects applied;
generated `public/edgeone.json` did not, even without a root file.
Keep local and platform builds consistent so the committed CSP matches output.

## Built-asset upload

Read [Output upload preparation](../tasks/deploy/edgeone/upload/help.json).
Upload the checked output directory with its generated `edgeone.json`.
No configuration transformation or source-root sync is needed.

Both guides link to Swaw Clouds for authorization and platform operations.
