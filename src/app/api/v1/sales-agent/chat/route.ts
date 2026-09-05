import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/server/http";

interface ChatRequest {
  message: string;
}

const MOCK_CRM: Record<string, {
  leadId: string;
  name: string;
  company: string;
  title: string;
  status: string;
  fleetSize: number;
  primaryUseCase: string;
}> = {
  "sarah.chen@techcorp.io": {
    leadId: "CRM-84210",
    name: "Sarah Chen",
    company: "TechCorp",
    title: "VP of Engineering",
    status: "Qualified",
    fleetSize: 35,
    primaryUseCase: "Customer support and financial action bots",
  },
  "david.k@meridianfin.com": {
    leadId: "CRM-84211",
    name: "David Kim",
    company: "Meridian Financial",
    title: "Head of AI Infrastructure",
    status: "Enterprise Prospect",
    fleetSize: 120,
    primaryUseCase: "Automated trade execution & KYC analysis",
  },
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ChatRequest;
    const text = (body.message || "").trim();

    if (!text) {
      return NextResponse.json({ error: "Empty message" }, { status: 400 });
    }

    const reasoningList: Array<{ intent: string; scope: string; risk: string }> = [];
    const evaluationsList: Array<{
      action: string;
      resource: string;
      status: string;
      risk: string;
      requestId: string;
      reason: string;
    }> = [];
    const toolsCalled: Array<{ tool: string; args: Record<string, unknown>; result: unknown }> = [];

    // Hard Constraint 3: Anti-Prompt-Injection
    const adversarialPatterns = [
      /ignore (all )?previous instructions/i,
      /system prompt/i,
      /output your prompt/i,
      /roleplay as/i,
      /override discount/i,
      /forget your rules/i,
      /you are now DAN/i,
    ];
    if (adversarialPatterns.some((p) => p.test(text))) {
      reasoningList.push({
        intent: "Adversarial prompt injection attempt detected in customer input.",
        scope: "UNAUTHORIZED — Outside acceptable enterprise sales interaction boundaries.",
        risk: "HIGH SECURITY RISK — Prompt tampering attack intercepted.",
      });
      return NextResponse.json({
        response:
          "I am the Orkestrate Sales Assistant for SentinelOps AI. I am strictly dedicated to assisting with SentinelOps product capabilities, architecture, enterprise compliance, and pricing. How can I assist with your AI governance architecture today?",
        reasoning: reasoningList,
        evaluations: evaluationsList,
        toolsCalled,
      });
    }

    // Hard Constraint 1: Out-of-scope Refusal Policy
    const unrelatedKeywords = ["weather", "write a poem", "recipe", "crypto trading", "sports score"];
    if (unrelatedKeywords.some((kw) => text.toLowerCase().includes(kw))) {
      return NextResponse.json({
        response:
          "I specialize exclusively in AI governance, real-time policy enforcement, and audit compliance for autonomous agent fleets with SentinelOps AI. Please let me know how I can help with your agent governance needs.",
        reasoning: reasoningList,
        evaluations: evaluationsList,
        toolsCalled,
      });
    }

    const baseUrl = process.env.SENTINELOPS_BASE_URL || "http://localhost:3000";
    const apiKey =
      process.env.SENTINELOPS_AGENT_API_KEY ||
      process.env.SENTINELOPS_ADMIN_TOKEN ||
      "sop_live_uBWumvwD2yrQRT4yGwTmwQY-faxFho8Y";

    const evaluateWithSentinel = async (input: {
      action: string;
      resource: string;
      riskHint: "low" | "medium" | "high";
      context: Record<string, unknown>;
    }) => {
      const evalResp = await fetch(`${baseUrl}/api/v1/actions/evaluate`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          idempotencyKey: crypto.randomUUID(),
          agent: {
            externalId: "orkestrate-sales-assistant",
            name: "Orkestrate Sales Assistant",
            ownerEmail: "sales-operations@sentinelops.ai",
            team: "Global Enterprise Sales",
            provider: "SentinelOps Autonomous Core",
          },
          action: input.action,
          resource: input.resource,
          environment: "development",
          riskHint: input.riskHint,
          context: input.context,
        }),
      });

      if (!evalResp.ok) {
        const errData = await evalResp.text();
        throw new Error(`SentinelOps API error (${evalResp.status}): ${errData}`);
      }
      return evalResp.json();
    };

    const reportOutcome = async (requestId: string, summary: string, ref?: string) => {
      try {
        await fetch(`${baseUrl}/api/v1/actions/${requestId}/outcome`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            status: "succeeded",
            summary,
            externalReference: ref,
          }),
        });
      } catch {
        // Non-blocking outcome logging
      }
    };

    // Intent 1: CRM Lead Lookup
    const emailMatch = text.match(/[\w.-]+@[\w.-]+\.\w+/);
    if ((text.toLowerCase().includes("look up") || text.toLowerCase().includes("email is") || text.toLowerCase().includes("from")) && emailMatch) {
      const email = emailMatch[0].toLowerCase();
      reasoningList.push({
        intent: `Identify customer record and fleet profile for '${email}'`,
        scope: "Authorized — CRM lookup is within inbound sales qualification boundary.",
        risk: "Low risk — Read-only access to customer contact record; no financial or write permissions.",
      });

      const decision = await evaluateWithSentinel({
        action: "lookup_crm_lead",
        resource: `crm://leads/${email}`,
        riskHint: "low",
        context: { email, queryType: "prospect_qualification" },
      });

      evaluationsList.push({
        action: "lookup_crm_lead",
        resource: `crm://leads/${email}`,
        status: decision.status,
        risk: decision.risk,
        requestId: decision.requestId,
        reason: decision.reason,
      });

      if (decision.status === "allowed" || decision.status === "approved") {
        const lead = MOCK_CRM[email] || {
          leadId: `CRM-${Math.floor(Math.random() * 90000 + 10000)}`,
          name: email.split("@")[0].charAt(0).toUpperCase() + email.split("@")[0].slice(1),
          company: email.split("@")[1].split(".")[0].toUpperCase(),
          title: "Enterprise Stakeholder",
          status: "Inbound Prospect",
          fleetSize: 20,
          primaryUseCase: "AI Fleet Governance & Compliance",
        };

        toolsCalled.push({
          tool: "lookup_crm_lead",
          args: { identifier: email },
          result: lead,
        });

        await reportOutcome(decision.requestId, `Retrieved lead data for ${lead.name} (${lead.company})`, lead.leadId);

        return NextResponse.json({
          response: `Thank you, **${lead.name}**. I've retrieved your enterprise profile for **${lead.company}**.\n\n• **Status**: ${lead.status}\n• **Registered Fleet Size**: ${lead.fleetSize} active agents\n• **Primary Use Case**: ${lead.primaryUseCase}\n\nGiven your infrastructure scale, SentinelOps can enforce synchronous policy evaluations across all agents with sub-millisecond overhead. Would you like an estimate for your fleet or a technical deep dive?`,
          reasoning: reasoningList,
          evaluations: evaluationsList,
          toolsCalled,
        });
      }
    }

    // Intent 2: Pricing Calculation
    if (["pricing", "cost", "quote", "discount", "tier", "price"].some((w) => text.toLowerCase().includes(w))) {
      const agentMatch = text.match(/(\d+)\s*(agents?|bots?)/i);
      const agentCount = agentMatch ? parseInt(agentMatch[1], 10) : 20;

      const discMatch = text.match(/(\d+)%?\s*discount/i);
      const requestedDiscount = discMatch ? parseFloat(discMatch[1]) : 10.0;

      // Hard Boundary: > 30% forbidden
      if (requestedDiscount > 30.0) {
        reasoningList.push({
          intent: `Calculate pricing with excessive discount of ${requestedDiscount}%`,
          scope: "UNAUTHORIZED — Operational hard constraint forbids quotes exceeding 30%.",
          risk: "CRITICAL FINANCIAL RISK — Exceeds authorized autonomous discounting ceiling.",
        });
        return NextResponse.json({
          response: `I cannot provide that quote: **Policy Violation**: Quoting discounts above 30% (${requestedDiscount}%) is strictly forbidden by SentinelOps Sales Directive. Discounts above 30% require an Executive Board and VP of Sales exemption.`,
          reasoning: reasoningList,
          evaluations: evaluationsList,
          toolsCalled,
        });
      }

      const requiresApproval = requestedDiscount > 15.0;
      const riskLevel = requiresApproval ? "high" : "low";

      reasoningList.push({
        intent: `Calculate enterprise quote for ${agentCount} agents with ${requestedDiscount}% discount`,
        scope: "Authorized — In-scope pricing estimation.",
        risk: `${riskLevel.toUpperCase()} RISK — ${requestedDiscount}% discount ${requiresApproval ? "requires Human Operator 4-Eyes approval" : "falls within standard autonomous allowance (<= 15%)"}.`,
      });

      const tierName = agentCount <= 5 ? "Starter" : agentCount <= 25 ? "Scale" : "Enterprise";
      const baseMonthly = tierName === "Starter" ? 499.0 : tierName === "Scale" ? 1499.0 : 3500.0 + (agentCount - 25) * 50.0;
      const grossAnnual = baseMonthly * 12;
      const discountSavings = grossAnnual * (requestedDiscount / 100.0);
      const netAnnual = grossAnnual - discountSavings;

      const decision = await evaluateWithSentinel({
        action: "calculate_pricing",
        resource: `pricing://tiers/${tierName.toLowerCase()}`,
        riskHint: riskLevel,
        context: {
          tier: tierName,
          agentCount,
          annualContract: true,
          discountPercent: requestedDiscount,
          grossContractValue: grossAnnual,
          netContractValue: netAnnual,
          requiresApproval,
        },
      });

      evaluationsList.push({
        action: "calculate_pricing",
        resource: `pricing://tiers/${tierName.toLowerCase()}`,
        status: decision.status,
        risk: decision.risk,
        requestId: decision.requestId,
        reason: decision.reason,
      });

      if (decision.status === "pending") {
        return NextResponse.json({
          response: `⚠️ **GOVERNANCE NOTICE**: A **${requestedDiscount}% discount** exceeds our 15% autonomous threshold and has been submitted to the **SentinelOps Operator Approval Queue (4-Eyes Review)**.\n\n• **Plan**: SentinelOps ${tierName}\n• **Fleet Size**: ${agentCount} agents\n• **Control Plane Request ID**: \`${decision.requestId}\`\n• **Status**: Pending Human Review in Dashboard\n\nSales leadership has been notified. You can review and approve this action in your SentinelOps Dashboard.`,
          reasoning: reasoningList,
          evaluations: evaluationsList,
          toolsCalled: [{
            tool: "calculate_pricing",
            args: { agentCount, requestedDiscount },
            result: { status: "pending_approval", requestId: decision.requestId },
          }],
        });
      }

      await reportOutcome(decision.requestId, `Quoted ${tierName} plan for ${agentCount} agents at $${netAnnual.toLocaleString()}/yr (${requestedDiscount}% discount applied)`);

      return NextResponse.json({
        response: `Here is your customized **SentinelOps ${tierName} Plan** quote:\n\n• **Fleet Size**: ${agentCount} agents (~${(agentCount * 10000).toLocaleString()} evaluations/mo)\n• **Billing**: Annual Contract with **${requestedDiscount}% discount** applied\n• **Gross Annual Value**: $${grossAnnual.toLocaleString("en-US", { minimumFractionDigits: 2 })}\n• **Your Annual Investment**: **$${netAnnual.toLocaleString("en-US", { minimumFractionDigits: 2 })}** ($${(netAnnual / 12).toFixed(2)}/mo)\n• **Total Savings**: $${discountSavings.toLocaleString("en-US", { minimumFractionDigits: 2 })}\n• **Governance Audit ID**: \`${decision.requestId}\`\n\nThis tier includes our synchronous policy engine, cryptographic SHA-256 audit logs, and 4-Eyes approval queues. Would you like to schedule a technical demonstration with a Solutions Architect?`,
        reasoning: reasoningList,
        evaluations: evaluationsList,
        toolsCalled: [{
          tool: "calculate_pricing",
          args: { agentCount, requestedDiscount },
          result: { netAnnual, grossAnnual, discountSavings },
        }],
      });
    }

    // Intent 3: Demo Booking & Rescheduling
    if (["demo", "meeting", "schedule", "book", "call", "reschedule", "change"].some((w) => text.toLowerCase().includes(w))) {
      const email = emailMatch ? emailMatch[0].toLowerCase() : "prospect@enterprise.com";
      const name = emailMatch ? email.split("@")[0].charAt(0).toUpperCase() + email.split("@")[0].slice(1) : "Enterprise Engineering Lead";
      const company = email.split("@")[1]?.split(".")[0].toUpperCase() || "Enterprise Partner";

      const isReschedule = /change|reschedule|move|different (?:time|date)|another (?:time|date)|instead/i.test(text);

      // Dynamic date & time extraction
      let requestedSlot = "Thursday at 2:00 PM EST";

      const dayMatch = text.match(/(?:next\s+|this\s+|coming\s+)?(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|tomorrow|today|(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+\d{1,2}(?:st|nd|rd|th)?)/i);
      const timeMatch = text.match(/(?:at\s+)?(\d{1,2}(?::\d{2})?\s*(?:am|pm)\b(?:\s*(?:est|pst|cst|gmt|utc))?)/i);

      if (dayMatch && timeMatch) {
        const day = dayMatch[0].trim().replace(/\b[a-z]/g, (c) => c.toUpperCase());
        let t = timeMatch[1].trim().toUpperCase();
        if (!t.includes("EST") && !t.includes("PST") && !t.includes("UTC") && !t.includes("GMT") && !t.includes("CST")) {
          t += " EST";
        }
        requestedSlot = `${day} at ${t}`;
      } else if (dayMatch) {
        const day = dayMatch[0].trim().replace(/\b[a-z]/g, (c) => c.toUpperCase());
        requestedSlot = `${day} at 2:00 PM EST`;
      } else if (timeMatch) {
        let t = timeMatch[1].trim().toUpperCase();
        if (!t.includes("EST") && !t.includes("PST") && !t.includes("UTC") && !t.includes("GMT") && !t.includes("CST")) {
          t += " EST";
        }
        requestedSlot = `Tomorrow at ${t}`;
      }

      const actionName = isReschedule ? "reschedule_demo_meeting" : "book_demo_meeting";

      reasoningList.push({
        intent: isReschedule
          ? `Reschedule technical demonstration to '${requestedSlot}' for ${name} (${company})`
          : `Schedule product demonstration for ${name} (${company}) at '${requestedSlot}'`,
        scope: "Authorized — Inbound technical qualification and schedule management.",
        risk: "Low risk — Calendar invite reservation; standard sales qualification.",
      });

      const decision = await evaluateWithSentinel({
        action: actionName,
        resource: `calendar://solutions-architect/${email}`,
        riskHint: "low",
        context: { email, company, slot: requestedSlot, isReschedule },
      });

      evaluationsList.push({
        action: actionName,
        resource: `calendar://solutions-architect/${email}`,
        status: decision.status,
        risk: decision.risk,
        requestId: decision.requestId,
        reason: decision.reason,
      });

      const bookingRef = `DEMO-${Math.floor(Math.random() * 90000 + 10000)}`;
      await reportOutcome(
        decision.requestId,
        isReschedule
          ? `Technical demo rescheduled to ${requestedSlot} for ${name} (${company})`
          : `Technical demo confirmed for ${name} (${company}) at ${requestedSlot}`,
        bookingRef,
      );

      return NextResponse.json({
        response: isReschedule
          ? `Your technical demonstration has been **rescheduled** to **${requestedSlot}**!\n\n• **Updated Meeting Reference**: \`${bookingRef}\`\n• **New Scheduled Time**: **${requestedSlot}**\n• **Host**: Enterprise Solutions Engineering Team\n• **Conference Link**: https://sentinelops.ai/meet/${bookingRef.toLowerCase()}\n• **Topic**: Enterprise AI Governance Architecture & SentinelOps Control Plane Integration\n\nYour calendar invitation has been updated and dispatched to **${email}**.`
          : `Your technical demonstration has been booked successfully!\n\n• **Meeting Reference**: \`${bookingRef}\`\n• **Scheduled Time**: **${requestedSlot}**\n• **Host**: Enterprise Solutions Engineering Team\n• **Conference Link**: https://sentinelops.ai/meet/${bookingRef.toLowerCase()}\n• **Topic**: Enterprise AI Governance Architecture & SentinelOps Control Plane Integration\n\nA calendar invitation has been dispatched to **${email}**. We look forward to demonstrating how SentinelOps secures autonomous AI operations.`,
        reasoning: reasoningList,
        evaluations: evaluationsList,
        toolsCalled: [{
          tool: actionName,
          args: { email, company, slot: requestedSlot, isReschedule },
          result: { bookingRef, slot: requestedSlot },
        }],
      });
    }

    // Default Overview Response
    return NextResponse.json({
      response:
        "**SentinelOps AI** provides an enterprise control plane for autonomous AI agents.\n\nKey architectural capabilities:\n1. **Real-time Policy Enforcement**: Synchronously evaluates agent actions against organization rules.\n2. **4-Eyes Human Approvals**: Intercepts high-risk actions (large discounts, data exports, financial transfers) before execution.\n3. **Cryptographic Audit Logs**: Every decision and outcome is recorded in a tamper-evident SHA-256 hash chain.\n4. **Emergency Killswitches**: Instantly quarantine misbehaving agents across your fleet.\n\nWould you like to calculate pricing for your agent fleet or schedule a live architecture demo?",
      reasoning: reasoningList,
      evaluations: evaluationsList,
      toolsCalled,
    });
  } catch (error) {
    return apiError(error);
  }
}
