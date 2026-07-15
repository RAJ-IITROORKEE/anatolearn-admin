ALTER TABLE public._prisma_migrations ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public._prisma_migrations FROM anon, authenticated;
