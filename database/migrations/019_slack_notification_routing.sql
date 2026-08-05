alter table slack_connections
  drop constraint if exists slack_connections_organization_id_key;

alter table slack_connections
  add column if not exists is_default boolean not null default false,
  add column if not exists event_types text[] not null default '{}'::text[],
  add column if not exists minimum_severity text not null default 'info'
    check (minimum_severity in ('info', 'low', 'medium', 'high', 'critical'));

with ranked_connections as (
  select id,
         row_number() over (
           partition by organization_id
           order by created_at asc, id asc
         ) as organization_rank
  from slack_connections
)
update slack_connections connection
set is_default = true
from ranked_connections ranked
where connection.id = ranked.id
  and ranked.organization_rank = 1
  and not exists (
    select 1
    from slack_connections existing_default
    where existing_default.organization_id = connection.organization_id
      and existing_default.is_default
  );

create unique index if not exists slack_connections_tenant_destination_uidx
  on slack_connections (organization_id, team_id, channel_id);

create unique index if not exists slack_connections_one_default_per_tenant_uidx
  on slack_connections (organization_id)
  where is_default;

create index if not exists slack_connections_tenant_routing_idx
  on slack_connections (organization_id, is_default, status, minimum_severity);

comment on column slack_connections.is_default is
  'Safe fallback destination when no specialized organization route matches an event.';

comment on column slack_connections.event_types is
  'Notification event families handled by a specialized route. Empty for the default fallback.';
