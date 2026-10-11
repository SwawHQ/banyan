# EdgeOne deployment

Run from the site root:

```text
swban hugo --minify --gc --cleanDestinationDir
swban check/csp
swban check/llms
swban check/robots
```

Hugo builds minified production output in `public`. Checks inspect that output
independently. Skill tool selection and portable tools belong to local use.

## Git hosting

EdgeOne provides Hugo Extended and reads `hugoVersion` from root `edgeone.json`.
Banyan generates that field from the Hugo version used for the build; a site's
`data/cache-policy.toml` may override `[edgeone].hugoVersion`.
For Git hosting, copy the generated config to the site root before committing:

```text
swban deploy/edgeone/sync [dir]
```

Sync defaults to `public`; it only copies config bytes and does not build or
upload. Hosted builds use the theme's native Hugo command and the platform's
tools. They do not install or invoke the Skill. Hugo Modules require host Go
and Git. Site installation settings belong in `[edgeone]` in
`data/cache-policy.toml`; initialize submodules only when the site uses them.
Keep `outputDirectory` consistent with the build destination.

## Built-asset upload

Direct upload publishes the completed output directory, including `index.html`
and generated `edgeone.json`. The platform does not build it again. This path
does not need config copied to the source-site root. EdgeOne uses only redirects,
rewrites and headers from `edgeone.json` for direct upload.

The Skill has no upload command yet. Future platform publication tasks will
accept completed output and handle authentication, upload and the deployment
result. They will not configure the hosted build environment.

Platform details: [Hugo hosting](https://pages.edgeone.ai/document/hugo) and
[direct upload](https://pages.edgeone.ai/document/direct-upload).
See [Hugo server configuration](https://gohugo.io/configuration/server/#404-errors)
for local multilingual 404 routing. A default local `/404.html` response does
not mean the translated 404 files rendered in English.
