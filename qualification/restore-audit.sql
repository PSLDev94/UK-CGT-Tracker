-- Run with psql -X -qAt -v ON_ERROR_STOP=1 in the frozen source and isolated
-- restore, then compare the private outputs. Never publishes individual records.
BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL TIME ZONE 'UTC';
SET LOCAL search_path = pg_catalog;
SET LOCAL row_security = off;
SET LOCAL statement_timeout = '60s';

-- Include EVERY application, authentication, billing and migration table, even
-- empty ones. Sorted row hashes preserve duplicates and ignore physical order.
SELECT format(
  'SELECT %L, count(*), md5(coalesce(string_agg(md5(to_jsonb(t)::text), %L ORDER BY md5(to_jsonb(t)::text)), %L)) FROM %I.%I t;',
  'data:' || schemaname || '.' || tablename, '', '', schemaname, tablename
)
FROM pg_tables
WHERE schemaname IN ('cgt', 'auth', 'cgt_migrations')
ORDER BY schemaname, tablename
\gexec

SELECT 'table', n.nspname, c.relname, c.relrowsecurity, c.relforcerowsecurity
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname IN ('cgt', 'auth', 'cgt_migrations') AND c.relkind = 'r'
ORDER BY n.nspname, c.relname;

SELECT 'column', n.nspname, c.relname, a.attname,
  format_type(a.atttypid, a.atttypmod), a.attnotnull, a.attidentity,
  a.attgenerated, pg_get_expr(d.adbin, d.adrelid)
FROM pg_attribute a JOIN pg_class c ON c.oid = a.attrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
LEFT JOIN pg_attrdef d ON d.adrelid = c.oid AND d.adnum = a.attnum
WHERE n.nspname IN ('cgt', 'auth', 'cgt_migrations') AND c.relkind = 'r'
  AND a.attnum > 0 AND NOT a.attisdropped
ORDER BY n.nspname, c.relname, a.attnum;

-- Restored reports rely on the receipt review view and the precise sterling
-- conversion function, including the view's invoker settings.
SELECT 'view', n.nspname, c.relname, c.reloptions, pg_get_viewdef(c.oid)
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='cgt' AND c.relkind='v'
ORDER BY c.relname;

SELECT 'function', p.oid::regprocedure::text, md5(pg_get_functiondef(p.oid))
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='cgt' AND p.prokind='f'
ORDER BY p.oid::regprocedure::text;

SELECT 'constraint', n.nspname, c.relname, co.conname, co.convalidated,
  pg_get_constraintdef(co.oid)
FROM pg_constraint co JOIN pg_class c ON c.oid = co.conrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname IN ('cgt', 'auth', 'cgt_migrations')
ORDER BY n.nspname, c.relname, co.conname;

SELECT 'index', schemaname, tablename, indexname, indexdef FROM pg_indexes
WHERE schemaname IN ('cgt', 'auth', 'cgt_migrations')
ORDER BY schemaname, tablename, indexname;

SELECT 'policy', schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies WHERE schemaname IN ('cgt', 'auth', 'cgt_migrations')
ORDER BY schemaname, tablename, policyname;

-- Ownership may change during recovery; application role privileges may not.
SELECT 'grant', table_schema, table_name, grantee, privilege_type, is_grantable
FROM information_schema.table_privileges
WHERE table_schema IN ('cgt', 'auth', 'cgt_migrations')
  AND grantee IN ('cgt_app', 'cgt_auth', 'cgt_billing', 'cgt_maintenance', 'PUBLIC')
ORDER BY table_schema, table_name, grantee, privilege_type;

SELECT 'schema-access', n.nspname, r.rolname,
  has_schema_privilege(r.oid, n.oid, 'USAGE'), has_schema_privilege(r.oid, n.oid, 'CREATE')
FROM pg_namespace n CROSS JOIN pg_roles r
WHERE n.nspname IN ('cgt', 'auth', 'cgt_migrations')
  AND r.rolname IN ('cgt_app', 'cgt_auth', 'cgt_billing', 'cgt_maintenance')
ORDER BY n.nspname, r.rolname;
COMMIT;
