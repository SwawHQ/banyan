#!/bin/sh
set -efu
root=$(CDPATH='' cd -- "$(dirname -- "$0")/../.." && pwd -P)
platform=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd -P)
fail() { printf '[swban] %s\n' "$*" >&2; exit 1; }
plain() {
  current=$1
  while [ "$current" != / ]; do
    [ ! -L "$current" ] || return 1
    current=${current%/*}; [ -n "$current" ] || current=/
  done
}
command=${1:-help}
case "$command" in -h|--help) command=help;; esac
case "${LC_ALL:-${LC_MESSAGES:-${LANG:-en}}}" in zh|zh_*|zh-*) language=zh;; *) language=en;; esac
case "$command" in
  help|help/en|help/zh)
    case "$command" in help/en) language=en;; help/zh) language=zh;; esac
    [ "$#" -eq 0 ] || shift
    if [ "$#" -eq 1 ]; then case "$1" in -h|--help) set -- "$command";; esac; fi
    exec sh "$root/platform/posix/help.sh" "$language" "$root/tasks" "$@";;
esac
printf '%s\n' "$command" | awk -F/ '{for(i=1;i<=NF;i++)if($i!~/^[a-z_][a-z0-9_-]*(\.[a-z_][a-z0-9_-]*)*$/)exit 1}' || fail "unknown_command:$command; run swban help"
if [ ! -f "$root/tasks/$command/entry.mjs" ] || ! plain "$root/tasks/$command/entry.mjs"; then
  fail "unknown_command:$command; run swban help"
fi
native=false
case "$command" in base/bun|base/node|base/hugo|base/go|base/git|base/gh|base/pagefind|base/node/npm|base/node/npx) native=true;; esac
if [ "$native" = false ] && [ "$#" -eq 2 ]; then
  case "$2" in -h|--help) exec sh "$root/platform/posix/help.sh" "$language" "$root/tasks" "$command";; esac
fi
force=false
case "$command" in
  base/bun/ensure|base/node/ensure|base/hugo/ensure|base/go/ensure|base/git/ensure|base/gh/ensure|base/pagefind/ensure)
    [ "$#" -le 2 ] || fail invalid_ensure_arguments
    if [ "$#" -eq 2 ]; then [ "$2" = --force ] || fail invalid_ensure_arguments; force=true; fi;;
esac
# Each platform module sets architecture and supplies the checksum/version functions.
architecture=
# shellcheck source=/dev/null
. "$platform/system.sh"
{
  IFS= read -r schema; IFS= read -r version; IFS= read -r url; IFS= read -r hash
  IFS= read -r prefix; IFS= read -r executable; IFS= read -r minimum; IFS= read -r exact; IFS= read -r before
} < "$platform/node-$architecture.txt"
[ "$schema" = swaw-banyan.bootstrap-release/v1 ] && [ "$executable" = bin/node ] || fail invalid_node_definition
compatible() {
  awk -v actual="$1" -v minimum="$minimum" -v exact="$exact" -v before="$before" '
    function compare(a,b,x,y,i){split(a,x,".");split(b,y,".");for(i=1;i<=3;i++)if(x[i]+0!=y[i]+0)return x[i]+0<y[i]+0?-1:1;return 0}
    BEGIN {if(actual!~/^v[0-9]+\.[0-9]+\.[0-9]+$/)exit 1;sub(/^v/,"",actual);
      exit (minimum!=""&&compare(actual,minimum)<0||exact!=""&&compare(actual,exact)!=0||before!=""&&compare(actual,before)>=0)}'
}
find_node() {
  candidate=$1
  case "$candidate" in /*) ;; *) return 1;; esac
  [ -f "$candidate" ] && [ -x "$candidate" ] || return 1
  input=$candidate
  candidate=$(readlink -f -- "$candidate") || return 1
  managed=false
  case "$input" in "$root/.tools/node/"*) managed=true;; esac
  case "$candidate" in "$root/.tools/node/"*) managed=true;; esac
  if [ "$managed" = true ]; then
    [ "$force" != true ] || [ "$command" != base/node/ensure ] || return 1
    plain "$input" && plain "$root/.tools/node/install.json" && plain "$root/.tools/node-receipt.txt" && plain "$candidate" || return 1
    [ -f "$root/.tools/node/install.json" ] && [ -f "$root/.tools/node-receipt.txt" ] || return 1
    { IFS= read -r managed_schema; IFS= read -r managed_version; IFS= read -r managed_hash; IFS= read -r receipt_hash; } < "$root/.tools/node-receipt.txt" || return 1
    [ "$managed_schema" = swaw-banyan.bootstrap-node/v1 ] || return 1
    digest=$(checksum "$candidate") || return 1
    [ "${digest%% *}" = "$managed_hash" ] || return 1
    digest=$(checksum "$root/.tools/node/install.json") || return 1
    [ "${digest%% *}" = "$receipt_hash" ] || return 1
  fi
  found_version=$(node_version "$candidate" 2>/dev/null) || return 1
  compatible "$found_version" || return 1
  [ "$managed" != true ] || [ "$found_version" = "v$managed_version" ] || return 1
  node=$candidate
}
node=
binding=$root/.tools/bootstrap-node.txt
if [ -f "$binding" ] && plain "$binding"; then
  { IFS= read -r bound_schema; IFS= read -r bound_source; IFS= read -r bound_path; } < "$binding" || fail invalid_bootstrap_binding
  [ "$bound_schema" = swaw-banyan.bootstrap-binding/v1 ] || fail invalid_bootstrap_binding
  case "$bound_source" in managed) [ "$bound_path" = node/bin/node ] || fail invalid_bootstrap_binding; bound_path=$root/.tools/$bound_path;; path) ;; *) fail invalid_bootstrap_binding;; esac
  find_node "$bound_path" || :
fi
if [ -z "$node" ]; then find_node "$root/.tools/node/bin/node" || :; fi
if [ -z "$node" ]; then
  saved_ifs=$IFS; IFS=:
  for directory in ${PATH:-}; do
    IFS=$saved_ifs
    case "$directory" in /*) find_node "$directory/node" && break;; esac
    IFS=:
  done
  IFS=$saved_ifs
fi
if [ -n "$node" ]; then exec "$node" "$root/tasks/_cli/main.mjs" "$@"; fi
case "$command" in doctor|base/*/check) fail 'runtime_not_ready; run swban base/node/ensure';; esac
for utility in curl tar mktemp; do command -v "$utility" >/dev/null || fail "missing_bootstrap_tool:$utility"; done
case "$url" in https://*) ;; *) fail https_required;; esac
printf '%s\n' "$hash" | awk 'length($0)!=64||$0!~/^[a-f0-9]+$/{exit 1}' || fail invalid_node_definition
case "$prefix" in ''|*[!A-Za-z0-9._-]*) fail invalid_node_definition;; esac
plain "$root/.tools/.cache" || fail linked_bootstrap_path
mkdir -p "$root/.tools/.cache"
temporary=$(mktemp -d "$root/.tools/.cache/bootstrap-XXXXXXXX")
cleanup() { rm -f -- "$temporary/node" "$temporary/download.tar.gz"; rmdir -- "$temporary"; }
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
printf 'Banyan bootstrap: Node %s\n' "$version" >&2
curl --fail --silent --show-error --location --proto '=https' --proto-redir '=https' --max-redirs 5 --connect-timeout 30 --max-time 120 --max-filesize 268435456 --output "$temporary/download.tar.gz" "$url"
digest=$(checksum "$temporary/download.tar.gz")
[ "${digest%% *}" = "$hash" ] || fail download_hash_mismatch
# Only the exact Node member is written; no archive paths are extracted to disk.
tar -xzOf "$temporary/download.tar.gz" "$prefix/bin/node" > "$temporary/node"
chmod 755 "$temporary/node"
"$temporary/node" "$root/tasks/_cli/bootstrap-node.mjs" "$temporary/download.tar.gz" "$@" &
child=$!
trap 'kill -INT "$child" 2>/dev/null || :; wait "$child" || :; exit 130' INT
trap 'kill -TERM "$child" 2>/dev/null || :; wait "$child" || :; exit 143' TERM
wait "$child"
