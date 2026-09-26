-- ================================================
-- 030_rls_lockdown_rollback.sql
-- 030 이전: RLS는 켜져 있고 정책은 USING (true) (스키마 v2.3 + 이후 마이그레이션)
-- 실행은 사용자가 한다.
-- ================================================

ALTER TABLE IF EXISTS customers                ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS staff                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS templates                ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS sites                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS inquiries                ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS one_time_payments        ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS customer_payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS subscriptions            ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS billing_history          ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS support_tickets          ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS support_ticket_messages  ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS user_boards              ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS user_posts               ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS user_comments            ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS notification_logs        ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS common_codes             ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "customers_all"         ON customers;
DROP POLICY IF EXISTS "staff_all"             ON staff;
DROP POLICY IF EXISTS "templates_select"      ON templates;
DROP POLICY IF EXISTS "sites_all"             ON sites;
DROP POLICY IF EXISTS "inquiries_all"         ON inquiries;
DROP POLICY IF EXISTS "one_time_all"          ON one_time_payments;
DROP POLICY IF EXISTS "pay_methods_all"       ON customer_payment_methods;
DROP POLICY IF EXISTS "subscriptions_all"     ON subscriptions;
DROP POLICY IF EXISTS "billing_hist_all"      ON billing_history;
DROP POLICY IF EXISTS "tickets_all"           ON support_tickets;
DROP POLICY IF EXISTS "ticket_messages_all"   ON support_ticket_messages;
DROP POLICY IF EXISTS "user_boards_all"       ON user_boards;
DROP POLICY IF EXISTS "user_posts_all"        ON user_posts;
DROP POLICY IF EXISTS "user_comments_all"     ON user_comments;
DROP POLICY IF EXISTS "notification_logs_all" ON notification_logs;
DROP POLICY IF EXISTS "common_codes_all"      ON common_codes;

CREATE POLICY "customers_all"         ON customers                FOR ALL USING (true);
CREATE POLICY "staff_all"             ON staff                    FOR ALL USING (true);
CREATE POLICY "templates_select"      ON templates                FOR SELECT USING (true);
CREATE POLICY "sites_all"             ON sites                    FOR ALL USING (true);
CREATE POLICY "inquiries_all"         ON inquiries                FOR ALL USING (true);
CREATE POLICY "one_time_all"          ON one_time_payments        FOR ALL USING (true);
CREATE POLICY "pay_methods_all"       ON customer_payment_methods FOR ALL USING (true);
CREATE POLICY "subscriptions_all"     ON subscriptions            FOR ALL USING (true);
CREATE POLICY "billing_hist_all"      ON billing_history          FOR ALL USING (true);
CREATE POLICY "tickets_all"           ON support_tickets          FOR ALL USING (true);
CREATE POLICY "ticket_messages_all"   ON support_ticket_messages  FOR ALL USING (true);
CREATE POLICY "user_boards_all"       ON user_boards              FOR ALL USING (true);
CREATE POLICY "user_posts_all"        ON user_posts               FOR ALL USING (true);
CREATE POLICY "user_comments_all"     ON user_comments            FOR ALL USING (true);
CREATE POLICY "notification_logs_all" ON notification_logs        FOR ALL USING (true);
CREATE POLICY "common_codes_all"      ON common_codes             FOR ALL USING (true);

-- 030에서 회수한 anon/authenticated 권한 복원 (service_role 은 그대로)
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated;
