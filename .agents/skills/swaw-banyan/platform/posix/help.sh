#!/bin/sh
set -eu
language=$1 tasks=$2
shift 2
export SWBAN_HELP_LANGUAGE="$language" SWBAN_TASKS_ROOT="$tasks"
export SWBAN_HELP_COUNT="$#" SWBAN_HELP_QUERY="${1-}" SWBAN_HELP_DEPTH="${2-}"
LC_ALL=C; export LC_ALL
inventory=$(find "$tasks" -type d -name node_modules -prune -o -type d -exec printf 'd\t%s\n' {} + -o -type f -exec printf 'f\t%s\n' {} +)
printf '%s\n' "$inventory" | awk -f "$(dirname -- "$0")/help.awk"
