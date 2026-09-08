#!/usr/bin/env node

import crypto from "node:crypto";
import process from "node:process";
import { Pool } from "pg";

const targetUrl = process.env.DODO_PAYMENTS_TEST_URL || "http://localhost:3000";
const webhookSecret = process.env.DODO_PAYMENTS_WEBHOOK_SECRET || "whsec_dodo_dev_secret_key_12345";

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error("❌ DATABASE_URL environment variable is missing.");
  process.exit(1);
}

const pool = new Pool({ connectionString: dbUrl });

async function run() {
  console.log("🦤 SentinelOps Dodo Payments Webhook Simulator");
  console.log(`Target Gateway: ${targetUrl}/api/v1/billing/dodopayments/webhook\n`);

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

  // Construct realistic Dodo Payments payload
  const payload = {
    type: "subscription.active",
    data: {
      subscription_id: "sub_dodo_987654",
      payment_id: "pay_dodo_112233",
      customer_id: "cus_dodo_445566",
      product_id: "pdt_pro_annual",
      status: "active",
      next_billing_date: new Date(Date.now() + 365 * 86400000).toISOString(),
      metadata: {
        organization_id: org.id,
        plan_code: "pro",
        billing_interval: "year",
      },
      customer: {
        email: "billing@acme.corp",
        name: org.name,
      },
      card_brand: "mastercard",
      card_last_four: "8888",
    },
  };

  const rawBody = JSON.stringify(payload);
  const webhookId = `msg_${Date.now()}`;
  const webhookTimestamp = Math.floor(Date.now() / 1000).toString();

  let secretKey;
  if (webhookSecret.startsWith("whsec_")) {
    try {
      secretKey = Buffer.from(webhookSecret.slice(6), "base64");
    } catch {
      secretKey = Buffer.from(webhookSecret, "utf-8");
    }
  } else {
    secretKey = Buffer.from(webhookSecret, "utf-8");
  }

  const toSign = `${webhookId}.${webhookTimestamp}.${rawBody}`;
  const hmac = crypto.createHmac("sha256", secretKey).update(toSign).digest("base64");
  const signature = `v1,${hmac}`;

  console.log("▶ Sending signed `subscription.active` webhook to SentinelOps...");

  try {
    const res = await fetch(`${targetUrl}/api/v1/billing/dodopayments/webhook`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "webhook-id": webhookId,
        "webhook-signature": signature,
        "webhook-timestamp": webhookTimestamp,
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

    const billingResult = await pool.query(
      "select provider, subscription_status, billing_interval from organization_billing_accounts where organization_id = $1",
      [org.id],
    );
    if (billingResult.rows.length > 0) {
      const b = billingResult.rows[0];
      console.log(`   Billing Provider:  ${b.provider} (Expected: dodopayments)`);
      console.log(`   Status:            ${b.subscription_status} (Expected: active)`);
      console.log(`   Interval:          ${b.billing_interval} (Expected: year)`);
    }

    if (updated.plan_code === "pro") {
      console.log("\n🎉 SUCCESS: Dodo Payments webhook end-to-end integration verified!");
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
