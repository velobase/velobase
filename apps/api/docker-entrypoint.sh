#!/bin/sh

set -eu

case "${1:-server}" in
  server)
    exec node /app/apps/api/dist/server.js
    ;;
  migrate)
    exec node /app/apps/api/node_modules/@velobase/billing/dist/cli.js migrate
    ;;
  *)
    exec "$@"
    ;;
esac
