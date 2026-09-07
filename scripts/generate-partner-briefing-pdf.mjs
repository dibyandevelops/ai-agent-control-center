import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>SentinelOps - Partner & Investor Executive Briefing</title>
<style>
  @page {
    size: letter;
    margin: 16mm 16mm 16mm 16mm;
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
    line-height: 1.52;
    font-size: 10pt;
    margin: 0;
    padding: 0;
  }

  /* Cover Header */
  .cover {
    border-bottom: 3px solid #10b981;
    padding-bottom: 16px;
    margin-bottom: 18px;
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
    margin-bottom: 10px;
  }
  h1 {
    font-size: 22pt;
    font-weight: 800;
    color: #0f172a;
    line-height: 1.15;
    margin: 0 0 4px 0;
    letter-spacing: -0.02em;
  }
  .subtitle {
    font-size: 11pt;
    color: #475569;
    margin: 0 0 12px 0;
    font-weight: 400;
  }
  .meta-bar {
    display: flex;
    justify-content: space-between;
    font-size: 8pt;
    color: #64748b;
    border-top: 1px solid #e2e8f0;
    padding-top: 6px;
  }

  /* One-Minute Quick Summary Box */
  .executive-summary-box {
    background: linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%);
    border: 1.5px solid #10b981;
    border-radius: 10px;
    padding: 14px 18px;
    margin: 16px 0 22px 0;
    box-shadow: 0 2px 6px rgba(16, 185, 129, 0.08);
  }
  .summary-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
  }
  .summary-badge {
    background: #10b981;
    color: #ffffff;
    font-size: 7.5pt;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    padding: 3px 8px;
    border-radius: 4px;
  }
  .summary-title {
    font-size: 11pt;
    font-weight: 800;
    color: #064e3b;
  }
  .summary-grid {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 12px;
    margin-top: 8px;
  }
  .summary-card {
    background: #ffffff;
    border: 1px solid #bbf7d0;
    border-radius: 6px;
    padding: 10px 12px;
  }
  .summary-card h4 {
    margin: 0 0 4px 0;
    font-size: 8.5pt;
    font-weight: 800;
    color: #047857;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .summary-card p {
    margin: 0;
    font-size: 8.5pt;
    color: #1f2937;
    line-height: 1.4;
  }

  /* Typography */
  h2 {
    font-size: 13pt;
    font-weight: 700;
    color: #0f172a;
    margin-top: 22px;
    margin-bottom: 8px;
    border-bottom: 1.5px solid #e2e8f0;
    padding-bottom: 4px;
    letter-spacing: -0.01em;
    page-break-after: avoid;
  }
  h3 {
    font-size: 10.5pt;
    font-weight: 700;
    color: #1e293b;
    margin-top: 14px;
    margin-bottom: 5px;
    page-break-after: avoid;
  }
  p {
    margin: 0 0 9px 0;
  }
  strong {
    color: #0f172a;
  }

  /* Callouts */
  .callout {
    background: #f8fafc;
    border-left: 4px solid #3b82f6;
    padding: 9px 13px;
    border-radius: 0 6px 6px 0;
    margin: 11px 0;
    font-size: 9.5pt;
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
    padding: 12px 16px;
    border-radius: 8px;
    font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
    font-size: 8pt;
    line-height: 1.42;
    margin: 12px 0;
    white-space: pre;
    overflow-x: hidden;
    page-break-inside: avoid;
  }
  .diagram-title {
    color: #34d399;
    font-weight: bold;
    margin-bottom: 5px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    font-size: 7.5pt;
  }

  /* Tables */
  table {
    width: 100%;
    border-collapse: collapse;
    margin: 10px 0 14px 0;
    font-size: 8.5pt;
    page-break-inside: avoid;
  }
  th {
    background: #f1f5f9;
    color: #0f172a;
    font-weight: 700;
    text-align: left;
    padding: 6px 9px;
    border-bottom: 2px solid #cbd5e1;
    font-size: 8pt;
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }
  td {
    padding: 6px 9px;
    border-bottom: 1px solid #e2e8f0;
    vertical-align: top;
  }
  tr:nth-child(even) td {
    background: #f8fafc;
  }

  /* Two Column Layout */
  .grid-2 {
    display: flex;
    gap: 12px;
    margin: 11px 0;
    page-break-inside: avoid;
  }
  .col {
    flex: 1;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    padding: 10px 12px;
    border-radius: 6px;
  }
  .col h4 {
    margin: 0 0 4px 0;
    font-size: 9.5pt;
    color: #0f172a;
  }

  /* Timeline / Roadmap Styling */
  .roadmap-phase {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-left: 4px solid #10b981;
    border-radius: 0 8px 8px 0;
    padding: 12px 16px;
    margin-bottom: 14px;
    page-break-inside: avoid;
  }
  .phase-header {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin-bottom: 6px;
  }
  .phase-title {
    font-size: 11pt;
    font-weight: 800;
    color: #0f172a;
  }
  .phase-timing {
    font-size: 8.5pt;
    font-weight: 700;
    color: #059669;
    background: #ecfdf5;
    padding: 2px 8px;
    border-radius: 9999px;
  }
  .phase-objective {
    font-size: 9pt;
    color: #334155;
    font-weight: 600;
    margin-bottom: 6px;
  }
  .phase-deliverables {
    margin: 0;
    padding-left: 18px;
    font-size: 8.5pt;
    color: #475569;
  }
  .phase-deliverables li {
    margin-bottom: 3px;
  }
  .kpi-tag {
    display: inline-block;
    background: #e0f2fe;
    color: #0369a1;
    font-size: 7.5pt;
    font-weight: 700;
    padding: 2px 6px;
    border-radius: 4px;
    margin-top: 6px;
  }

  /* Q&A Section */
  .qa-item {
    margin-bottom: 12px;
    page-break-inside: avoid;
  }
  .question {
    font-weight: 700;
    color: #0f172a;
    font-size: 9.5pt;
    margin-bottom: 3px;
    display: flex;
    gap: 6px;
  }
  .question::before {
    content: "Q:";
    color: #10b981;
    font-weight: 800;
  }
  .answer {
    padding-left: 18px;
    color: #334155;
    font-size: 9pt;
  }

  .page-break {
    page-break-before: always;
  }
