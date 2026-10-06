#!/usr/bin/env sh
set -eu

SITE_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)

cd "$SITE_DIR"

npm run dev
