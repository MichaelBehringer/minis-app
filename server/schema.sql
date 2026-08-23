-- Schema der Datenbank `minis`.
--
-- Bis hierher existierte es nur implizit in den SQL-Zeichenketten des
-- Go-Codes; es gab keine Datei, aus der sich eine leere Datenbank aufbauen
-- liess. Diese Datei ist der Stand, gegen den die Anwendung entwickelt wird.
--
-- Anlegen:
--     mariadb -e "CREATE DATABASE minis CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
--     mariadb minis < server/schema.sql
--
-- Hinweis zur Reihenfolge: role und location zuerst, weil user und event
-- Fremdschluessel darauf haben.

SET NAMES utf8mb4;


-- Rollen. Die Rechte im Backend haengen an "mindestens": AllowMinRole(2)
-- laesst Ministrantenrat und Admin durch. Ein Vergleich auf Gleichheit
-- wuerde den Admin aussperren.
CREATE TABLE IF NOT EXISTS `role` (
  `id`   int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `role` (`id`, `name`) VALUES
  (1, 'Ministrant'),
  (2, 'Ministrantenrat'),
  (3, 'Admin')
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`);


-- Orte. In der Anwendung nur lesbar, es gibt keine Route zum Anlegen.
CREATE TABLE IF NOT EXISTS `location` (
  `id`   int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- Benutzer.
--
-- ACHTUNG: `password` steht im Klartext. Das ist bewusst noch nicht geaendert,
-- gehoert aber auf die Liste - wer die Datenbank oder ein Backup sieht, hat
-- alle Zugaenge.
CREATE TABLE IF NOT EXISTS `user` (
  `id`        int(11) NOT NULL AUTO_INCREMENT,
  `firstname` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `lastname`  varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `username`  varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `password`  varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `role_id`   int(11) DEFAULT NULL,
  `active`    int(11) DEFAULT 1 COMMENT '0 inactive; 1 active',
  `incense`   int(11) DEFAULT NULL COMMENT '0 cannot incense; 1 can incense',
  PRIMARY KEY (`id`),
  -- Die Kollation ist ci, dieser Index deckt also auch Gross- und
  -- Kleinschreibung ab. Die Anmeldeabfrage darf deshalb kein UPPER() um die
  -- Spalte legen, sonst ist der Index unbenutzbar.
  UNIQUE KEY `username` (`username`),
  KEY `idx_user_id` (`id`),
  KEY `FK_UserRole` (`role_id`),
  CONSTRAINT `FK_UserRole` FOREIGN KEY (`role_id`) REFERENCES `role` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- Messen. `minimalUser` ist ein Sollwert, kein Limit - in den Daten wird er
-- ueberwiegend ueberschritten. `ignoreWeekday` schaltet die Wochentagspruefung
-- der Verfuegbarkeit fuer diesen Termin ab.
CREATE TABLE IF NOT EXISTS `event` (
  `id`            int(11) NOT NULL AUTO_INCREMENT,
  `name`          varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `date_begin`    date DEFAULT NULL,
  `time_begin`    time DEFAULT NULL,
  `location_id`   int(11) DEFAULT NULL,
  `minimalUser`   int(11) DEFAULT NULL,
  `ignoreWeekday` int(11) DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `idx_event_id` (`id`),
  KEY `FK_LocationEvent` (`location_id`),
  CONSTRAINT `FK_LocationEvent` FOREIGN KEY (`location_id`) REFERENCES `location` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- Die Einteilung: wer ist zu welcher Messe eingeteilt.
--
-- Der UNIQUE-Index ist der Grund, weshalb AddUserToEvent den MySQL-Fehler
-- 1062 abfangen muss - ein doppeltes Zuweisen ist fachlich kein Fehler,
-- sondern schon erledigt.
CREATE TABLE IF NOT EXISTS `plan` (
  `id`       int(11) NOT NULL AUTO_INCREMENT,
  `user_id`  int(11) DEFAULT NULL,
  `event_id` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_user_event` (`user_id`, `event_id`),
  KEY `idx_event_id` (`event_id`),
  KEY `idx_user_id` (`user_id`),
  CONSTRAINT `FK_PlanEvent` FOREIGN KEY (`event_id`) REFERENCES `event` (`id`),
  CONSTRAINT `FK_PlanUser` FOREIGN KEY (`user_id`) REFERENCES `user` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- Sperrtage. Umfangreich genutzt: im Schnitt 63 Eintraege pro Person.
CREATE TABLE IF NOT EXISTS `ban` (
  `id`       int(11) NOT NULL AUTO_INCREMENT,
  `user_id`  int(11) DEFAULT NULL,
  `ban_date` date DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_user_ban_date` (`user_id`, `ban_date`),
  KEY `FK_BanUser` (`user_id`),
  CONSTRAINT `FK_BanUser` FOREIGN KEY (`user_id`) REFERENCES `user` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- Wochentage, an denen jemand eingeteilt werden moechte.
--
-- Die Werte sind MON, TUE, WED, THU, FRI, SAT, SUN. Das SQL der
-- Verfuegbarkeitsabfrage vergleicht mit LOWER(TRIM(...)) und akzeptiert
-- zusaetzlich deutsche Kuerzel und Zahlen.
CREATE TABLE IF NOT EXISTS `user_weekday` (
  `id`      int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) DEFAULT NULL,
  `weekday` varchar(3) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_user_weekday` (`user_id`, `weekday`),
  KEY `FK_WeekdayUser` (`user_id`),
  CONSTRAINT `FK_WeekdayUser` FOREIGN KEY (`user_id`) REFERENCES `user` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- Wunschpartner.
--
-- Wird nur in einer Richtung geschrieben, aber in beiden gelesen. Der
-- UNIQUE-Index faengt die exakte Wiederholung; die Gegenrichtung verhindert
-- AddPreferredUser mit einem WHERE NOT EXISTS, weil ein Index das nicht kann.
CREATE TABLE IF NOT EXISTS `preference_together` (
  `id`        int(11) NOT NULL AUTO_INCREMENT,
  `user_id_1` int(11) DEFAULT NULL,
  `user_id_2` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_preference_pair` (`user_id_1`, `user_id_2`),
  KEY `FK_UserTogether1` (`user_id_1`),
  KEY `FK_UserTogether2` (`user_id_2`),
  CONSTRAINT `FK_UserTogether1` FOREIGN KEY (`user_id_1`) REFERENCES `user` (`id`),
  CONSTRAINT `FK_UserTogether2` FOREIGN KEY (`user_id_2`) REFERENCES `user` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
