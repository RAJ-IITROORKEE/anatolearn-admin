-- PostgreSQL requires new enum labels to commit before later migrations use them.
ALTER TYPE "AuditAction" ADD VALUE 'TRASH';
ALTER TYPE "AuditAction" ADD VALUE 'RESTORE';
ALTER TYPE "AuditAction" ADD VALUE 'PURGE';
