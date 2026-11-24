# Powered by diagnostics

Use the `page-powered-by` layout. Each language owns its introduction and diagnostic text in `content/powered-by/index*.md`. The layout renders the introduction, the five status rows, then the collapsed prefetch diagnostics.

Use `module/archetypes/page-powered-by.md` as the starting point for a translation. Edit headings, instructions and the interval format in `params.diagnostics`. Keep `%d` in the interval format for the number of minutes. Edit status messages in `params.site_status.labels` and prefetch controls in `params.prefetch_debug.labels`.

The server and SW program rows refresh independently. The prefetch transport selector applies to the current page. See [Delivery configuration](delivery.md) for site-wide settings.
