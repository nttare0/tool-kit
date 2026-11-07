-- Provision the role password privately after applying this migration.
-- This file intentionally contains no database credentials.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'toolstack_app') THEN
    CREATE ROLE toolstack_app NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
  END IF;
END $$;
GRANT CONNECT ON DATABASE postgres TO toolstack_app;
GRANT USAGE ON SCHEMA toolstack TO toolstack_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA toolstack TO toolstack_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA toolstack TO toolstack_app;
DO $$ DECLARE t record; BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'toolstack' LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'toolstack' AND tablename = t.tablename AND policyname = 'toolstack_server_access') THEN
      EXECUTE format('CREATE POLICY toolstack_server_access ON toolstack.%I FOR ALL TO toolstack_app USING (true) WITH CHECK (true)', t.tablename);
    END IF;
  END LOOP;
END $$;
