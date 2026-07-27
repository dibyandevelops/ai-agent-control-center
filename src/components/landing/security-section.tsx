import {
  ArrowRight,
  Check,
  CircleDollarSign,
  Cloud,
  Code2,
  FileCheck2,
  ShieldCheck,
  UserRoundCheck,
  X,
} from "lucide-react";
import styles from "./landing.module.css";

const controls = [
  {
    icon: ShieldCheck,
    title: "Least-privilege permissions",
    description: "Give every agent only the data and actions it needs.",
  },
  {
    icon: UserRoundCheck,
    title: "Human approval for consequential actions",
    description: "Keep people accountable at the moments that matter.",
  },
  {
    icon: FileCheck2,
    title: "Evidence by default",
    description: "Preserve every request, decision, approver, and outcome.",
  },
] as const;

export function SecuritySection() {
  return (
    <section className={styles.security} id="security">
      <div className={styles.securityCopy}>
        <h2>Control without<br />slowing teams down</h2>
        <p>Apply one policy model across agents, models, tools, and environments—while teams keep building.</p>
        <div className={styles.controlList}>
          {controls.map(({ icon: Icon, title, description }) => (
            <article key={title}>
              <span><Icon /></span>
              <div><h3>{title}</h3><p>{description}</p></div>
            </article>
          ))}
        </div>
      </div>
      <div className={styles.boundary}>
        <h3>Enforcement boundary</h3>
        <div className={styles.boundaryFlow}>
          <div className={styles.requestNode}><Code2 /><span>Agent request</span></div>
          <ArrowRight />
          <div className={styles.gatewayNode}><ShieldCheck /><strong>SentinelOps</strong><span>gateway</span></div>
          <ArrowRight />
          <div className={styles.outcomes}>
            <span className={styles.outcomeAllow}><Check /> Allow</span>
            <span className={styles.outcomeReview}><UserRoundCheck /> Human approval</span>
            <span className={styles.outcomeBlock}><X /> Block</span>
          </div>
        </div>
        <div className={styles.boundaryLayers}>
          <div><UserRoundCheck /><strong>Identity layer</strong><span>Users, teams, agents, service identities</span></div>
          <div><ShieldCheck /><strong>Policy layer</strong><span>Actions, data, context, risk, guardrails</span></div>
          <div><FileCheck2 /><strong>Audit layer</strong><span>Requests, decisions, approvals, outcomes</span></div>
          <div><CircleDollarSign /><strong>Cost controls</strong><span>Budgets, rate limits, spend guardrails</span></div>
        </div>
        <div className={styles.deployment}><Cloud /> Cloud, private cloud, or customer-managed deployment</div>
      </div>
    </section>
  );
}
