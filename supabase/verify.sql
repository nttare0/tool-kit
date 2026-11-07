-- Metadata only. Do not select password hashes, sessions, or provider secrets.
SELECT
  (SELECT count(*)::integer FROM pg_tables WHERE schemaname = 'toolstack') AS table_count,
  (SELECT count(*)::integer FROM pg_tables WHERE schemaname = 'toolstack' AND rowsecurity) AS rls_table_count,
  (SELECT rolcanlogin FROM pg_roles WHERE rolname = 'toolstack_app') AS app_can_login,
  (SELECT rolbypassrls FROM pg_roles WHERE rolname = 'toolstack_app') AS app_bypasses_rls;
-- Expect: 13, 13, true, false.
