#!/bin/bash
#
# Sicherung der Datenbank: ein SQL-Dump zum Zurückspielen und je Tabelle eine
# CSV-Datei zum Lesen. Beides wird in ein eigenes Git-Repository committet.
#
# Läuft per crontab, Zeitplan siehe README.
#
# Bewusst ohne "set -e": ein fehlgeschlagener Schritt soll gemeldet werden und
# nicht still abbrechen. Fehler laufen über die Funktion abbruch().

APP_DIR=/root/minis-app
REPO_DIR=/root/minis-backup
CSV_DIR="$REPO_DIR/csv"
ENV_DATEI="$APP_DIR/.env"

# Datenbankbenutzer für die Sicherung, wenn die Datenbank auf dieser Maschine
# läuft.
#
# Leer bedeutet: ohne Benutzernamen und ohne Passwort verbinden. Der Client
# nimmt dann den Namen des aufrufenden Systembenutzers (im Cronjob also root)
# und MariaDB prüft ihn über das unix_socket-Plugin. Das ist derselbe Weg, über
# den "sudo mariadb" ohne Passwort funktioniert.
#
# Warum nicht ein Konto mit Passwort: ein über unix_socket eingerichtetes Konto
# prüft kein Passwort, sondern den Namen des Systembenutzers - der müsste dafür
# genauso heißen. Aus einem root-Cronjob ist so ein Konto nicht erreichbar; der
# Versuch endet in MariaDB-Fehler 1698.
#
# Ist ein Konto vorhanden, das wirklich per Passwort prüft, kann es über
# MINIS_BACKUP_DB_USER in der .env gesetzt werden.
DB_USER_STANDARD=

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

wert_aus_env() {
	[ -r "$ENV_DATEI" ] || return 0
	grep -m1 "^$1=" "$ENV_DATEI" | cut -d= -f2-
}

# Meldet den Fehler und bricht ab. Ohne diese Meldung würden ausgefallene
# Sicherungen erst auffallen, wenn man sie braucht.
abbruch() {
	echo "Backup fehlgeschlagen: $1" >&2

	local thema
	thema="$(wert_aus_env MINIS_BACKUP_NTFY_TOPIC)"
	if [ -n "$thema" ]; then
		local basis
		basis="$(wert_aus_env MINIS_NTFY_URL)"
		[ -n "$basis" ] || basis="https://ntfy.sh"
		curl -s -m 10 -H "Title: Backup fehlgeschlagen" -H "Tags: rotating_light" \
			-H "Priority: high" -d "$1" "${basis%/}/$thema" >/dev/null
	fi

	exit 1
}

# --- Datenbank und Zugang ---------------------------------------------------
# Name der Datenbank, Adresse und Passwort kommen aus der .env, damit sie nur an
# einer Stelle stehen.
DSN="$(wert_aus_env MINIS_DB_DSN)"
[ -n "$DSN" ] || abbruch "MINIS_DB_DSN fehlt in $ENV_DATEI"

# benutzer:passwort@tcp(host:3306)/minis
ZUGANG="${DSN%@*}"          # alles vor dem letzten @
DSN_USER="${ZUGANG%%:*}"    # bis zum ersten :
DB_PASS="${ZUGANG#*:}"      # ab dem ersten :
DB_NAME="${DSN##*/}"        # nach dem letzten /
DB_NAME="${DB_NAME%%\?*}"   # etwaige ?parameter abschneiden
[ -n "$DB_NAME" ] || abbruch "Datenbankname nicht aus MINIS_DB_DSN zu lesen"

# Adresse aus tcp(host:port) herauslösen.
ADRESSE="${DSN#*@}"         # tcp(host:port)/minis
ADRESSE="${ADRESSE#*(}"     # host:port)/minis
ADRESSE="${ADRESSE%%)*}"    # host:port
case "$ADRESSE" in
	*:*) DB_HOST="${ADRESSE%:*}"; DB_PORT="${ADRESSE##*:}" ;;
	*)   DB_HOST="$ADRESSE";      DB_PORT=3306 ;;
esac

# Läuft die Datenbank auf dieser Maschine, geht die Verbindung über den
# Unix-Socket - dann braucht es weder Benutzernamen noch Passwort (siehe oben).
# Liegt sie außerhalb, ist dieser Weg nicht möglich: dort muss sich die
# Sicherung mit dem Zugang aus dem DSN anmelden.
#
# Genau hier unterscheidet sich diese Anwendung von atw-app, wo die Datenbank
# auf derselben VM läuft. Der Rest des Ablaufs ist identisch.
case "$DB_HOST" in
	''|localhost|127.0.0.1|::1|host.docker.internal) LOKAL=ja ;;
	*) LOKAL=nein ;;
esac

