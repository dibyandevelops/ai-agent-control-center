import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>SentinelOps - Partner Executive Briefing & Non-Technical Guide</title>
<style>
  @page {
    size: letter;
    margin: 18mm 18mm 18mm 18mm;
    @bottom-right {
      content: counter(page);
    }
  }

  * {
    box-sizing: border-box;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }

  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    color: #1e293b;
    line-height: 1.55;
    font-size: 10.5pt;
    margin: 0;
    padding: 0;
  }

  /* Cover Header */
  .cover {
    border-bottom: 3px solid #10b981;
    padding-bottom: 20px;
    margin-bottom: 24px;
  }
  .brand-badge {
    display: inline-block;
    background: #ecfdf5;
    color: #059669;
    border: 1px solid #a7f3d0;
    font-size: 8pt;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    padding: 4px 10px;
    border-radius: 9999px;
    margin-bottom: 12px;
  }
  h1 {
    font-size: 24pt;
    font-weight: 800;
    color: #0f172a;
    line-height: 1.15;
    margin: 0 0 6px 0;
    letter-spacing: -0.02em;
  }
  .subtitle {
    font-size: 12pt;
    color: #475569;
    margin: 0 0 14px 0;
    font-weight: 400;
  }
  .meta-bar {
    display: flex;
    justify-content: space-between;
    font-size: 8.5pt;
    color: #64748b;
    border-top: 1px solid #e2e8f0;
    padding-top: 8px;
  }

  /* Typography */
  h2 {
    font-size: 14pt;
    font-weight: 700;
    color: #0f172a;
    margin-top: 24px;
    margin-bottom: 8px;
    border-bottom: 1.5px solid #e2e8f0;
    padding-bottom: 4px;
    letter-spacing: -0.01em;
    page-break-after: avoid;
  }
  h3 {
    font-size: 11pt;
    font-weight: 700;
    color: #1e293b;
    margin-top: 16px;
    margin-bottom: 6px;
    page-break-after: avoid;
  }
  p {
    margin: 0 0 10px 0;
  }
  strong {
    color: #0f172a;
  }

  /* Callout & Highlight Boxes */
  .callout {
    background: #f8fafc;
    border-left: 4px solid #3b82f6;
    padding: 10px 14px;
    border-radius: 0 8px 8px 0;
    margin: 12px 0;
    font-size: 10pt;
  }
  .callout-warning {
    background: #fffbeb;
    border-left-color: #f59e0b;
  }
  .callout-success {
    background: #f0fdf4;
    border-left-color: #10b981;
  }
  .callout strong {
    display: block;
    margin-bottom: 2px;
  }

  /* Diagrams & Trees */
  .diagram-box {
    background: #0f172a;
    color: #f8fafc;
    padding: 14px 18px;
    border-radius: 8px;
    font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
    font-size: 8.5pt;
    line-height: 1.45;
    margin: 14px 0;
    white-space: pre;
    overflow-x: hidden;
    page-break-inside: avoid;
  }
  .diagram-title {
    color: #34d399;
    font-weight: bold;
    margin-bottom: 6px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    font-size: 8pt;
  }

  /* Tables */
  table {
    width: 100%;
    border-collapse: collapse;
    margin: 12px 0 16px 0;
    font-size: 9pt;
    page-break-inside: avoid;
  }
  th {
    background: #f1f5f9;
    color: #0f172a;
    font-weight: 700;
    text-align: left;
    padding: 7px 10px;
    border-bottom: 2px solid #cbd5e1;
    font-size: 8.5pt;
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }
  td {
    padding: 7px 10px;
    border-bottom: 1px solid #e2e8f0;
    vertical-align: top;
  }
  tr:nth-child(even) td {
    background: #f8fafc;
  }

  /* Two Column Layout */
  .grid-2 {
    display: flex;
    gap: 14px;
    margin: 12px 0;
    page-break-inside: avoid;
  }
  .col {
    flex: 1;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    padding: 12px;
    border-radius: 8px;
  }
  .col h4 {
    margin: 0 0 6px 0;
    font-size: 10pt;
    color: #0f172a;
  }

  /* Q&A Section */
  .qa-item {
    margin-bottom: 14px;
    page-break-inside: avoid;
  }
  .question {
    font-weight: 700;
    color: #0f172a;
    font-size: 10pt;
    margin-bottom: 4px;
    display: flex;
    gap: 6px;
  }
  .question::before {
    content: "Q:";
    color: #10b981;
    font-weight: 800;
  }
  .answer {
    padding-left: 20px;
    color: #334155;
    font-size: 9.5pt;
  }

  .page-break {
    page-break-before: always;
  }
