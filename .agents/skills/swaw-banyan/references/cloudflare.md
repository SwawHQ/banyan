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
the native CLI. Relative paths use the caller's working directory.

## Authorization page on Windows

```text
swban deploy/auth/setup                          #Open the shared cloud authorization page
swban deploy/cloudflare/auth/setup               #Open the local authorization page
swban deploy/cloudflare/auth/setup --no-browser  #Print the URL to open yourself
swban deploy/cloudflare/auth/token/check         #Check the saved credential without showing it
```

The platform entry opens the shared page with Cloudflare selected. Platform
tabs select Cloudflare or Tencent Cloud. Method tabs show sign-in, API Token
and read-only environment status, in that order.
Opening a platform's sign-in tab prepares its tools in the background and shows
preparation status. Failed preparation can be retried; API Token setup remains
available during downloads. Sign-in buttons open native browser authorization;
cf and Wrangler need separate approvals. Both save OAuth credentials in encrypted
files with keys in Windows Credential Manager.
The environment tab shows only variable presence and a valid account ID, never
Token, key or email contents. It inspects the current process, not project `.env` files.
The page stays open until Close or ten minutes; closing stops preparation and login.

Sign in to Cloudflare first, complete any verification, then return to the local
page and open the recommended Account Token creation link. The footer also links
to User Tokens, which can leave Account ID empty. Select the permissions
and resources needed for your commands, then paste the Token into the local
page. An account-owned Token also needs its account ID. The page verifies the
Token before saving it. Verification checks validity, not every operation's
permissions. Saving clears the input and keeps the page available for other setup.

Pages publication needs Account > Cloudflare Pages > Edit in a custom Token.
Add DNS or other permissions only for the operations you need.
The page uses the site's `static/favicon.svg` or `static/favicon.ico` as its logo
and browser icon, then falls back to local `module/static/` and the paired
repository's Module icons.
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
swban deploy/cloudflare/wrangler login --use-keyring  #Authorize Wrangler with OS credential protection
swban deploy/cloudflare/wrangler whoami               #Show the Wrangler identity and credential storage
```

Credentials stay in the native per-user locations, outside the Skill package
directories. Banyan's cf entry requires keyring storage for sign-in and later
commands; an unavailable keyring stops the command instead of writing plaintext.
On Windows, cf's default location is
`%APPDATA%/xdg.config/cloudflare/config/default.enc`, unless XDG settings change
the configuration root. Without keyring storage, native cf uses `default.json`
in the same directory and stores tokens in plaintext.
The authorization page enables Wrangler's `--use-keyring` mode. Both groups pin
the Windows native binding and use a child-only npm prefix so each tool can find
it without a global install or terminal prompt. The Skill does not sign in
automatically or load a custom secrets file.

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
arguments. No Skill Pages publication workflow is provided yet.

References: [cf installation and authentication](https://developers.cloudflare.com/cf/get-started/),
[Wrangler login and credential storage](https://developers.cloudflare.com/workers/wrangler/commands/general/),
[Wrangler Pages commands](https://developers.cloudflare.com/workers/wrangler/commands/pages/).
