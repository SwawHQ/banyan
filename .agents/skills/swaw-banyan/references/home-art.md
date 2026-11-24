# Wind scenes

Use `art-wind` in page content. Supply a JSON object between the opening and closing tags. The Module provides the template, CSS and JavaScript. Each call has its own settings.

```markdown
{{< art-wind >}}
{"heading":"Explore","brand_line":"Start here","signals":["News",{"name":"Docs","url":"/docs/"}]}
{{< /art-wind >}}
```

For a custom effect, add a template under `layouts/_shortcodes/` at the site root and call it in the page body. For homepage navigation, see [Content and layouts](content.md#home-page).