</style>
</head>
<body>

<!-- COVER / HEADER -->
<div class="cover">
  <div class="brand-badge">Executive Partner Briefing • Confidential</div>
  <h1>SentinelOps Control Center</h1>
  <div class="subtitle">The Executive Guide to Autonomous AI Governance: Why AI Agents Need a Control Center</div>
  <div class="meta-bar">
    <span><strong>Target Audience:</strong> Executive Leadership, Strategic Partners, Non-Technical Decision Makers</span>
    <span><strong>Published:</strong> September 2026</span>
    <span><strong>Version:</strong> 2.4 Enterprise</span>
  </div>
</div>

<!-- PART 1: THE BASICS -->
<h2>Part 1: The Basics — What is an "AI Agent" in Plain English?</h2>
<p>To understand why SentinelOps exists, it is helpful to look at how Artificial Intelligence has transformed in the workplace over the past few years:</p>

<div class="diagram-box">
<div class="diagram-title">Visual Tree: The 3 Generations of Business Technology</div>
Stage 1: Search Engines (Google)
 └─> "Here is where the information is located."
     (User reads it, user does all the work. Zero operational risk.)

Stage 2: Chatbots & Assistants (ChatGPT, Claude)
 └─> "Here is a drafted email, summary, or report."
     (User reviews the text and clicks 'Send'. Moderate risk.)

Stage 3: Autonomous AI Agents (Current Era)
 └─> "I logged into the database, exported 10,000 payroll records, 
      and initiated a cloud server deployment on your behalf."
     (The AI is given digital hands and system access. HIGH OPERATIONAL RISK!)
</div>

<div class="callout callout-success">
  <strong>The Key Distinction:</strong>
  Chatbots <em>talk</em> to you. AI Agents <em>take actions for you</em>. An AI Agent is software that has been given passwords, API credentials, and the authority to modify company data, send money, update customer records, and deploy code without a human pressing the buttons.
</div>

<!-- PART 2: THE PROBLEM -->
<h2>Part 2: The Problem — Why Autonomous AI Terrifies Enterprises</h2>
<p>Companies are eager to deploy AI agents because they work 24/7, never sleep, and can do the work of a 20-person team in minutes. However, giving an AI agent unrestricted access to company systems creates an immediate existential danger:</p>

<div class="grid-2">
  <div class="col">
    <h4>The "Super-Intern" Analogy</h4>
    <p>Imagine hiring an extraordinarily brilliant intern. They have read every textbook and work at lightning speed. But on day one, you hand them the master keys to the bank vault, write-access to every customer credit card, and root passwords to all servers.</p>
    <p>Even if they are well-intentioned, sooner or later an honest misunderstanding or bad instruction will cause a multimillion-dollar disaster.</p>
  </div>
  <div class="col">
    <h4>Why Firewalls & Antivirus Can't Help</h4>
    <p>Traditional cybersecurity tools are built to keep <em>outside hackers out</em>. They look for suspicious login attempts from foreign IP addresses.</p>
    <p>They are completely blind to an <em>inside AI agent</em> that already possesses valid employee credentials, logged into the internal system, and executed a catastrophic data export because it misinterpreted an English sentence.</p>
  </div>
</div>

<h3>Three Real-World Nightmare Scenarios</h3>
<table>
  <thead>
    <tr>
      <th style="width: 25%;">Domain</th>
      <th style="width: 35%;">What the Agent was Told to Do</th>
      <th style="width: 40%;">What Happened Without SentinelOps</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><strong>Financial Operations</strong></td>
      <td>"Prepare quarterly bonus payouts for regional directors."</td>
      <td>Agent hallucinated payroll IDs and wired \$480,000 directly to unverified personal vendor accounts with no way to recall the wire.</td>
    </tr>
    <tr>
      <td><strong>Customer Privacy (GDPR/HIPAA)</strong></td>
      <td>"Analyze churn risk for high-value enterprise accounts."</td>
      <td>Agent dumped 50,000 raw customer records containing Social Security Numbers into a public AI testing bucket.</td>
    </tr>
    <tr>
      <td><strong>Cloud Infrastructure</strong></td>
      <td>"Clean up obsolete cloud resources to reduce AWS costs."</td>
      <td>Agent mistakenly flagged the active production database as 'idle' and deleted it in the middle of a Friday business afternoon.</td>
    </tr>
  </tbody>
</table>

<div class="page-break"></div>

