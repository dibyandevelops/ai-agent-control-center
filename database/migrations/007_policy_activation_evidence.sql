alter table policy_activation_requests
  add column if not exists simulation_evidence jsonb not null default jsonb_build_object(
    'actionsEvaluated', 0,
    'matchedCount', 0,
    'determiningCount', 0,
    'changedDecisionCount', 0,
    'simulatedAt', now(),
    'changedActions', jsonb_build_array()
  );

comment on column policy_activation_requests.simulation_evidence is
  'Point-in-time replay evidence captured when the activation request is created.';
