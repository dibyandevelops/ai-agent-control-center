import {
  ArrowRight,
  Bot,
  ClipboardCheck,
  Database,
  FileCheck2,
  LockKeyhole,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import styles from "./landing.module.css";

const stages = [
  {
    number: "1",
    label: "Register",
    title: "Know every agent",
    description: "Capture ownership, model provider, purpose, and permission scope.",
  },
  {
    number: "2",
    label: "Enforce",
    title: "Decide before execution",
    description: "Allow, block, or route consequential actions for human approval.",
  },
  {
    number: "3",
    label: "Prove",
    title: "Keep durable evidence",
    description: "Record the request, policy decision, approver, and final outcome.",
  },
] as const;

const capabilities = [
  { icon: Bot, title: "Agent inventory", description: "Discover and track every agent, owner, model provider, purpose, tool, and permission scope." },
  { icon: ClipboardCheck, title: "Approval gateway", description: "Route high-impact actions to the right approvers with context and policy-backed recommendations." },
  { icon: ShieldCheck, title: "Policy engine", description: "Define intent-based controls that adapt to risk, role, data, and environment." },
  { icon: FileCheck2, title: "Audit evidence", description: "Capture immutable records of requests, decisions, approvers, and outcomes." },
] as const;

export function WorkflowSection() {
  return (
    <section className={styles.workflow} id="workflow">
      <div className={styles.sectionIntro}>
        <h2>Govern from intent to execution</h2>
        <p>SentinelOps unifies discovery, policy enforcement, approval, and evidence so you stay in control at speed.</p>
      </div>
      <ol className={styles.stages}>
        {stages.map((stage) => (
          <li key={stage.number}>
            <span className={styles.stageNumber}>{stage.number}</span>
            <strong>{stage.label}</strong>
            <h3>{stage.title}</h3>
            <p>{stage.description}</p>
          </li>
        ))}
      </ol>
      <div className={styles.policyExample}>
        <h3>Policy evaluation example</h3>
        <div className={styles.policyFlow}>
          <article>
            <span className={styles.flowLabel}>Request</span>
            <div className={styles.flowIcon}><Database /></div>
            <strong>Export 14,820 financial rows</strong>
            <small>Action: data.export</small>
          </article>
          <ArrowRight className={styles.flowArrow} />
          <article>
            <span className={styles.flowLabel}>Identity + context</span>
            <div className={styles.flowIcon}><UserRound /></div>
            <strong>Finance Analyst</strong>
            <small>Production · Finance Ops</small>
          </article>
          <ArrowRight className={styles.flowArrow} />
          <article>
            <span className={styles.flowLabel}>Policy decision</span>
            <div className={styles.flowIcon}><LockKeyhole /></div>
            <strong>Production changes require approval</strong>
            <small>High-impact data export</small>
          </article>
          <ArrowRight className={styles.flowArrow} />
          <article className={styles.reviewOutcome}>
            <span className={styles.flowLabel}>Execute or approval</span>
            <div className={styles.flowIcon}><ClipboardCheck /></div>
            <strong>Human review required</strong>
            <small>Finance lead · Pending</small>
          </article>
        </div>
      </div>
      <div className={styles.capabilities}>
        <h2>One operating layer for your AI workforce</h2>
        <div className={styles.capabilityList}>
          {capabilities.map(({ icon: Icon, title, description }) => (
            <article key={title}>
              <span><Icon /></span>
              <h3>{title}</h3>
              <p>{description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
