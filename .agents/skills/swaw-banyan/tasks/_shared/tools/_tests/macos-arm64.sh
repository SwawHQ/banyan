#!/bin/sh
set -eu
[ "$(uname -s)" = Darwin ] && [ "$(uname -m)" = arm64 ] || {
  printf 'This test requires native macOS ARM64.\n' >&2
  exit 1
}
# Exclude runner-provided Node and Homebrew tools without changing the host.
PATH=/usr/bin:/bin:/usr/sbin:/sbin
export PATH
skill=.agents/skills/swaw-banyan
[ ! -e "$skill/.tools" ] || { printf 'This test requires a fresh checkout.\n' >&2; exit 1; }
sh swban help/en
[ ! -e "$skill/.tools" ]
sh swban base/node/ensure
node=$skill/.tools/node/bin/node
[ "$("$node" -p process.arch)" = arm64 ]
for tool in git go hugo pagefind bun gh; do
  sh swban "base/$tool/ensure" --force
done
"$node" --input-type=module -e '
  import assert from "node:assert/strict";
  import {inspectBinding} from "./.agents/skills/swaw-banyan/tasks/_shared/tools/selection.mjs";
  for(const name of ["node","git","go","hugo","pagefind","bun","gh"]) {
    const binding=await inspectBinding(name);
    assert.equal(binding.source,"managed",name);
  }
'
"$node" --test "$skill"/tasks/_shared/tools/_tests/linux*.test.mjs \
  "$skill"/tasks/_shared/tools/_tests/mac.test.mjs \
  "$skill"/tasks/help/_tests/help.test.mjs
sh swban base/node/ensure --force
sh swban base/node/npm --version
sh swban base/packages/ensure
sh swban doctor
output=${RUNNER_TEMP:?}/banyan-macos-arm64-output
sh swban build --destination "$output"
sh swban build --destination "$output"
sh swban check/csp "$output"
sh swban check/delivery "$output"
