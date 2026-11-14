#!/bin/sh
set -eu
echo BANYAN_PLATFORM_BUILD_START
hugo version
hugo --minify --gc --cleanDestinationDir --baseURL / 
node scripts/edgeone-config-probe.cjs
echo BANYAN_PLATFORM_BUILD_END
