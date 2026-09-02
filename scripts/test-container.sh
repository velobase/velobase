#!/bin/sh

set -eu

compose_project="velobase-smoke-$$"
host_port="${VELOBASE_SMOKE_PORT:-30101}"

run_compose() {
  VELOBASE_IMAGE="velobase:dev" VELOBASE_PORT="$host_port" docker compose \
    -p "$compose_project" \
    -f compose.yaml \
    "$@"
}

build_source() {
  VELOBASE_PORT="$host_port" docker compose \
    -p "$compose_project" \
    -f compose.yaml \
    -f compose.dev.yaml \
    build api
}

cleanup() {
  run_compose down --volumes --remove-orphans >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM

cleanup

base_config=$(VELOBASE_IMAGE="velobase:dev" VELOBASE_PORT="$host_port" docker compose -p "$compose_project" -f compose.yaml config --format json)
node -e '
  const config = JSON.parse(process.argv[1]);
  const apiPort = config.services.api.ports && config.services.api.ports[0];
  if (!apiPort || apiPort.host_ip !== "127.0.0.1") process.exit(1);
  if (config.services.postgres.ports) process.exit(1);
  if (config.services.api.depends_on.migrate.condition !== "service_completed_successfully") process.exit(1);
' "$base_config"

build_source
run_compose up --detach --wait

migration_logs=$(run_compose logs --no-color migrate)
echo "$migration_logs" | grep -q "applied: 0001_initial.sql"
echo "$migration_logs" | grep -q "applied: 0002_allocation_order.sql"

health_response=$(curl --fail --silent --show-error "http://127.0.0.1:$host_port/health")
node -e 'const body = JSON.parse(process.argv[1]); if (body.status !== "ok") process.exit(1)' "$health_response"

demo_response=$(curl --fail --silent --show-error --request POST "http://127.0.0.1:$host_port/v1/demo/ai-video")
customer_id=$(node -e 'const body = JSON.parse(process.argv[1]); if (body.balance.available !== 33) process.exit(1); process.stdout.write(body.customerId)' "$demo_response")

container_uid=$(run_compose exec -T api id -u)
test "$container_uid" != "0"
if run_compose exec -T api touch /app/read-only-check >/dev/null 2>&1; then
  echo "container root filesystem is writable" >&2
  exit 1
fi

run_compose restart api
run_compose up --detach --wait api

balance_response=$(curl --fail --silent --show-error "http://127.0.0.1:$host_port/v1/balances/$customer_id?wallet=video")
node -e 'const body = JSON.parse(process.argv[1]); if (body.total !== 100 || body.used !== 67 || body.available !== 33) process.exit(1)' "$balance_response"

migration_output=$(run_compose run --rm migrate)
echo "$migration_output" | grep -q "already applied: 0001_initial.sql"
echo "$migration_output" | grep -q "already applied: 0002_allocation_order.sql"

echo "container smoke test passed"
