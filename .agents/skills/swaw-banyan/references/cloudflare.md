# Cloudflare tools

Run cf for Cloudflare resource management and Wrangler for Workers and Pages
commands. Each entry prepares its pinned CLI package as needed.

```text
swban deploy/cloudflare/cli --version            #Show the cf version
swban deploy/cloudflare/wrangler --version       #Show the Wrangler version
swban deploy/cloudflare/cli/check                #Check the local cf installation
swban deploy/cloudflare/wrangler/check           #Check the local Wrangler installation
swban deploy/cloudflare/cli/ensure               #Prepare cf before offline use
swban deploy/cloudflare/wrangler/ensure          #Prepare Wrangler before offline use
```

The packages use the Skill's Node/npm. Each CLI keeps its `package.json`,
`package-lock.json` and ignored `node_modules/` in
`tasks/deploy/cloudflare/cli/` or `tasks/deploy/cloudflare/wrangler/`.
`ensure --force` reinstalls the locked packages. `check` inspects local packages
and their version; it does not sign in or contact Cloudflare.

Use `swban help/en deploy/cloudflare` for Skill help without preparing tools.
The CLI entries forward arguments, streams and exit codes. Their `--help` runs
the native CLI. `swban` itself keeps the caller's working directory.

CLI child processes start in fixed directories under the system temporary
directory: `%TEMP%/swaw/banyan/cf/` for cf and
`%TEMP%/swaw/banyan/wrangler/` for Wrangler. These directories and their caches
remain available for later commands. On first use, Wrangler gets a
`package.json` with `{"private":true}` and an empty `.env`. cf gets a
`package.json` with `{"private":true,"type":"module"}`, a
`cloudflare.config.ts` with `export default {};`, and an empty `.env`.
The fixed directories keep the caller's project and `.env` out of default lookup.
Wrangler's `package.json` fixes its project root for temporary files. Native
Wrangler configuration lookup can still search ancestors of the fixed directory;
keep those temporary parent directories free of project configuration.

Native arguments stay unchanged. Relative file and directory paths use the
CLI's fixed directory, so use absolute paths unless you intend to use that
directory. For Workers, project configuration or Pages Functions, pass Wrangler's
native `--cwd <project-path>` with an absolute project path. cf resource-management
commands use its empty configuration; `cf dev` and `cf build` need an actual
project configuration.

## Authorization page on Windows

```text
swban deploy/auth/setup                          #Open the shared authorization manager
swban deploy/cloudflare/auth/setup               #Open the local authorization page
swban deploy/cloudflare/auth/setup --no-browser  #Print the URL to open yourself
swban deploy/cloudflare/auth/token/check         #Check the saved credential without showing it
```

The platform entry opens the shared page with Cloudflare selected. Platform
tabs select Cloudflare or Tencent Cloud. Method tabs show sign-in, API Token
and read-only environment status, in that order.
Opening a platform's sign-in tab prepares its tools in the background, then
checks native cf and Wrangler sign-in or tccli credential usability. tccli uses
a native STS identity query; it does not distinguish stored sign-in from access
keys or check product permissions. An unavailable check does not mean signed out.
Failed preparation can be retried; API Token setup remains available during
downloads and checks. Sign-in buttons show progress and open native browser authorization;
cf and Wrangler need separate approvals. Each CLI manages its own configuration,
credential storage and refresh. Existing native sign-in can be reused when its
format and selected profile are compatible with the pinned CLI version.
The environment tab shows only variable presence and a valid account ID, never
Token, key or email contents. It inspects the current process, not project `.env` files.
The page stays open until Close or the process stops. Closing stops preparation,
checks and login. Each CLI controls its own authorization timeout.
Page sign-in and status checks exclude environment API credentials, Banyan's
Windows API credentials and project `.env` files;
native user configuration and credential directories stay unchanged.
cf and Wrangler sign-in and status checks use their fixed working directories.

Sign in to Cloudflare first, complete any verification, then return to the local
page and open the recommended Account Token creation link. The footer also links
to User Tokens, which can leave Account ID empty. Select the permissions
and resources needed for your commands, then paste the Token into the local
page. An account-owned Token also needs its account ID. The page verifies the
Token before saving it. Verification checks validity, not every operation's
permissions. Saving clears the input and keeps the page available for other setup.

