# Output file format (can be .gif, .mp4, or .webm)
Output sentinelops_demo.gif

# Styling settings
Set FontSize 18
Set Width 1200
Set Height 600
Set Padding 30
Set Theme "Catppuccin Mocha"
Set WindowBar "Colorful"

# 1. Clear terminal
Type "clear"
Enter

# 2. Simulate running an autonomous agent with SentinelOps guardrails
Type "echo '🤖 Autonomous AI Agent starting with SentinelOps Gateway...'"
Enter
Sleep 1s

Type "echo '⚡ [POLICY CHECK] Query: SELECT * FROM customers_cache (read-only)'"
Enter
Sleep 800ms
Type "echo '   Status: APPROVED in 14ms (Non-consequential)'"
Enter
Sleep 1.5s

# 3. Simulate a dangerous action being intercepted
Type "echo '🚨 [INTERCEPTED] Action: DROP TABLE billing_invoices (consequential)'"
Enter
Sleep 800ms
Type "echo '⏸️  SentinelOps Gateway: Action halted. Routing to Dual-Key Vault...'"
Enter
Sleep 1.5s
Type "echo '👉 1-Click Human Approval required on SentinelOps Control Center.'"
Enter
Sleep 2s
Type "echo '🛡️  Audit Evidence Seal: cert_9281a logged to immutable ledger (SOC 2 ready).'"
Enter

Sleep 4s
