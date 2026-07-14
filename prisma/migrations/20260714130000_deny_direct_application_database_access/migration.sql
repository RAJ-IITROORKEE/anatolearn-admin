-- Application data is available only through the server/Prisma boundary. Keep
-- the object lists explicit and scope every operation to the connection's
-- current schema so isolated Prisma schemas and auth/storage remain untouched.
DO $$
DECLARE
  application_schema name := current_schema();
  application_table text;
  application_function text;
BEGIN
  IF application_schema IS NULL THEN
    RAISE EXCEPTION 'The application schema cannot be resolved from the current search_path';
  END IF;
  IF application_schema IN ('auth', 'storage') THEN
    RAISE EXCEPTION 'Refusing to alter protected Supabase schema %', application_schema;
  END IF;

  FOREACH application_table IN ARRAY ARRAY[
    'Profile',
    'OrganSystem',
    'Topic',
    'ContentLesson',
    'ContentLessonProgress',
    'Flashcard',
    'Question',
    'QuestionOption',
    'AssessmentAttempt',
    'AssessmentAttemptTopic',
    'AttemptQuestion',
    'FlashcardProgress',
    'FlashcardViewEvent',
    'TopicProgress',
    'Feedback',
    'NotificationCampaign',
    'NotificationRecipient',
    'NotificationDelivery',
    'DeviceToken',
    'MediaAsset',
    'AuditLog'
  ]
  LOOP
    IF to_regclass(format('%I.%I', application_schema, application_table)) IS NULL THEN
      RAISE EXCEPTION 'Expected application table %.% is missing', application_schema, application_table;
    END IF;

    EXECUTE format(
      'REVOKE ALL PRIVILEGES ON TABLE %I.%I FROM anon, authenticated',
      application_schema,
      application_table
    );
    EXECUTE format(
      'ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY',
      application_schema,
      application_table
    );
  END LOOP;

  -- UUID primary keys currently avoid application-owned sequences, but revoke
  -- any sequence access inherited in this application schema.
  EXECUTE format(
    'REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA %I FROM anon, authenticated',
    application_schema
  );

  -- Trigger invocation does not require the row-writing role to have EXECUTE on
  -- the trigger function. These functions are internal invariants, not RPCs.
  FOREACH application_function IN ARRAY ARRAY[
    'prevent_audit_log_mutation',
    'enforce_attempt_topic_scope',
    'prevent_attempt_snapshot_mutation',
    'enforce_attempt_lifecycle_immutability',
    'enforce_attempt_answer_lifecycle',
    'enforce_attempt_child_insert_lifecycle',
    'prevent_attempt_history_delete',
    'enforce_notification_recipient_history',
    'enforce_notification_delivery_history'
  ]
  LOOP
    IF to_regprocedure(format('%I.%I()', application_schema, application_function)) IS NULL THEN
      RAISE EXCEPTION 'Expected application function %.%() is missing', application_schema, application_function;
    END IF;

    EXECUTE format(
      'REVOKE ALL PRIVILEGES ON FUNCTION %I.%I() FROM PUBLIC, anon, authenticated',
      application_schema,
      application_function
    );
  END LOOP;

  -- Prisma migrations create application objects as postgres. Prevent future
  -- objects in this schema from restoring direct Data API access.
  EXECUTE format(
    'ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA %I REVOKE ALL PRIVILEGES ON TABLES FROM anon, authenticated',
    application_schema
  );
  EXECUTE format(
    'ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA %I REVOKE ALL PRIVILEGES ON SEQUENCES FROM anon, authenticated',
    application_schema
  );
  EXECUTE format(
    'ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA %I REVOKE ALL PRIVILEGES ON FUNCTIONS FROM PUBLIC, anon, authenticated',
    application_schema
  );
END;
$$;
