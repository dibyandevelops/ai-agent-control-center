-- Migration 033: Approver Delegation and Out-of-Office Fallbacks
create table if not exists approver_delegations (
    id uuid primary key default gen_random_uuid(),
    organization_id uuid not null references organizations(id) on delete cascade,
    delegator_operator_id uuid not null references operators(id) on delete cascade,
    delegatee_operator_id uuid not null references operators(id) on delete cascade,
    reason text not null check (length(trim(reason)) > 0 and length(reason) <= 500),
    starts_at timestamptz not null default now(),
    ends_at timestamptz not null,
    revoked_at timestamptz default null,
    created_at timestamptz not null default now(),
    constraint no_self_delegation check (delegator_operator_id != delegatee_operator_id),
    constraint valid_delegation_window check (ends_at > starts_at)
);

create index if not exists idx_approver_delegations_active
    on approver_delegations(organization_id, delegatee_operator_id, starts_at, ends_at)
    where revoked_at is null;

create index if not exists idx_approver_delegations_delegator
    on approver_delegations(organization_id, delegator_operator_id, starts_at, ends_at);
