-- Eindeutigkeit fuer die drei Zuordnungstabellen.
--
-- Alle drei Tabellen liessen bisher denselben Eintrag mehrfach zu. In den
-- Daten ist das nie passiert - geprueft am 2026-08-23, kein einziges Duplikat
-- in ban, user_weekday oder preference_together -, aber die Anwendung
-- verlaesst sich nach dem Umbau darauf: sie faengt den MySQL-Fehler 1062 ab
-- und behandelt einen doppelten Eintrag als "schon erledigt" statt als Fehler.
-- Ohne diese Indizes gibt es den Fehler nicht und es entstehen stille
-- Duplikate.
--
-- Anwenden:
--     mariadb minis < server/migrations/001_unique_indizes.sql
--
-- Sind doch Duplikate vorhanden, bricht die Anweisung ab. Dann zuerst suchen:
--     SELECT user_id, ban_date, COUNT(*) FROM ban
--     GROUP BY user_id, ban_date HAVING COUNT(*) > 1;
--
-- Zuruecknehmen laesst sich das mit DROP INDEX.

ALTER TABLE `ban`
  ADD UNIQUE KEY `unique_user_ban_date` (`user_id`, `ban_date`);

ALTER TABLE `user_weekday`
  ADD UNIQUE KEY `unique_user_weekday` (`user_id`, `weekday`);

ALTER TABLE `preference_together`
  ADD UNIQUE KEY `unique_preference_pair` (`user_id_1`, `user_id_2`);
