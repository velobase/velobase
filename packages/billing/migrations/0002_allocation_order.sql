ALTER TABLE billing_allocations
  ADD COLUMN allocation_order INTEGER;

WITH ranked_allocations AS (
  SELECT
    allocation.id,
    ROW_NUMBER() OVER (
      PARTITION BY allocation.reservation_id
      ORDER BY grant_row.expires_at ASC NULLS LAST, grant_row.created_at ASC, grant_row.id ASC
    ) - 1 AS allocation_order
  FROM billing_allocations allocation
  JOIN billing_grants grant_row ON grant_row.id = allocation.grant_id
)
UPDATE billing_allocations allocation
SET allocation_order = ranked.allocation_order
FROM ranked_allocations ranked
WHERE allocation.id = ranked.id;

ALTER TABLE billing_allocations
  ALTER COLUMN allocation_order SET NOT NULL,
  ADD CONSTRAINT billing_allocations_order_check CHECK (allocation_order >= 0),
  ADD CONSTRAINT billing_allocations_reservation_order_key
    UNIQUE (reservation_id, allocation_order);