</style>
</head>
<body>

<!-- COVER / HEADER -->
<div class="cover">
  <div class="brand-badge">Strategic Partner & Investor Briefing • 2026 Edition</div>
  <h1>SentinelOps Control Center</h1>
  <div class="subtitle">The Executive Guide to Autonomous AI Governance: Why AI Agents Need a Control Center</div>
  <div class="meta-bar">
    <span><strong>Target Audience:</strong> Non-Technical Partners, Executive Leadership, Investors</span>
    <span><strong>Status:</strong> Active Commercial Expansion</span>
    <span><strong>Confidentiality:</strong> Strategic Briefing</span>
  </div>
</div>

<!-- ONE QUICK SUMMARY ON TOP -->
<div class="executive-summary-box">
  <div class="summary-header">
    <span class="summary-badge">Executive Briefing</span>
    <span class="summary-title">One-Minute Executive Summary (TL;DR)</span>
  </div>
  <div class="summary-grid">
    <div class="summary-card">
      <h4>1. The Trillion-Dollar Problem</h4>
      <p>Companies are giving autonomous AI agents "digital hands" (passwords, bank access, database credentials) to do real work. But when an AI misunderstands an instruction, it can wipe databases, leak customer PII, or wire company money with zero human oversight.</p>
    </div>
    <div class="summary-card">
      <h4>2. What SentinelOps Is</h4>
      <p>SentinelOps is the <strong>"Air Traffic Control & Dual-Key Vault"</strong> for AI. It intercepts high-stakes AI actions, checks company rules in &lt;20ms, sends 1-click human approvals with a 5-second Undo safety net, and automatically generates verifiable SOC 2 audit certificates.</p>
    </div>
    <div class="summary-card">
      <h4>3. The Investment Opportunity</h4>
      <p>Just as every enterprise computer needed a firewall in the 1990s and every web app needed Cloudflare in the 2010s, every company deploying AI agents <em>must</em> have an enforcement gateway. SentinelOps is positioned to be the category-defining governance standard.</p>
    </div>
  </div>
</div>

<!-- PART 1: THE BASICS -->
<h2>Part 1: The Basics — What is an "AI Agent" in Plain English?</h2>
<p>To understand why SentinelOps is essential, it helps to see how technology has evolved in three distinct chapters:</p>

<div class="diagram-box">
<div class="diagram-title">Visual Tree: The 3 Generations of Business Software</div>
Stage 1: Search Engines (Google, Bing)
 └──> "Here is where the information is located on the internet."
      (You read it, you do 100% of the actual work. Zero operational danger.)

Stage 2: Conversational Chatbots (ChatGPT, Claude)
 └──> "Here is a drafted email, contract summary, or piece of writing."
      (You inspect the text, copy/paste it, and click 'Send'. Moderate risk.)

