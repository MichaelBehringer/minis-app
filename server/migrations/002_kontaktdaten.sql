-- Kontaktdaten und eine Bemerkung an den Stammdaten.
--
-- Bis hierher hatte `user` nur Namen, Zugang, Rolle, Aktiv-Kennzeichen und
-- Weihrauch. Fuer jeden Anruf brauchte der Ministrantenrat eine zweite Liste
-- ausserhalb der Anwendung.
--
-- Alle drei Spalten sind optional. Sie erscheinen bewusst NICHT in /userHead
-- (die Liste, die jeder Angemeldete fuer die Wunschpartner-Auswahl lesen darf)
-- und nicht im PDF-Plan.
--
-- Einmalig anzuwenden:  mariadb minis < server/migrations/002_kontaktdaten.sql

ALTER TABLE `user`
  ADD COLUMN `phone` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL
    COMMENT 'Telefon, in der Regel der Eltern',
  ADD COLUMN `email` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  -- Bemerkung des Ministrantenrats. Nur ab Rolle 2 lesbar und aenderbar - der
  -- Server entfernt sie aus der Antwort, wenn ein Ministrant seine eigenen
  -- Daten abruft.
  ADD COLUMN `note` text COLLATE utf8mb4_unicode_ci DEFAULT NULL;
