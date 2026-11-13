# Home art

Read this when creating or changing an art bundle for a `page-home` homepage.
For the host page and navigation setting, see [Home page](content.md#home-page).
For an alternative homepage layout, see [Image walls](content.md#image-walls).

## Start from a bundle

Copy one bundle from `content/_res/home-art/`: `minimal/` provides a template and
CSS without JavaScript; `wind/` provides a complete animated example. Edit the
new bundle's translated `index*.md`, template and resources, then update each
home page's `home-art` shortcode to reference it.

The bundle is a hidden Hugo leaf bundle with no standalone page. Each home
renders its language's bundle page and keeps its own title, description and URL.
Keep scene-specific HTML, calculations, CSS and JavaScript in the bundle;
no scene-specific Module templates or shortcodes are needed.

## Configure resources

The shared `content/_res/home-art/_index.md` hides these bundles through its
build cascade. When creating a bundle outside that branch, retain the same
`list: never`, `render: never` and `publishResources: false` build settings.

Choose resources in each bundle page's front matter:

```yaml
params:
  template: scene.html.tmpl
  styles: [style.css]
  scripts: [script.js] #Omit when the scene needs no JavaScript.
```

`params.template` selects a local `.html.tmpl` resource. `styles` and `scripts`
select CSS and JS published as fingerprinted external files. Scene-specific
settings belong in the same page's `params`.

## Render safely

The template receives the art page: use `.Params`, `.Resources` and `.Content`.
Place `.Content` where the Markdown body belongs; the wind example places it
after the scene. Resource templates do not auto-escape HTML. Use `htmlEscape`
for text and HTML attribute values; rendered `.Content` can be output directly.