<!-- PART 3: THE SOLUTION -->
<h2>Part 3: The Solution — How SentinelOps Solves This</h2>
<p><strong>SentinelOps is the Enterprise Enforcement Gateway & Control Center for Autonomous AI.</strong></p>
<p>Just as airports require <strong>Air Traffic Control</strong> to ensure fast planes don't collide, and banks require <strong>Dual-Key Vaults</strong> where two managers must turn keys simultaneously before the vault opens, SentinelOps sits between all autonomous AI agents and your company's crown jewels.</p>

<div class="diagram-box">
<div class="diagram-title">Architecture: The SentinelOps Enforcement Gateway</div>
   [ Autonomous AI Agents ] (LangChain, OpenAI, Internal Bots)
             │
             ▼  (Attempts an action: e.g., "Export Customer Records")
   ┌─────────────────────────────────────────────────────────────┐
   │                  SENTINELOPS CONTROL GATEWAY                 │
   │                                                             │
   │  1. Check Company Rules  ──> Is destination approved?       │
   │                              Is volume under threshold?     │
   │                                                             │
   │  2. Decide Action:                                          │
   │     • Green (Safe)   ──> AUTO-ALLOW (sub-20ms speed)        │
   │     • Amber (Risky)  ──> DISPATCH TO HUMAN APPROVER         │
   │     • Red (Illegal)  ──> BLOCK & ISOLATE                    │
   └──────────────────────────────┬──────────────────────────────┘
                                  │
         ┌────────────────────────┴────────────────────────┐
         ▼                                                 ▼
[ 5-Second Interactive Undo ]               [ Cryptographic Attestation ]
Slack / Mobile / Web Notification           Mathematical SOC 2 / ISO 27001
Allows human manager to approve             hash proof generated instantly 
or hit 'UNDO' if clicked by mistake.        for auditors & regulators.
</div>

<h3>The 4 Core Safety Pillars</h3>
<ol>
  <li><strong>Deterministic Policy Guardrails (The Rules of the Road)</strong>: Unlike AI prompts that can be tricked by hackers, SentinelOps rules are mathematically rigid. If corporate policy says <em>"No export over 500 records without VP approval,"</em> no amount of prompt trickery can bypass it.</li>
  <li><strong>Interactive Human-in-the-Loop with 5-Second Undo</strong>: Risky actions alert designated managers on Slack or their dashboard. If a manager accidentally clicks 'Approve' while tired or distracted, our patent-pending 5-second interactive grace period lets them hit <strong>UNDO</strong> before any command touches the backend.</li>
  <li><strong>Cryptographic Black Box Flight Recorder (SOC 2 / ISO 27001)</strong>: Every single action, approval, and decision is locked into a tamper-evident cryptographic hash chain. With one click, compliance officers can download an audit certificate proving zero data tampering.</li>
  <li><strong>Instant Fleet Quarantine (The Emergency Kill-Switch)</strong>: If an agent begins behaving erratically or an integration is compromised, administrators can isolate that agent with a single click, revoking write-access across all corporate systems in real time.</li>
</ol>

<!-- PART 4: COMMERCIAL & PARTNER OPPORTUNITY -->
<h2>Part 4: Commercial & Partner Value Proposition</h2>
<p>For strategic partners (software consultancies, systems integrators, SaaS platforms, compliance auditors), SentinelOps is a massive revenue and adoption accelerator:</p>

<table>
  <thead>
    <tr>
      <th>Partner Category</th>
      <th>The Pain Point They Solve</th>
      <th>How SentinelOps Unlocks Revenue</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><strong>AI Solution Consultancies</strong></td>
      <td>Clients want AI, but legal, security, and compliance teams kill deals before signing.</td>
      <td>Bundling SentinelOps satisfies security objections immediately—reducing enterprise sales cycles from 9 months to 3 weeks.</td>
    </tr>
    <tr>
      <td><strong>SaaS Platforms & Integrators</strong></td>
      <td>Need to offer 'enterprise-ready' governance without spending 18 months building internal tools.</td>
      <td>White-label or resell SentinelOps to earn recurring ARR rev-share plus lucrative implementation services.</td>
    </tr>
    <tr>
      <td><strong>Compliance & Risk Auditors</strong></td>
      <td>Auditing autonomous AI systems currently requires hundreds of hours of manual screenshot chasing.</td>
      <td>SentinelOps provides one-click cryptographic attestation certificates, automating audit evidence collection by 80%.</td>
    </tr>
  </tbody>
</table>

<div class="page-break"></div>

<!-- PART 5: FREQUENTLY ASKED QUESTIONS -->
<h2>Part 5: Frequently Asked Questions (Partner Q&A)</h2>

