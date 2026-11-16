# shellcheck shell=sh
# The sourced platform module supplies architecture to the shared bootstrap.
# shellcheck disable=SC2034
[ "$(uname -s)" = Darwin ] || fail supported_bootstrap_platform_is_mac
case "$(uname -m)" in
  x86_64) architecture=x64;;
  arm64) architecture=arm64;;
  *) fail supported_mac_architectures_are_x64_and_arm64;;
esac
for utility in awk readlink shasum sleep; do command -v "$utility" >/dev/null || fail "missing_bootstrap_tool:$utility"; done
checksum() { shasum -a 256 "$1"; }
# macOS has no timeout command; keep the version probe bounded without installing one.
node_identity() (
  "$1" -p 'process.version + " " + process.arch' &
  probe=$!
  (sleep 5; kill -KILL "$probe" 2>/dev/null || :) >/dev/null 2>&1 &
  watchdog=$!
  trap 'kill "$watchdog" 2>/dev/null || :' EXIT
  wait "$probe"
)
node_version() {
  identity=$(node_identity "$1") || return 1
  [ "${identity##* }" = "$architecture" ] || return 1
  printf '%s\n' "${identity% *}"
}
