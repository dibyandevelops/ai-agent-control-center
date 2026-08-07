alter table notification_outbox drop constraint if exists notification_outbox_channel_check;
alter table notification_outbox add constraint notification_outbox_channel_check
  check (channel in ('slack', 'email'));
