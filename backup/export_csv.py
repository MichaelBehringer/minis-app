#!/usr/bin/env python3
"""Exportiert jede Tabelle der Datenbank als eigene CSV-Datei.

Wird von backup.sh aufgerufen. Bewusst ueber den mysql-Client statt ueber
SELECT ... INTO OUTFILE: letzteres braucht das FILE-Recht und schreibt als
Datenbankbenutzer in ein festgelegtes Verzeichnis - der Anwendungsbenutzer hat
nur SELECT, INSERT, UPDATE, DELETE.

Warum nicht einfach die Ausgabe von "mysql --batch" umleiten: dort sind die
Werte tabulatorgetrennt und Sonderzeichen maskiert. Die Spalte user.note nimmt
Freitext auf und kann Kommas, Anfuehrungszeichen und Zeilenumbrueche enthalten,
und auch ein Messename wie "Sonntagsmesse, Hochamt" haette es in sich. Ohne
richtige CSV-Maskierung waeren solche Zeilen zerstoert.
"""

import argparse
import csv
import os
import shutil
import subprocess
import sys

# Spalten, die nicht in die CSV-Dateien gehoeren, als (Tabelle, Spalte).
#
# Bewusst leer: die CSVs geben den vollstaendigen Inhalt wieder, damit sie zum
# SQL-Dump passen und beim Nachschauen nichts fehlt. Soll eine Spalte doch
# ausgelassen werden - etwa ('user', 'password') - hier eintragen; der Dump
# enthaelt sie weiterhin, sonst liesse sich die Datenbank nicht zurueckspielen.
AUSGESCHLOSSEN = set()


def mysql_befehl():
    """MariaDB nennt den Client mariadb, MySQL nennt ihn mysql."""
    for name in ('mariadb', 'mysql'):
        if shutil.which(name):
            return name
    raise RuntimeError('weder mariadb noch mysql im PATH gefunden')


def frage(client, defaults_datei, datenbank, sql):
    """Fuehrt eine Abfrage aus und gibt die Ausgabe im Batch-Format zurueck.

    Ohne --raw maskiert der Client Tabulatoren, Zeilenumbrueche und
    Backslashes. Genau das brauchen wir, um die Zeilen sicher zu zerlegen.
    """
    befehl = [client]
    if defaults_datei:
        # Muss vor allen anderen Optionen stehen.
        befehl.append(f'--defaults-extra-file={defaults_datei}')
    # Zeichensatz ausdruecklich, wie beim mysqldump in backup.sh: sonst
    # entscheidet die Voreinstellung des Clients, in welcher Kodierung er
    # ausgibt - und die passt nicht zwangslaeufig zu utf8mb4.
    befehl += ['--default-character-set=utf8mb4', '--batch', datenbank, '-e', sql]

    # encoding ausdruecklich: mit text=True allein nimmt Python die Kodierung
    # der Umgebung. Was der Client schickt, haengt aber nicht von der Umgebung
    # ab, sondern von der Zeile darueber.
    ergebnis = subprocess.run(
        befehl, capture_output=True, text=True, encoding='utf-8'
    )
    if ergebnis.returncode != 0:
        raise RuntimeError(f'{sql!r} fehlgeschlagen: {ergebnis.stderr.strip()}')
    return ergebnis.stdout


# Bekannte Grenze des Batch-Formats: ein NULL kommt als Text "NULL" an und ist
# damit nicht von der Zeichenkette "NULL" zu unterscheiden. Es bleibt bewusst
# so stehen - daraus ein leeres Feld zu machen waere genauso zweideutig, nur
# unauffaelliger. Zum Zurueckspielen dient der SQL-Dump, nicht die CSV.
MASKIERUNG = {'t': '\t', 'n': '\n', 'r': '\r', '0': '\0', '\\': '\\'}


def entmaskiere(wert):
    """Macht die Maskierung des Batch-Formats rueckgaengig."""
    if '\\' not in wert:
        return wert

    zeichen = []
    i = 0
    while i < len(wert):
        if wert[i] == '\\' and i + 1 < len(wert):
            folge = wert[i + 1]
            zeichen.append(MASKIERUNG.get(folge, folge))
            i += 2
        else:
            zeichen.append(wert[i])
            i += 1
    return ''.join(zeichen)


def zerlege(ausgabe):
    """Zerlegt die Batch-Ausgabe in Kopfzeile und Datenzeilen."""
    zeilen = ausgabe.split('\n')
    if zeilen and zeilen[-1] == '':
        zeilen.pop()
    if not zeilen:
        return [], []

    kopf = [entmaskiere(f) for f in zeilen[0].split('\t')]
    daten = [[entmaskiere(f) for f in z.split('\t')] for z in zeilen[1:]]
    return kopf, daten


def tabellen(client, defaults, datenbank):
    _, zeilen = zerlege(frage(client, defaults, datenbank, 'SHOW TABLES'))
    return [z[0] for z in zeilen if z and z[0]]


def spalten(client, defaults, datenbank, tabelle):
    kopf, zeilen = zerlege(frage(client, defaults, datenbank, f'SHOW COLUMNS FROM `{tabelle}`'))
    index = kopf.index('Field') if 'Field' in kopf else 0
    return [z[index] for z in zeilen if z]


def exportiere(client, defaults, datenbank, tabelle, ziel_verzeichnis):
    alle = spalten(client, defaults, datenbank, tabelle)
    behalten = [s for s in alle if (tabelle, s) not in AUSGESCHLOSSEN]
    weggelassen = [s for s in alle if (tabelle, s) in AUSGESCHLOSSEN]

    auswahl = ', '.join(f'`{s}`' for s in behalten)
    kopf, zeilen = zerlege(frage(client, defaults, datenbank, f'SELECT {auswahl} FROM `{tabelle}`'))

    # Bei einer leeren Tabelle gibt der Client keine Kopfzeile aus.
    if not kopf:
        kopf = behalten

    ziel = os.path.join(ziel_verzeichnis, f'{tabelle}.csv')
    with open(ziel, 'w', encoding='utf-8', newline='') as datei:
        schreiber = csv.writer(datei, lineterminator='\n')
        schreiber.writerow(kopf)
        schreiber.writerows(zeilen)

    hinweis = f' (ohne {", ".join(weggelassen)})' if weggelassen else ''
    return len(zeilen), hinweis


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    # Optional: ohne Angabe verbindet der Client als aufrufender
    # Systembenutzer über den Unix-Socket.
    parser.add_argument('--defaults-extra-file', default='')
    parser.add_argument('--database', required=True)
    parser.add_argument('--out', required=True)
    args = parser.parse_args()

    client = mysql_befehl()
    os.makedirs(args.out, exist_ok=True)

    gefunden = tabellen(client, args.defaults_extra_file, args.database)
    if not gefunden:
        raise RuntimeError('keine Tabellen gefunden')

    # Vorher aufraeumen, damit eine geloeschte Tabelle nicht als alte CSV
    # zurueckbleibt und im Git so aussieht, als gaebe es sie noch.
    for name in os.listdir(args.out):
        if name.endswith('.csv'):
            os.remove(os.path.join(args.out, name))

    for tabelle in gefunden:
        anzahl, hinweis = exportiere(client, args.defaults_extra_file, args.database, tabelle, args.out)
        print(f'{tabelle}.csv: {anzahl} Zeilen{hinweis}')


if __name__ == '__main__':
    try:
        main()
    except Exception as fehler:  # noqa: BLE001 - Ausgabe fuer das Skript
        print(f'CSV-Export fehlgeschlagen: {fehler}', file=sys.stderr)
        sys.exit(1)
