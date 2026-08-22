-- =============================================================
--  Migration 0011 - make audit tampering fail loudly
--
--  RLS already blocks it: audit_logs has no UPDATE or DELETE policy,
--  so those statements match zero rows. Verified against live data --
--  an attempted delete left all rows intact.
--
--  But a denied UPDATE or DELETE returns *success with zero rows*,
--  not an error. Anything watching for an error therefore sees the
--  attempt as permitted, which is exactly how the Step 14 test suite
--  misread it. Worse, a future policy change could open a real hole
--  and nothing would look different.
--
--  Supabase grants ALL on public tables to authenticated by default,
--  so the explicit grants in migration 0002 were additive and never
--  removed anything. Revoking here means an attempt to rewrite the
--  audit log is refused by the privilege system before RLS is even
--  consulted -- and it raises a real error that gets noticed.
--
--  Nothing legitimate is lost: rows are written only by the
--  SECURITY DEFINER trigger, which is unaffected by these grants.
-- =============================================================

revoke update, delete on public.audit_logs from authenticated;
revoke update, delete on public.audit_logs from anon;

-- Belt and braces: no sequence privileges either, so ids cannot be
-- manipulated to overwrite an existing entry.
revoke all on all sequences in schema public from anon;
