# shellcheck shell=sh
[ "$(uname -s)" = Linux ] && [ "$(uname -m)" = x86_64 ] || fail supported_bootstrap_platform_is_linux_x64
# Used by the shared bootstrap that sources this module.
# shellcheck disable=SC2034
architecture=x64
for utility in awk readlink timeout sha256sum; do command -v "$utility" >/dev/null || fail "missing_bootstrap_tool:$utility"; done
checksum() { sha256sum "$1"; }
node_version() { timeout 5 "$1" --version; }