DB_USER="$(wert_aus_env MINIS_BACKUP_DB_USER)"
if [ -z "$DB_USER" ]; then
	if [ "$LOKAL" = ja ]; then
		DB_USER="$DB_USER_STANDARD"
	else
		DB_USER="$DSN_USER"
	fi
fi

BACKUP_PASS="$(wert_aus_env MINIS_BACKUP_DB_PASSWORD)"
[ -n "$BACKUP_PASS" ] && DB_PASS="$BACKUP_PASS"

# Zugang und Adresse gehen über eine Datei und nicht über die Kommandozeile -
# Argumente sind in "ps" für alle Nutzer des Systems sichtbar. Bei einer
# lokalen Datenbank wird bewusst KEINE host-Angabe geschrieben, denn nur ohne
# sie läuft die Verbindung über den Unix-Socket.
DEFAULTS="$TMP_DIR/my.cnf"
umask 077
printf '[client]\n' > "$DEFAULTS"
if [ -n "$DB_USER" ]; then
	printf 'user=%s\n' "$DB_USER" >> "$DEFAULTS"
	[ -n "$DB_PASS" ] || abbruch "für Benutzer $DB_USER kein Passwort ermittelt"
	printf 'password=%s\n' "$DB_PASS" >> "$DEFAULTS"
fi
if [ "$LOKAL" = nein ]; then
	printf 'host=%s\n' "$DB_HOST" >> "$DEFAULTS"
	printf 'port=%s\n' "$DB_PORT" >> "$DEFAULTS"
fi

# --- SQL-Dump ---------------------------------------------------------------
# --single-transaction: ohne das ist der Dump bei InnoDB nicht konsistent, wenn
# während des Laufs geschrieben wird.
#
# --skip-dump-date: ohne das schreibt mysqldump die Uhrzeit in die letzte
# Zeile. Damit unterscheidet sich jeder Dump von jedem anderen, und es
# entsteht bei jedem Lauf ein Commit - auch an einem Tag, an dem sich nichts
# geändert hat. Die Zeile "-- Dump completed" bleibt erhalten, die Prüfung
# unten greift weiterhin.
#
# Erst in eine temporäre Datei: die alte Sicherung darf nicht schon leer sein,
# bevor klar ist, dass die neue etwas enthält.
DUMP_TMP="$TMP_DIR/dump.sql"
if ! mysqldump --defaults-extra-file="$DEFAULTS" --single-transaction --quick \
	--skip-dump-date --default-character-set=utf8mb4 "$DB_NAME" > "$DUMP_TMP" 2> "$TMP_DIR/fehler.txt"; then
	abbruch "mysqldump: $(tr '\n' ' ' < "$TMP_DIR/fehler.txt")"
fi

[ -s "$DUMP_TMP" ] || abbruch "mysqldump hat eine leere Datei erzeugt"

# mysqldump schreibt diese Zeile nur, wenn es vollständig durchgelaufen ist.
grep -q '^-- Dump completed' "$DUMP_TMP" || abbruch "Dump unvollständig"

mkdir -p "$REPO_DIR" || abbruch "kann $REPO_DIR nicht anlegen"
mv "$DUMP_TMP" "$REPO_DIR/dump.sql" || abbruch "kann den Dump nicht ablegen"

# --- CSV je Tabelle ---------------------------------------------------------
if ! python3 "$APP_DIR/backup/export_csv.py" \
	--defaults-extra-file "$DEFAULTS" \
	--database "$DB_NAME" \
	--out "$CSV_DIR" > "$TMP_DIR/csv.log" 2>&1; then
	abbruch "CSV-Export: $(tr '\n' ' ' < "$TMP_DIR/csv.log")"
fi
cat "$TMP_DIR/csv.log"

# --- Ins Git ----------------------------------------------------------------
git -C "$REPO_DIR" rev-parse --git-dir >/dev/null 2>&1 || abbruch "$REPO_DIR ist kein Git-Repository"

git -C "$REPO_DIR" add -A || abbruch "git add"

# Ohne Änderungen gibt "git commit" einen Fehler zurück. Das ist kein Problem,
# sondern der Normalfall an einem Tag ohne Änderungen am Plan.
if git -C "$REPO_DIR" diff --cached --quiet; then
	echo "keine Änderungen, nichts zu committen"
	exit 0
fi

if ! git -C "$REPO_DIR" commit -q -m "Sicherung $(date '+%Y-%m-%d %H:%M')"; then
	abbruch "git commit"
fi

if ! git -C "$REPO_DIR" push -q 2> "$TMP_DIR/push.txt"; then
	# Der Commit liegt lokal, nur das Hochladen fehlt. Genau dieser Fall bleibt
	# sonst unbemerkt und beendet die Sicherung faktisch.
	abbruch "git push: $(tr '\n' ' ' < "$TMP_DIR/push.txt")"
fi

echo "Sicherung abgeschlossen"
