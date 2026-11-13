# EdgeOne Makers deployment

Run from the site root:

```text
swban base/hugo --minify --gc --cleanDestinationDir  #Build production output
swban check/delivery                                 #Check platform output
swban check/csp                                      #Check CSP
swban check/llms                                     #Check llms.txt
swban check/robots                                   #Check crawler rules
```

Hugo builds minified production output in `public`. Checks inspect that output
independently. Skill tool selection and portable tools belong to local use.
Enable EdgeOne output with `platform.edgeone.makers.enabled = true` in
the complete `assets/site/delivery.toml`. Use the Banyan root file as a reference;
the Module supplies no configuration defaults. Include every platform and build setting
the site needs.

## Git hosting

EdgeOne provides Hugo Extended and reads `hugoVersion` from root `edgeone.json`.
Banyan generates that field from the Hugo version used for the build; a site's
`assets/site/delivery.toml` may override `makers.hugoVersion` under `[platform.edgeone]`.
Include the other required platform fields when making this override.
For Git hosting, copy the generated config to the site root before committing:

```text
swban deploy/edgeone/sync [dir]  #Copy generated config to the site root
```

Sync defaults to `public`; it only copies config bytes and does not build or
upload. Hosted builds use the theme's native Hugo command and the platform's
tools. They do not install or invoke the Skill. Hugo Modules require host Go
and Git. Site installation settings use `makers.*` under `[platform.edgeone]` in
`assets/site/delivery.toml`; initialize submodules only when the site uses them.
Keep `outputDirectory` consistent with the build destination.

## Built-asset upload

Direct upload publishes the completed output directory, including `index.html`
and generated `edgeone.json`. The platform does not build it again. This path
does not need config copied to the source-site root. EdgeOne uses only redirects,
rewrites and headers from `edgeone.json` for direct upload.

Use the independent [Swaw Clouds](https://github.com/SwawHQ/swaw-clouds) Skill
for authentication and upload. Pass the completed output directory as an absolute path
to its `edgeone/cli` command.

Platform details: [Hugo hosting](https://pages.edgeone.ai/document/hugo) and
[direct upload](https://pages.edgeone.ai/document/direct-upload).
