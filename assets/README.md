# Assets

This directory contains theme-provided Hugo assets. A consuming site may override
these files by placing files at the same paths under its root `assets/`
directory.

## Theme colors

`css/theme.css` owns color roles and their light/dark defaults, including aliases
and mixing formulas. Component CSS and the icon library consume those roles;
layout, animation, opacity, and interaction selectors stay with their components.

| Scope | Color roles |
| --- | --- |
| `:root` | Page background, foreground, muted text, border, accent, accent text, link states, focus ring |
| `.icon` | Accent and shaded parts of colored icons; line icons still use `currentColor` |
| `.collection-item-link` | Normal, visited, hover/focus, and current text; hover/current backgrounds and current ring |
| `.prose` | Heading and rule borders, deleted text and decoration; inline code, quotes, images, tables, code blocks, syntax tokens, and code scrollbars |
| `.page-home` | Anchor, horizon, signals and their selected color, windsock body/stripes/pole |

Unqualified scopes apply to both light and dark modes. A dark block only lists
different defaults; roles with the same formula follow their changing inputs
without repeating the declaration.

Keep separate role names when the uses may need independent customization, even
if their defaults match. A role can contain a literal, an alias, or a formula;
switching between them does not require editing component CSS. Simple inherited
text, `currentColor`, `transparent`, and browser-controlled colors do not need a
new variable for every declaration.

The shared `--prose-border-base` is the neutral input for inline code, table, and
image borders. Each keeps its own output role and tint strength. Other one-use
mixing inputs are written directly in the role definition instead of adding a
second variable. Syntax token colors and the homepage signal color remain
independent palette decisions. Existing mix ratios preserve Banyan's current
appearance; they are not a contrast-safe generator for arbitrary accent colors.

To customize the palette, copy the complete `css/theme.css` into the site's root
`assets/css/theme.css` and edit its values. Hugo replaces this asset as a whole;
it does not merge individual declarations. Preserve the scopes above and their
dark variants. Edit the role where it is defined: custom property aliases and
mixes resolve before inheritance, so setting a prose role only on `:root` will
not override its definition on `.prose`. A light/dark-specific declaration also
takes precedence over the unqualified scope. For example, replace both existing
`--table-header-bg` declarations to customize it in both themes:

```css
.prose {
    --table-header-bg: #F4F4F4;
}
[data-theme="dark"] .prose {
    --table-header-bg: #252525;
}
```

When updating the theme, carry new roles into the site's copy. The normal CSS
pipeline still handles production minification and fingerprinting. Only color
definitions join the shared `page.css`; prose layout and homepage animation
styles retain their existing page-specific bundles.

When simplifying the palette further, first choose neutral/accent tonal values,
then map roles to them and check actual foreground/background pairs in both
themes. Do not merge roles just because one light or dark value happens to match,
and do not assume a fixed mixing percentage produces readable text for every hue.

## Published resources

- `site/` contains site-level resources published with fingerprinted URLs, such as `/site/pwa/*` and `/site/brand/*`.
- `site/pwa/` contains PWA icons and favicon sources used by the theme.
- `site/brand/` contains shared brand media that content can publish with the `asset` shortcode.

Everything published under `/site/*` is treated as immutable and must go through Hugo's fingerprinted asset pipeline. Article-local files belong in the page bundle and publish under `/media/content/*`.
