-- Run ONCE in the Supabase SQL editor, after the backend has created the tables (first start with DB_SYNCHRONIZE=true).
--
-- Why: every table in the `public` schema is reachable through Supabase's auto-generated REST API using the
-- public "anon" key. This app never uses that API - the NestJS backend connects directly as the `postgres`
-- role (which bypasses RLS). Enabling RLS with NO policies therefore blocks all anon/authenticated REST
-- access to your customers' contacts, messages and password hashes while the backend keeps working.
ALTER TABLE public.users               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wa_numbers          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages            ENABLE ROW LEVEL SECURITY;
