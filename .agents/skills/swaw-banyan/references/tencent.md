# Tencent Cloud tools

Run tccli for Tencent Cloud APIs, including EdgeOne's `teo` commands.
The entry prepares uv, managed Python 3.13 and the pinned tccli package as needed.

```text
swban deploy/tencent/cli --version       #Show the tccli version
swban deploy/tencent/cli teo help        #Show EdgeOne commands
swban deploy/tencent/cli/check           #Check the local installation
swban deploy/tencent/cli/ensure          #Prepare tccli before offline use
swban deploy/tencent/cli/ensure --force  #Reinstall the pinned tccli version
```

Use `swban help/en deploy/tencent/cli` for Skill help without preparing tools.
Arguments, streams, exit codes and the caller's working directory are preserved.
Native help runs tccli and can prepare its dependencies.
`check` reads local files and version metadata; it does not install, run tccli,
contact Tencent Cloud or check cloud permissions.

The version is pinned in `tasks/deploy/tencent/cli/requirements.txt`.
uv installs its isolated environment under `.tools/python-tools/tccli/`.
Managed Python and package caches use the same Skill-owned locations as
[Python tools](python.md). The entry does not modify the saved system PATH.

## Authorization on Windows

```text
swban deploy/auth/setup                   #Open the shared authorization page
swban deploy/tencent/auth/setup           #Open the page with Tencent Cloud selected
swban deploy/tencent/auth/key/check       #Check the saved access key without showing it
```

The page provides sign-in, access-key and read-only environment tabs. Opening
the sign-in tab prepares tccli in the background and shows preparation status.
Once ready, the sign-in button opens its native browser flow for the default profile.
This flow has no separate product-permission selector. Access follows the signed-in
identity's CAM permissions. For limited access, sign in as a CAM sub-user granted
only the required permissions.
tccli saves and refreshes sign-in credentials in its per-user `~/.tccli/`
directory. These credentials are not stored in Windows Credential Manager.
Banyan requires TLS certificate verification for sign-in and credential refresh.

The access-key form accepts a long-term SecretId and SecretKey. It verifies
identity with STS `GetCallerIdentity`, then saves to the fixed Windows generic
credential `swban/tencent/default`. This check does not test EdgeOne permissions.
Long-term access keys inherit their owner's CAM permissions; they have no
separate product-permission selection. For limited access, use keys from a
CAM sub-user granted only the required permissions and resources.
To add the credential yourself in Windows Credential Manager, use SecretId as
the user name and SecretKey as the password. No registration file is required.
Remove it there when no longer needed; revoke the key in Tencent Cloud to
invalidate it. Temporary STS credentials remain available through native
parameters or environment variables; the form does not save them.

Ordinary default-profile commands prefer a complete pair of environment keys,
then the saved Windows access key, then native tccli credentials. Explicit
credential arguments, `--profile`, `TCCLI_PROFILE`, role and OIDC selections keep
tccli's native rules. A partial environment key pair stops the command, without
loading a different identity. Saved keys enter only the child environment as
`TENCENTCLOUD_SECRET_ID` and `TENCENTCLOUD_SECRET_KEY`; they are not written to
tccli's credential file or passed as command arguments.

The environment tab shows only whether variables are set. It does not return
SecretId, SecretKey, Token or profile values to the browser. `key/check` checks
local presence only; it does not prepare tools or contact Tencent Cloud.

Native authorization remains available:

```text
swban deploy/tencent/cli auth login   #Authorize tccli in the browser
swban deploy/tencent/cli auth logout  #Sign out of tccli
```

Configuration uses tccli's native per-user `~/.tccli/` directory. Set the region
and other native options as needed; tool preparation does not choose a region.
Runtime isolation does not isolate native cloud credentials.

References: [tccli](https://github.com/TencentCloud/tencentcloud-cli),
[browser authorization](https://cloud.tencent.com/document/product/440/111345).
