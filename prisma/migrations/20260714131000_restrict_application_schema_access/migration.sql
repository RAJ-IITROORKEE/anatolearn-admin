-- Supabase client roles need schema visibility to resolve application objects,
-- but must not create objects or receive direct table access.
DO $$
DECLARE
  application_schema name := current_schema();
BEGIN
  IF application_schema IS NULL THEN
    RAISE EXCEPTION 'The application schema cannot be resolved from the current search_path';
  END IF;
  IF application_schema IN ('auth', 'storage') THEN
    RAISE EXCEPTION 'Refusing to alter protected Supabase schema %', application_schema;
  END IF;

  EXECUTE format(
    'GRANT USAGE ON SCHEMA %I TO anon, authenticated',
    application_schema
  );
  EXECUTE format(
    'REVOKE CREATE ON SCHEMA %I FROM anon, authenticated',
    application_schema
  );
END;
$$;
