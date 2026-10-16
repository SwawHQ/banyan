swban - Banyan tools (Windows x64)

ensure reuses compatible tools; otherwise downloads. --force uses portable.

  swban help [en|zh]           #Help; default: system language
  swban ensure [--force]       #Prepare CLI; choose Bun or Node

  swban bun [native args...]   #Run Bun; use --help for details
  swban bun.check              #Check selected Bun
  swban bun.ensure [--force]   #Prepare Bun

  swban node [native args...]  #Run Node; use --help for details
  swban node.check             #Check selected Node
  swban node.ensure [--force]  #Prepare Node; portable adds npm
  swban npm [native args...]   #Run npm; use --help for details
  swban npx [native args...]   #Run npx; use --help for details

  swban git [native args...]   #Run Git; use help for details
  swban git.check              #Check selected Git
  swban git.ensure [--force]   #Prepare Git

  swban gh [native args...]    #Run GitHub CLI; use --help for details
  swban gh.check               #Check selected GitHub CLI
  swban gh.ensure [--force]    #Prepare GitHub CLI when needed

  swban go [native args...]    #Run Go; use help for details
  swban go.check               #Check selected Go SDK
  swban go.ensure [--force]    #Prepare Go SDK

  swban hugo [native args...]  #Run Hugo; use --help for details
  swban hugo.check             #Check selected Hugo
  swban hugo.ensure [--force]  #Prepare Hugo Extended

Module pairing (default site: current directory):
  swban check/module [site]    #Check Skill and resolved Module versions

Content declarations (default site: current directory):
  swban check/content/translation-placeholder [site]  #Translation placeholders
  swban check/content/share-image [site]              #Share-image fields

Published output (default dir: public):
  swban check/html/metadata [dir]     #Page metadata and article date rows
  swban check/html/headings [dir]     #Heading counts
  swban check/html/jsonld [dir]       #JSON-LD syntax
  swban check/html/scripts [dir]      #Script references and page controls
  swban check/html/styles [dir]       #Stylesheet references
  swban check/html/breadcrumb [dir]   #Breadcrumb data
  swban check/sitemap [dir]           #Sitemap indexing
  swban check/robots [dir]            #robots.txt declarations
  swban check/llms [dir]              #llms.txt and links
  swban check/delivery [dir]          #Delivery output and fingerprint paths
  swban check/csp [dir]               #Inline hashes and CSP
  swban check/sri [dir]               #Script integrity hashes
  swban check/build-version [dir]     #Build version agreement
  swban check/prefetch/payload [dir]  #Page prefetch payloads
  swban check/prefetch/rules [dir]    #Shared speculation rules
  swban check/img/responsive [dir]    #Responsive images
  swban check/img/share [dir]         #Generated share images
  swban check/img/icons [dir]         #Image icon resources

HTTP responses:
  swban check/http/security <url>     #Security response headers
  swban check/http/cache <url>        #Resource cache headers
  swban check/http/speculation <url>  #Inline speculation rules

