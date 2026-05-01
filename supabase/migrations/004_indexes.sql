create index if not exists idx_habits_log_owner_date on public.habits_log(owner_uid, logged_date);
create index if not exists idx_goals_owner_created on public.goals(owner_uid, created_at desc);
create index if not exists idx_weekly_targets_owner_week on public.weekly_targets(owner_uid, year, week_number);
create index if not exists idx_ventures_owner_status on public.ventures(owner_uid, status);
create index if not exists idx_tasks_owner_due on public.tasks(owner_uid, due_date);
create index if not exists idx_focus_sessions_owner_started on public.focus_sessions(owner_uid, started_at);
create index if not exists idx_metrics_owner_period on public.metrics(owner_uid, period_start);
create index if not exists idx_content_analytics_owner_recorded on public.content_analytics(owner_uid, recorded_at);
create index if not exists idx_agent_logs_owner_created on public.agent_logs(owner_uid, created_at desc);

