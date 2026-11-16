#!/bin/sh
# The runtime path is resolved from this entry; the shared script is checked separately.
# shellcheck source=/dev/null
. "$(CDPATH='' cd -- "$(dirname -- "$0")/../posix" && pwd)/bootstrap.sh"