Browser checks (dir: public; append --help for all options):
  swban ensure/browser                                                                          #Prepare Playwright/Chromium
  swban ensure/browser.webkit                                                                   #Prepare Playwright/WebKit
  swban check/browser/site [dir] [--updates] [--site source]                                     #Discover pages and check; optionally build a next SW version
  swban check/browser/home [dir] [--headed] [--trace]                                           #Home page; Chromium
  swban check/browser/home.webkit [dir] [--headed] [--trace]                                    #Home page; WebKit
  swban check/browser/csp [dir] [--page path] [--headed] [--trace]                              #CSP enforcement; Chromium
  swban check/browser/csp.webkit [dir] [--page path] [--headed] [--trace]                       #CSP enforcement; WebKit
  swban check/browser/prefetch/rules [dir] [--page path] [--expect inline|off] [--eager rules]  #Browser rule acceptance; Chromium
  swban check/browser/prefetch/overlap [dir] --page path                                        #Native selection suppresses custom prefetch; Chromium
  swban check/browser/prefetch/debug [dir] --page path                                          #Prefetch diagnostic panels and page payloads; Chromium
  swban check/browser/palette/contrast [dir] [--page path] [--min N]                            #Prose/code contrast; Chromium
  swban check/browser/palette/contrast.webkit [dir] [--page path] [--min N]                     #Prose/code contrast; WebKit
  swban check/browser/palette/roles [dir] [--page path]                                         #Derived palette roles; Chromium
  swban check/browser/appearance [dir] [--page path] [--from path]                              #Appearance preferences; Chromium
  swban check/browser/appearance.webkit [dir] [--page path] [--from path]                       #Appearance preferences; WebKit
  swban check/browser/language/choices [dir] [--page path]                                      #Native language links and accessible choices; Chromium
  swban check/browser/language/return [dir] --from path --to code [--page path]                 #Language returns, missing translations and isolation; Chromium
  swban check/browser/language/bfcache [dir] --from path --to code [--next code]                #Real BFCache language returns; Chromium
  swban check/browser/settings/url [dir] --page path                                            #Unused settings URL and history data; Chromium
  swban check/browser/settings/history [dir] --from path --pages paths                          #Settings chains, native tabs and Back; Chromium
  swban check/browser/pwa/panel [dir] --page path --from path [--widths pixels]                 #Update panel display, locale and history; Chromium
  swban check/browser/pwa/offline [dir] [--page path]                                           #Registration, controlled navigation and offline reload; Chromium
  swban check/browser/pwa/check [dir] --next dir [--page path] [--from path]                    #Manual/offline checks and hidden controls; Chromium
  swban check/browser/pwa/lifecycle [dir] --next dir [--page path] [--from path]                #Waiting updates and browser activation after pages close; Chromium
  swban check/browser/pwa/native [dir] --next dir [--page path] [--from path]                   #Links, history, anchors and tabs keep updates waiting; Chromium
  swban check/browser/pwa/content [dir] --next dir [--page path] [--from path]                  #Content versions change without replacing the active SW; Chromium
  swban check/browser/pwa/language [dir] --next dir --to code [--page path]                     #Native language links with a waiting update; Chromium
  swban check/browser/pwa/disable [dir] --next dir [--page path]                                #Disable SW, clean theme state and preserve other data; Chromium
  swban check/browser/nav/tabs [dir] --page path [--selector css]                               #Native new tabs and opener isolation; Chromium
  swban check/browser/nav/roots [dir] --from path --pages paths                                 #Root visits, selection and native history; Chromium
  swban check/browser/img/load [dir] --page path [--selector css]                               #Displayed image loading and decoding; Chromium
  swban check/browser/nav/sort [dir] [--page path]                                              #Name/date sort and source navigation; Chromium
  swban check/browser/nav/anchors [dir] --page path                                             #Native anchors and skip link; Chromium
  swban check/browser/nav/anchors.webkit [dir] --page path                                      #Native anchors and skip link; WebKit
  swban check/browser/nav/keyboard [dir] [--page path]                                          #Column keyboard order; Chromium
  swban check/browser/nav/keyboard.webkit [dir] [--page path]                                   #Column keyboard order; WebKit
  swban check/browser/breadcrumb/sort [dir] --page path [--column path]                         #Column sort, node reuse and prefetch markers; Chromium
  swban check/browser/breadcrumb/isolation [dir] --page path                                    #Independent path and main sorts; Chromium
  swban check/browser/breadcrumb/source [dir] --page path --column path --article path          #Static/runtime source links; Chromium
  swban check/browser/breadcrumb/header [dir] --page path [--column path]                       #Column labels, visible sorts and spacing; Chromium
  swban check/browser/collection/layout [dir] --page path [--article path]                      #Name widths, headers and row alignment; Chromium
  swban check/browser/collection/style [dir] --page path --collection path [--choices path]     #Shared selection, hover and focus; Chromium
  swban check/browser/prose/layout [dir] [--page path]                                          #Links, lists, quotes and table isolation; Chromium
  swban check/browser/prose/layout.webkit [dir] [--page path]                                   #Links, lists, quotes and table isolation; WebKit
  swban check/browser/aside/toggle [dir] --page path [--touch]                                  #Disclosure, focus and reading position; Chromium
  swban check/browser/aside/toggle.webkit [dir] --page path [--touch]                           #Disclosure, focus and reading position; WebKit
  swban check/browser/aside/chapters [dir] --page path                                          #Chapters, fragments and history; Chromium
  swban check/browser/aside/chapters.webkit [dir] --page path                                   #Chapters, fragments and history; WebKit
  swban check/browser/aside/layout [dir] --page path                                            #Aside placement, width and wrapping; Chromium
  swban check/browser/aside/layout.webkit [dir] --page path                                     #Aside placement, width and wrapping; WebKit
  swban check/browser/aside/style [dir] --page path                                             #Aside control styles; Chromium
  swban check/browser/aside/style.webkit [dir] --page path                                      #Aside control styles; WebKit
  swban check/browser/aside/print [dir] --page path                                             #Printed article and metadata; Chromium
  swban check/browser/aside/print.webkit [dir] --page path                                      #Printed article and metadata; WebKit
  swban check/browser/canvas/layout [dir] [--page path] [--height px]                           #Declared widths, gaps and document canvas; Chromium
  swban check/browser/canvas/layout.webkit [dir] [--page path] [--height px]                    #Declared widths, gaps and document canvas; WebKit
  swban check/browser/canvas/touch [dir] --page path --next path                                #Native mobile drags and history; Chromium
  swban check/browser/canvas/scroll [dir] --page path                                           #Document pan and column scrolling; Chromium
  swban check/browser/canvas/scroll.webkit [dir] --page path                                    #Document pan and column scrolling; WebKit
  swban check/browser/canvas/scrollbar [dir] --page path [--touch]                              #Scrollbar activity and resize; Chromium
  swban check/browser/canvas/scrollbar.webkit [dir] --page path [--touch]                       #Scrollbar activity and resize; WebKit
  swban check/browser/canvas/history [dir] --page path --next path                              #Native history and in-place sort; Chromium
  swban check/browser/canvas/history.webkit [dir] --page path --next path                       #Native history and in-place sort; WebKit
  swban check/browser/canvas/open [dir] --from path --page path [--touch] [--drag px]             #Open articles, retain ancestry/sort and history; Chromium
  swban check/browser/canvas/open.webkit [dir] --from path --page path [--touch]                #Open articles, retain ancestry/sort and history; WebKit
  swban check/browser/canvas/first-paint [dir] --page path [--root path|none]                   #Article/collection startup and retained columns; Chromium
  swban check/browser/canvas/first-paint.webkit [dir] --page path [--root path|none]            #Article/collection startup and retained columns; WebKit

