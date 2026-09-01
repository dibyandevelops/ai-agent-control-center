"use client";

import { Bot, LockKeyhole, X } from "lucide-react";
import { useState } from "react";
import type { Agent } from "@/lib/types";
import { BrandMark } from "../navigation/sidebar";

export function RegisterDialog({
  open,
  onClose,
  onRegister,
}: {
  open: boolean;
  onClose: () => void;
  onRegister: (agent: Agent) => void | Promise<void>;
}) {
  const [name, setName] = useState("");
  const [owner, setOwner] = useState("");
  const [team, setTeam] = useState("Platform Engineering");
  const [provider, setProvider] = useState("OpenAI");

  if (!open) return null;

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim() || !owner.trim()) return;
    void onRegister({
      id: `agent-${Date.now()}`,
      name: name.trim(),
      description: "Newly registered AI agent awaiting expanded configuration.",
      owner: owner.trim(),
      team,
      status: "healthy",
      provider,
      permissions: ["No permissions granted"],
      actions: 0,
      cost: 0,
      lastAction: "Agent registered",
      lastSeen: "Just now",
    });
    setName("");
    setOwner("");
  }

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <div
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="register-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="dialog-header">
          <div className="dialog-title">
            <BrandMark small />
            <div>
              <h2 id="register-title">Register AI agent</h2>
              <p>Add ownership and provider details. Permissions start locked.</p>
            </div>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close dialog">
            <X />
          </button>
        </div>
        <form onSubmit={submit}>
          <label>
            Agent name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Invoice Processing Agent"
              autoFocus
              required
            />
          </label>
          <div className="form-grid">
            <label>
              Owner email
              <input
                type="email"
                value={owner}
                onChange={(e) => setOwner(e.target.value)}
                placeholder="owner@company.com"
                required
              />
            </label>
            <label>
              Team
              <select value={team} onChange={(e) => setTeam(e.target.value)}>
                <option>Platform Engineering</option>
                <option>Finance</option>
                <option>Security</option>
                <option>Legal</option>
                <option>Customer Support</option>
              </select>
            </label>
          </div>
          <label>
            Model provider
            <select value={provider} onChange={(e) => setProvider(e.target.value)}>
              <option>OpenAI</option>
              <option>Anthropic</option>
              <option>Google</option>
              <option>Azure AI</option>
              <option>Self-hosted</option>
            </select>
          </label>
          <div className="security-note">
            <LockKeyhole />
            <div>
              <strong>Secure by default</strong>
              <span>This agent will have no enterprise permissions until a policy owner grants them.</span>
            </div>
          </div>
          <div className="dialog-actions">
            <button type="button" className="secondary-button" onClick={onClose}>
              Cancel
            </button>
            <button className="primary-button" type="submit">
              <Bot /> Register agent
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