Pages publication needs Account > Cloudflare Pages > Edit in a custom Token.
Add DNS or other permissions only for the operations you need.
The page reads icons only from the current site's `assets/site/`. It prefers
`favicon.link.svg`, then `favicon.link.ico`, then `favicon.ico` for its logo and
browser icon. Without these files, it shows no logo.
Page text and links are in `tasks/deploy/auth/page.json` beside `page.html`. The page
starts with the same system-language rule as help: Chinese for `zh-*`, English
otherwise. The title bar switches between Chinese and English without clearing
inputs or restarting preparation. The selection is not saved; reloading uses
the system language again.

The fixed Windows generic credential is `swban/cloudflare/default`. You can
also add or edit it in Windows Credential Manager: use the API Token as the
password, and the account ID or `api-token` as the user name. No separate
registration file is required. Remove the local credential there when no
longer needed; revoke the Token in Cloudflare to invalidate it.

cf and Wrangler read this credential on ordinary commands. The Token enters
only the CLI child's environment as `CLOUDFLARE_API_TOKEN`; an account ID stored
as the user name supplies `CLOUDFLARE_ACCOUNT_ID` when not already set.
Ordinary commands prefer explicit environment credentials, then the saved API
Token, then native sign-in. Switching tabs does not change this order.
Ordinary commands and the read-only page recognize native `CF_API_TOKEN`,
`CF_API_KEY`, `CF_EMAIL` and `CF_ACCOUNT_ID` aliases. A present `CLOUDFLARE_*`
variable takes priority over its alias, including an empty value.
A credential failure does not retry with another source.
Explicit environment credentials, `--profile` and native sign-in commands keep
their own credential selection. Help and local installation checks do not
read the Token. `auth/token/check` checks only the local credential's presence,
without contacting Cloudflare or preparing packages.

## Sign in

cf and Wrangler use separate OAuth credentials. Sign in to each tool you use:

```text
swban deploy/cloudflare/cli auth login                #Authorize cf in the browser
swban deploy/cloudflare/cli auth whoami               #Show the cf identity
swban deploy/cloudflare/wrangler login                #Authorize Wrangler in the browser
swban deploy/cloudflare/wrangler whoami               #Show the Wrangler identity and credential storage
```

The entries preserve `HOME`, `USERPROFILE`, AppData, XDG and native data-directory
settings. Sign-in, sign-out and storage preferences share each CLI's native
state with system installations. Banyan does not move or parse OAuth credentials,
force encryption, or maintain a separate sign-in directory. Use the native CLI
options to select a profile or enable its keyring storage.
The page's sign-in actions omit API credentials for that process so the CLI can
start OAuth; existing storage and profile settings remain available.
Both groups include the Windows keyring binding and set a child-only npm prefix
so the CLI can find it when native keyring storage is selected. The Skill does
not sign in automatically or load a custom secrets file.

To change Wrangler permissions, inspect `login --scopes-list`, then sign in
with `login --scopes <scopes...>`. For automation, pass a restricted
`CLOUDFLARE_API_TOKEN` through the process environment. Set
`CLOUDFLARE_ACCOUNT_ID` when the command needs an account.

## Run native commands

```text
swban deploy/cloudflare/cli zones list                        #List accessible zones
swban deploy/cloudflare/cli dns records list --zone <domain>  #List a zone's DNS records
swban deploy/cloudflare/wrangler pages project list           #List Pages projects
```

These entries also accept native login, configuration and resource-management
arguments.

## Publish a static build

Build the site, then upload the static output with native Wrangler:

```text
swban deploy/cloudflare/wrangler pages deploy <build-path> --project-name <name> --branch preview  #Publish a preview
```

Use an absolute path for `<build-path>`. A branch matching the Pages project's
production branch updates production; other branches create preview deployments.
The entry prepares Wrangler as needed and keeps the normal credential priority.

References: [cf installation and authentication](https://developers.cloudflare.com/cf/get-started/),
[Wrangler login and credential storage](https://developers.cloudflare.com/workers/wrangler/commands/general/),
[Wrangler Pages commands](https://developers.cloudflare.com/workers/wrangler/commands/pages/).