<div class="qa-item">
  <div class="question">Why can't an enterprise just have their internal developers write basic safety code?</div>
  <div class="answer">Internal code checks are hardcoded, fragile, and siloed. They lack centralized audit visibility, have no role-based permission hierarchy, cannot generate cryptographic proof for external SOC 2 auditors, and break as soon as multiple teams deploy different AI models. SentinelOps provides a turnkey, multi-tenant enterprise control center that works with any AI framework out of the box.</div>
</div>

<div class="qa-item">
  <div class="question">Does SentinelOps read, harvest, or store our private customer data?</div>
  <div class="answer"><strong>No.</strong> SentinelOps is built around a zero-trust metadata architecture. Agents communicate action descriptions (e.g., <em>"Action: export_report, Count: 250, Destination: s3://internal-archive"</em>), not the raw customer records or database contents. We enforce governance without ever storing or viewing sensitive customer PII.</div>
</div>

<div class="qa-item">
  <div class="question">Will requiring human approvals slow down the speed and autonomy of AI?</div>
  <div class="answer"><strong>No.</strong> 95% of routine, low-risk operations (such as drafting responses, reading documents, and running queries) are pre-cleared by policy rules and pass through SentinelOps in <strong>under 20 milliseconds</strong> with zero human delay. Human intervention is triggered only for high-consequence operations (e.g., wiring funds, deleting databases, publishing code).</div>
</div>

<div class="qa-item">
  <div class="question">What if an AI agent tries to ignore SentinelOps and talk to the database directly?</div>
  <div class="answer">In an enterprise deployment, corporate databases, cloud APIs, and financial systems are configured with a digital lock: they only accept execution requests carrying a valid, cryptographically signed token issued by SentinelOps. If an agent tries to contact the database directly, the database server rejects the connection immediately.</div>
</div>

<div class="qa-item">
  <div class="question">What AI frameworks and models does SentinelOps work with?</div>
  <div class="answer">SentinelOps is model-agnostic. It works seamlessly with OpenAI (ChatGPT), Anthropic (Claude), Google Gemini, open-source models (Llama), LangChain, CrewAI, AutoGPT, and custom in-house Python/Node.js autonomous workflows.</div>
</div>

<div class="qa-item">
  <div class="question">How long does a customer rollout take?</div>
  <div class="answer">A live enterprise workspace can be provisioned in under 5 minutes using self-service onboarding or Corporate SAML SSO (Okta/Azure AD). Connecting an existing AI agent requires adding under 10 lines of code via our official SDKs. Most enterprise pilots achieve full production governance within 2 weeks.</div>
</div>

<!-- PART 6: 3-PHASE FORWARD ROADMAP -->
<h2>Part 6: Forward-Looking Rollout & Partnership Plan</h2>
<div class="diagram-box">
<div class="diagram-title">Partnership Onboarding & Execution Roadmap</div>
[ Phase 1: Pilot & Discovery ]       -->  [ Phase 2: Tailored Deployment ]   -->  [ Phase 3: Fleet Expansion ]
Duration: Weeks 1-2                      Duration: Weeks 3-4                      Duration: Month 2+
• Access to SentinelOps Sandbox          • Connect corporate Slack & SSO          • Scale governance across all units
• Agent inventory & risk audit           • Tailor SOC 2 / ISO guardrails          • Joint Go-To-Market co-selling
• Zero-commitment proof-of-value         • Run simulated rogue-agent drill        • Continuous SIEM security streaming
</div>

<p><strong>Next Steps:</strong> To schedule a live demonstration, explore sandbox access, or review commercial partnership agreements, please contact the SentinelOps Partner Solutions Group at <strong>partners@sentinelops-ai.com</strong>.</p>

</body>
</html>
`;

const outputHtmlPath = path.resolve("./SentinelOps_Partner_Executive_Briefing.html");
const outputPdfPath = path.resolve("./SentinelOps_Partner_Executive_Briefing.pdf");

fs.writeFileSync(outputHtmlPath, htmlContent, "utf8");
console.log("Written HTML to:", outputHtmlPath);

try {
  const bravePath = "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser";
  const cmd = '"' + bravePath + '" --headless --disable-gpu --print-to-pdf="' + outputPdfPath + '" "' + outputHtmlPath + '"';
  execSync(cmd, { stdio: "inherit" });
  console.log("Successfully generated PDF at:", outputPdfPath);
} catch (err) {
  console.error("Failed to generate PDF:", err);
  process.exit(1);
}
