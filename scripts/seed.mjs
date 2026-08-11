import { createHash, randomBytes } from "node:crypto";
import process from "node:process";
import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is required.");
}

const pool = new Pool({
  connectionString,
  max: 2,
  ssl:
    process.env.DB_SSL === "true" || process.env.DB_SSL === "1"
      ? {
          rejectUnauthorized:
            process.env.DB_SSL_REJECT_UNAUTHORIZED !== "false",
        }
      : undefined,
});

const policies = [
  {
    name: "Block exports to unapproved destinations",
    description:
      "Blocks bulk exports when the target destination is not approved.",
    priority: 10,
    effect: "block",
    conditions: {
      all: [
        { field: "action", operator: "eq", value: "data.export" },
        { field: "context.destinationApproved", operator: "eq", value: false },
      ],
    },
  },
  {
    name: "Production changes require approval",
    description:
      "Requires a platform owner to approve production deployments and releases.",
    priority: 20,
    effect: "approval",
    conditions: {
      all: [
        { field: "environment", operator: "eq", value: "production" },
        {
          field: "action",
          operator: "in",
          value: ["deploy.release", "github.release.create"],
        },
      ],
    },
  },
  {
    name: "Large financial exports require approval",
    description:
      "Routes financial exports of at least 1,000 records to a human reviewer.",
    priority: 30,
    effect: "approval",
    conditions: {
      all: [
        { field: "action", operator: "eq", value: "data.export" },
        { field: "context.recordCount", operator: "gte", value: 1000 },
      ],
    },
  },
];

async function seed() {
  const client = await pool.connect();
  const apiKey = `sop_live_${randomBytes(24).toString("base64url")}`;
  const keyHash = createHash("sha256").update(apiKey).digest("hex");

  try {
    await client.query("begin");
    const organizationResult = await client.query(
      `
        insert into organizations (name, slug)
        values ('Aperture Labs', 'aperture-labs')
        on conflict (slug) do update set name = excluded.name
        returning id
      `,
    );
    const organizationId = organizationResult.rows[0].id;

    for (const policy of policies) {
      const policyResult = await client.query(
        `
          insert into policies (
            organization_id, name, description, priority, effect, conditions
          )
          values ($1, $2, $3, $4, $5, $6::jsonb)
          on conflict (organization_id, name) do update
          set description = excluded.description,
              priority = excluded.priority,
              effect = excluded.effect,
              conditions = excluded.conditions,
              updated_at = now()
          returning id, organization_id, enabled, name, description,
                    priority, effect, conditions
        `,
        [
          organizationId,
          policy.name,
          policy.description,
          policy.priority,
          policy.effect,
          JSON.stringify(policy.conditions),
        ],
      );
      const policyRow = policyResult.rows[0];
      const versionResult = await client.query(
        `
          insert into policy_versions (
            organization_id,
            policy_id,
            version_number,
            name,
            description,
            priority,
            effect,
            conditions,
            change_type,
            created_by_email
          )
          select $1, $2, 1, $3, $4, $5, $6, $7::jsonb, 'created',
                 'seed@sentinelops.system'
          where not exists (
            select 1 from policy_versions where policy_id = $2
          )
          returning id
        `,
        [
          organizationId,
          policyRow.id,
          policy.name,
          policy.description,
          policy.priority,
          policy.effect,
          JSON.stringify(policy.conditions),
        ],
      );
      if (versionResult.rows[0] && policyRow.enabled) {
        await client.query(
          `
            update policies
            set active_version_id = $2
            where id = $1 and active_version_id is null
          `,
          [policyRow.id, versionResult.rows[0].id],
        );
      }
    }

    await client.query(
      `
        insert into api_keys (
          organization_id, name, key_prefix, key_hash, expires_at
        )
        values ($1, 'Local agent SDK', $2, $3, now() + interval '90 days')
      `,
      [organizationId, apiKey.slice(0, 16), keyHash],
    );

    await client.query("commit");
    console.log("Seeded Aperture Labs.");
    console.log(`Agent API key (shown once): ${apiKey}`);
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

try {
  await seed();
} finally {
  await pool.end();
}