Stage 3: Autonomous AI Agents (Current Era — The SentinelOps Frontier)
 └──> "I logged into the corporate database, exported 10,000 payroll records, 
       and executed a live cloud server deployment on your behalf."
      (The AI is given employee credentials and acts on its own. CRITICAL RISK!)
</div>

<div class="callout callout-success">
  <strong>The Fundamental Rule:</strong>
  Chatbots <em>talk to you</em>. AI Agents <em>act for you</em>. When an AI Agent makes a mistake, it doesn't just produce a silly sentence on your screen—it changes real records, moves real company dollars, or deletes live databases.
</div>

<!-- PART 2: THE PROBLEM -->
<h2>Part 2: The Problem — Why Autonomous AI Terrifies Enterprise Leaders</h2>
<p>Companies are eager to deploy AI agents because they work 24/7 without fatigue and can execute the workload of an entire department. But enterprise leaders (CEOs, Chief Security Officers, Legal Counsel) are slamming the brakes due to three core realities:</p>

<div class="grid-2">
  <div class="col">
    <h4>The "Super-Intern with Master Keys" Metaphor</h4>
    <p>Imagine hiring an extraordinarily brilliant intern who has read every business textbook and works at superhuman speed. On day one, you hand them the master keys to the bank vault, write-access to customer credit cards, and admin passwords to company servers.</p>
    <p>Even if they are completely well-intentioned, sooner or later an honest misunderstanding or ambiguous instruction will trigger a multimillion-dollar disaster.</p>
  </div>
  <div class="col">
    <h4>Why Traditional Antivirus & Firewalls Fail</h4>
    <p>Cybersecurity tools (firewalls, anti-malware) are built to stop <em>outsiders breaking in</em>. They look for unknown foreign IP addresses or malware signatures.</p>
    <p>They are completely blind to an <em>inside AI agent</em> that already possesses valid employee credentials, logged into the internal system legitimately, and deleted the customer database because it misunderstood an English sentence.</p>
  </div>
</div>

<h3>Three Real-World Nightmare Scenarios</h3>
<table>
  <thead>
    <tr>
      <th style="width: 25%;">Domain</th>
      <th style="width: 35%;">What the Agent was Asked to Do</th>
      <th style="width: 40%;">What Happened Without SentinelOps</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><strong>Financial Operations</strong></td>
      <td>"Calculate and disburse quarterly contractor bonus payouts."</td>
      <td>The agent hallucinated vendor account IDs and wired \$480,000 to unverified foreign bank accounts with no legal recall ability.</td>
    </tr>
    <tr>
      <td><strong>Customer Privacy (GDPR/HIPAA)</strong></td>
      <td>"Analyze churn patterns for high-value enterprise accounts."</td>
      <td>The agent dumped 50,000 raw customer records containing Social Security Numbers into a public cloud testing folder.</td>
    </tr>
    <tr>
      <td><strong>Cloud Infrastructure</strong></td>
      <td>"Clean up idle cloud servers to reduce annual infrastructure spend."</td>
      <td>The agent mistakenly classified the primary production database as 'idle' and deleted it in the middle of a Friday business afternoon.</td>
    </tr>
  </tbody>
</table>

<div class="page-break"></div>

<!-- PART 3: THE SOLUTION -->
<h2>Part 3: The Solution — How SentinelOps Solves This</h2>
<p><strong>SentinelOps is the Enterprise Enforcement Gateway and Control Center for Autonomous AI.</strong></p>
<p>Just as airports require <strong>Air Traffic Control</strong> to ensure planes navigate safely without collisions, and nuclear submarines require <strong>Dual-Key Vaults</strong> where two officers must turn keys simultaneously before a launch, SentinelOps sits between all autonomous AI agents and your company's crown jewels.</p>

<div class="diagram-box">
<div class="diagram-title">System Architecture: The SentinelOps Safety Gateway</div>
   [ Autonomous AI Agents ] (LangChain, OpenAI, Claude, Internal Bots)
             │
             ▼  (Attempts an action: e.g., "Export 2,500 Customer Records")
   ┌─────────────────────────────────────────────────────────────┐
   │                  SENTINELOPS CONTROL GATEWAY                 │
   │                                                             │
   │  1. Check Company Rules  ──> Is destination approved?       │
   │                              Is volume under safe limit?    │
   │                                                             │
   │  2. Deterministic Decision:                                 │
   │     • Green (Safe)   ──> AUTO-ALLOW (&lt;20ms speed)           │
   │     • Amber (Risky)  ──> DISPATCH TO HUMAN APPROVER         │
   │     • Red (Illegal)  ──> BLOCK & QUARANTINE AGENT           │
   └──────────────────────────────┬──────────────────────────────┘
                                  │
         ┌────────────────────────┴────────────────────────┐
         ▼                                                 ▼
