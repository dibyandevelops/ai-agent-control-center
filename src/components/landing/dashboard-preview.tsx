import {
  Bot,
  Check,
  ChevronDown,
  Clock3,
  GitBranch,
  ShieldAlert,
  ShieldCheck,
  X,
} from "lucide-react";
import styles from "./landing.module.css";

const metrics = [
  { label: "Agents", value: "127", detail: "12 new", tone: "lime" },
  { label: "Actions", value: "8,392", detail: "18.7%", tone: "lime" },
  { label: "Policy compliance", value: "98.6%", detail: "2.4%", tone: "lime" },
  { label: "High-risk actions", value: "23", detail: "5", tone: "amber" },
] as const;

const actions = [
  { time: "12:45:12", agent: "Data Analyst", action: "Query production orders", risk: "Low", result: "Allowed" },
  { time: "12:44:58", agent: "Finance Agent", action: "Transfer vendor funds", risk: "High", result: "Blocked" },
  { time: "12:44:31", agent: "Release Agent", action: "Create v2.4.1 release", risk: "Medium", result: "Review" },
] as const;

export function DashboardPreview() {
  return (
    <div className={styles.preview} aria-label="SentinelOps control center preview">
      <div className={styles.previewTopbar}>
        <div>
          <span className={styles.previewBrand}><ShieldCheck /> SentinelOps</span>
          <strong>Overview</strong>
        </div>
        <span className={styles.live}><i /> Live</span>
        <button type="button">Last 24 hours <ChevronDown /></button>
      </div>
      <div className={styles.previewBody}>
        <aside className={styles.previewNav} aria-hidden="true">
          <span className={styles.previewNavActive}><Bot /> Overview</span>
          <span><Bot /> Agents</span>
          <span><ShieldCheck /> Policies</span>
          <span><ShieldAlert /> Approvals</span>
          <small><i /> All systems operational</small>
        </aside>
        <div className={styles.previewMain}>
          <div className={styles.previewMetrics}>
            {metrics.map((metric) => (
              <div key={metric.label}>
                <span>{metric.label}</span>
                <strong className={styles[`tone${metric.tone}`]}>{metric.value}</strong>
                <small>↑ {metric.detail}</small>
              </div>
            ))}
          </div>
          <div className={styles.previewContent}>
            <section className={styles.previewTable}>
              <div className={styles.previewSectionTitle}>
                <strong>Recent actions</strong>
                <span><Clock3 /> Real time</span>
              </div>
              <div className={styles.previewTableHead}>
                <span>Time</span><span>Agent</span><span>Action</span><span>Risk</span><span>Result</span>
              </div>
              {actions.map((item) => (
                <div className={styles.previewTableRow} key={item.time}>
                  <time>{item.time}</time>
                  <span>{item.agent}</span>
                  <strong>{item.action}</strong>
                  <span className={styles[`risk${item.risk}`]}>{item.risk}</span>
                  <span className={styles[`result${item.result}`]}>{item.result}</span>
                </div>
              ))}
            </section>
            <aside className={styles.previewApproval}>
              <div className={styles.approvalHeading}>
                <span className={styles.riskHigh}>High risk</span>
                <time>12:44:58</time>
              </div>
              <div className={styles.approvalAgent}>
                <span><GitBranch /></span>
                <div><strong>Finance Agent</strong><small>Transfer vendor funds</small></div>
              </div>
              <dl>
                <div><dt>Amount</dt><dd>$250,000.00</dd></div>
                <div><dt>Policy</dt><dd>FIN-07</dd></div>
                <div><dt>Decision</dt><dd>Requires approval</dd></div>
              </dl>
              <div className={styles.approvalButtons}>
                <button type="button"><Check /> Approve</button>
                <button type="button"><X /> Deny</button>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
}
