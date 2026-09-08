#!/usr/bin/env node

import crypto from "node:crypto";
import process from "node:process";
import { Pool } from "pg";

const targetUrl = process.env.LEMON_SQUEEZY_TEST_URL || "http://localhost:3000";
const webhookSecret = process.env.LEMON_SQUEEZY_WEBHOOK_SECRET || "dev_secret_key_12345";

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error("❌ DATABASE_URL environment variable is missing.");
  process.exit(1);
}

const pool = new Pool({ connectionString: dbUrl });

async function run() {
  console.log("🍋 SentinelOps Lemon Squeezy Webhook Simulator");
  console.log(`Target Gateway: ${targetUrl}/api/v1/billing/lemonsqueezy/webhook\n`);

  // Find an organization in the database
  const orgResult = await pool.query(
    "select id, name, plan_code from organizations order by created_at desc limit 1",
  );
  if (orgResult.rows.length === 0) {
    console.error("❌ No organization found in local database. Run `pnpm db:seed` first.");
    await pool.end();
    process.exit(1);
  }

  const org = orgResult.rows[0];
  console.log(`Found Target Organization: ${org.name} (${org.id})`);
  console.log(`Current Plan in DB:        ${org.plan_code}\n`);

  // Construct realistic Lemon Squeezy payload
  const payload = {
    meta: {
      event_name: "subscription_created",
      custom_data: {
        organization_id: org.id,
        plan_code: "pro",
        billing_interval: "year",
      },
    },
    data: {
      id: "sub_ls_98421",
      type: "subscriptions",
      attributes: {
        store_id: 12345,
        customer_id: 67890,
        order_id: 112233,
        product_name: "SentinelOps Team Pro",
        variant_name: "Annual Subscription",
        status: "active",
        renews_at: new Date(Date.now() + 365 * 86400000).toISOString(),
        card_brand: "mastercard",
        card_last_four: "5555",
      },
    },
  };

  const rawBody = JSON.stringify(payload);
  const signature = crypto
    .createHmac("sha256", webhookSecret)
    .update(rawBody)
    .digest("hex");

  console.log("▶ Sending signed `subscription_created` webhook to SentinelOps...");

  try {
    const res = await fetch(`${targetUrl}/api/v1/billing/lemonsqueezy/webhook`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Signature": signature,
      },
      body: rawBody,
    });

    const responseBody = await res.json().catch(() => ({}));

    if (!res.ok) {
      console.error(`❌ Webhook dispatch failed (${res.status}):`, responseBody);
      await pool.end();
      process.exit(1);
    }

    console.log("✓ Webhook delivered successfully!");
    console.log("Response:", responseBody);

    // Verify DB update
    const verifyResult = await pool.query(
      "select plan_code, audit_retention_days from organizations where id = $1",
      [org.id],
    );
    const updated = verifyResult.rows[0];
    console.log("\n📊 Verification in PostgreSQL Database:");
    console.log(`   Organization Plan: ${updated.plan_code} (Expected: pro)`);
    console.log(`   Audit Retention:   ${updated.audit_retention_days} days (Expected: 365 days)`);

    if (updated.plan_code === "pro") {
      console.log("\n🎉 SUCCESS: Lemon Squeezy webhook end-to-end integration verified!");
    } else {
      console.warn("\n⚠️ Warning: Plan did not update to 'pro'.");
    }
  } catch (err) {
    console.error("❌ Connection error:", err.message);
  } finally {
    await pool.end();
  }
}

run();