[ 5-Second Interactive Undo ]               [ Cryptographic Attestation ]
Instant Slack & Web Notification            Mathematical SOC 2 & ISO 27001
Allows human manager to approve or          proof generated in one click 
hit 'UNDO' if clicked by mistake.           for regulators and auditors.
</div>

<h3>The 4 Core Safety Pillars</h3>
<ol>
  <li><strong>Deterministic Policy Guardrails (The Rules of the Road)</strong>: Unlike AI prompts that can be tricked by clever wording, SentinelOps rules are mathematically rigid. If company policy states <em>"No export over 500 records without VP approval,"</em> no AI agent can bypass it.</li>
  <li><strong>Interactive Human-in-the-Loop with 5-Second Undo</strong>: High-stakes operations alert managers on Slack or their dashboard. If a manager accidentally clicks 'Approve' while distracted, our 5-second interactive grace period lets them click <strong>UNDO</strong> before any command touches the backend.</li>
  <li><strong>Cryptographic Black Box Flight Recorder (SOC 2 / ISO 27001)</strong>: Every single action, approval, and decision is locked into a tamper-evident SHA-256 cryptographic chain. Regulators and auditors receive mathematical proof that records were never altered or deleted.</li>
  <li><strong>Fleet Emergency Kill-Switch (Quarantine)</strong>: If an agent begins behaving erratically or an integration is compromised, administrators can isolate that agent in one click, revoking write-access across all corporate systems in real time.</li>
</ol>

<!-- PART 4: COMMERCIAL VALUE -->
<h2>Part 4: Commercial Value & Partner Revenue Model</h2>
<p>For strategic partners (software consultancies, systems integrators, SaaS platforms, compliance auditors), SentinelOps is an immediate revenue and adoption accelerator:</p>

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
      <td><strong>AI Consultancies & Solution Providers</strong></td>
      <td>Enterprise clients want AI, but legal and compliance teams stall high-ticket deals indefinitely.</td>
      <td>Bundling SentinelOps eliminates security objections, accelerating enterprise AI contracts from 9 months to 3 weeks.</td>
    </tr>
    <tr>
      <td><strong>SaaS Platforms & Integrators</strong></td>
      <td>Need to offer 'enterprise-grade' AI governance without spending 18+ months building internal tools.</td>
      <td>Earn recurring software revenue-share and high-margin consulting retainers configuring custom governance templates.</td>
    </tr>
    <tr>
      <td><strong>Compliance & Risk Auditors</strong></td>
      <td>Auditing autonomous AI currently requires hundreds of hours of manual screenshot chasing.</td>
      <td>SentinelOps provides one-click cryptographic attestation certificates, automating audit evidence collection by 80%.</td>
    </tr>
  </tbody>
</table>

<div class="page-break"></div>

<!-- PART 5: DETAILED 3-6 MONTH EXECUTION PLAN -->
<h2>Part 5: Investment-Grade Execution Plan (Next 3 to 6 Months)</h2>
<p>SentinelOps is moving at high velocity. The following operational roadmap outlines our strategic product milestones, commercial go-to-market targets, and institutional growth trajectory over the next 3 to 6 months:</p>

<div class="roadmap-phase">
  <div class="phase-header">
    <span class="phase-title">Phase 1: Universal Gateway Connectors & Enterprise IdP Federation</span>
    <span class="phase-timing">Months 1 – 2 (Days 1 – 60)</span>
  </div>
  <div class="phase-objective">Objective: Make SentinelOps plug-and-play into 90% of the world's autonomous agent frameworks and enterprise security stacks.</div>
  <ul class="phase-deliverables">
    <li><strong>Universal Agent SDK Connectors</strong>: One-line governance wrappers for LangChain, CrewAI, AutoGPT, Microsoft AutoGen, Vercel AI SDK, and AWS Bedrock.</li>
    <li><strong>Enterprise Single Sign-On (SSO) & Directory Sync</strong>: Production SAML 2.0 and SCIM directory provisioning for Okta, Microsoft Entra ID (Azure AD), and Google Workspace.</li>
    <li><strong>Cloudflare Turnstile Bot Fortress</strong>: Complete bot mitigation on sign-in and workspace registration to eliminate credential-stuffing and tenant exhaustion.</li>
    <li><strong>Interactive Slack & Microsoft Teams Approval Apps</strong>: Bi-directional chat apps enabling managers to approve, reject, or undo agent actions directly within corporate messaging channels.</li>
  </ul>
  <span class="kpi-tag">Milestone KPI: 15 Enterprise Pilot Signups • Sub-15ms Gateway Latency • Zero-Touch SSO Rollout</span>