Reports (dir: public; top 8 for ranked reports):
  swban report/size/html [dir] [--top N]           #Page and cold-load bytes
  swban report/size/js [dir] [--top N]             #JS bytes and references
  swban report/size/assets [dir]                   #All file counts and bytes
  swban report/payload/breadcrumb [dir] [--top N]  #Breadcrumb payload sizes
  swban report/payload/prefetch [dir] [--top N]    #Prefetch payload sizes

Resource and config sync:
  swban sync/ext [id...]    #Sync external files; default all

EdgeOne config sync (dir: public):
  swban deploy/edgeone/sync [dir]  #Copy generated config to the site root

Hugo examples:
  swban hugo --minify --gc --cleanDestinationDir         #Production build
  swban hugo --minify --destination ./preview            #Build in ./preview
  swban hugo server -D --disableFastRender --port 13241  #Preview; port 13241

Git examples:
  swban git tag v0.1.0 HEAD                                                      #Tag the Skill release
  swban git tag module/v0.1.0 HEAD                                               #Tag the Module at the same commit
  swban git push --atomic --no-follow-tags origin tag v0.1.0 tag module/v0.1.0     #Push the paired tags

GitHub examples:
  swban gh auth login --web                                 #Log in to GitHub
  swban gh auth status                                      #Check login status
  swban gh release create <tag> --verify-tag --notes <URL>  #Link release notes
