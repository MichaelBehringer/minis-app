-- Persoenlicher Kalender-Link je Benutzer.
--
-- Ein Kalender-Abo wird ohne Anmeldung immer wieder abgerufen - das JWT der
-- Anwendung kann dafuer nicht in die Adresse. Stattdessen ein eigener Wert, der
-- nur den Kalender oeffnet und jederzeit neu erzeugt werden kann, wenn der Link
-- irgendwo landet, wo er nicht hingehoert.
--
-- NULL heisst: noch kein Abo eingerichtet. Der UNIQUE-Index sorgt dafuer, dass
-- ein Wert eindeutig auf einen Benutzer zeigt; NULL zaehlt in MySQL nicht als
-- Dublette, mehrere Benutzer ohne Abo sind also kein Problem.
--
-- Einmalig anzuwenden:  mariadb minis < server/migrations/003_kalender_token.sql

ALTER TABLE `user`
  ADD COLUMN `calendar_token` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL
    COMMENT 'Zufallswert fuer das persoenliche Kalender-Abo',
  ADD UNIQUE KEY `uniq_calendar_token` (`calendar_token`);