</div>

<div class="roadmap-phase">
  <div class="phase-header">
    <span class="phase-title">Phase 2: Autonomous Threat Containment & Automated Compliance Sync</span>
    <span class="phase-timing">Months 3 – 4 (Days 61 – 120)</span>
  </div>
  <div class="phase-objective">Objective: Evolve from passive rule evaluation into active, autonomous containment and real-time auditor integration.</div>
  <ul class="phase-deliverables">
    <li><strong>Autonomous Heuristic Anomaly Quarantine</strong>: Machine-speed behavioral detection that automatically freezes an agent if its transaction frequency, volume, or target endpoints deviate from baseline.</li>
    <li><strong>Automated Compliance Evidence Pipeline (Vanta / Drata)</strong>: Direct API connectors streaming cryptographic SHA-256 attestation packages into major governance platforms for continuous SOC 2 Type II, ISO 27001, and EU AI Act readiness.</li>
    <li><strong>Hardware Security Module (HSM) Cryptographic Attestation</strong>: Cloud KMS and HSM hardware-signed digital certificates that satisfy military-grade non-repudiation standards.</li>
    <li><strong>Granular 4-Eyes Governance with Emergency Bypass Auditing</strong>: Advanced policy workflows requiring two authorized executive signatures for production financial and code operations.</li>
  </ul>
  <span class="kpi-tag">Milestone KPI: 35 Live Enterprise Fleets • 1-Click Vanta/Drata Certified Partner Integration</span>
</div>

<div class="roadmap-phase">
  <div class="phase-header">
    <span class="phase-title">Phase 3: Governance Template Marketplace & Commercial Scale</span>
    <span class="phase-timing">Months 5 – 6 (Days 121 – 180)</span>
  </div>
  <div class="phase-objective">Objective: Establish SentinelOps as the de facto industry standard for AI governance and achieve institutional Series A readiness.</div>
  <ul class="phase-deliverables">
    <li><strong>SentinelOps Governance Policy Marketplace</strong>: Pre-packaged compliance templates for specific verticals: <em>Fintech Vault</em>, <em>HIPAA Healthcare Shield</em>, <em>DevOps Release Guard</em>, and <em>EU AI Act Compliance Pack</em>.</li>
    <li><strong>Certified AI Governance Partner Network (CAGP)</strong>: Formal tiering program for global systems integrators (Bain AI, Accenture, Slalom, Deloitte) with co-selling referral commissions and certified implementation playbooks.</li>
    <li><strong>Multi-Region Global Gateway Mesh</strong>: Distributed edge enforcement across North America, Europe, and Asia-Pacific ensuring &lt;5ms policy latency for international corporate deployments.</li>
    <li><strong>Commercial Scale & Institutional Financing</strong>: Expand enterprise design partners to 50+ enterprise fleets, reach \$1.5M ARR milestone, and finalize institutional Series A investment round.</li>
  </ul>
  <span class="kpi-tag">Milestone KPI: \$1.5M ARR Target • 50+ Enterprise Customers • Tier-1 Certified Partner Ecosystem</span>
</div>

<div class="page-break"></div>

<!-- PART 6: FREQUENTLY ASKED QUESTIONS -->
<h2>Part 6: Frequently Asked Questions (Partner & Investor Q&A)</h2>

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
  <div class="question">How defensible is SentinelOps against big tech platforms (e.g. OpenAI or Microsoft)?</div>
  <div class="answer">Enterprises never trust a model vendor (like OpenAI or Microsoft) to independently audit and restrict itself. Furthermore, enterprises deploy heterogeneous fleets mixing OpenAI, Claude, internal custom models, and open-source tools. SentinelOps serves as the neutral, cross-platform third-party auditor and enforcement authority that enterprise compliance departments demand.</div>
</div>

<!-- FOOTER & CONTACT -->
<h2>Part 7: Engagement & Leadership Contact</h2>
<p>SentinelOps is actively onboarding strategic design partners, technology integrators, and strategic capital partners.</p>

<div class="callout callout-success">
  <strong>Executive Leadership Contact:</strong>
  To arrange a live technical demonstration, access private sandbox credentials, or discuss strategic partner / investment terms, please connect directly with the executive leadership team:<br><br>
  • <strong>Web Portal:</strong> https://sentinelops-ai.com<br>
  • <strong>Interactive Sandbox:</strong> https://sentinelops-ai.com/dashboard<br>
  • <strong>Direct Executive Channel:</strong> Inquiries are managed directly via executive scheduling with the founding leadership team.
</div>

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
