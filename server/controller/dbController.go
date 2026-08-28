package controller

import (
	"database/sql"
	"fmt"
	"log"
	"time"

	"github.com/go-sql-driver/mysql"
)

var db *sql.DB

// mitZeitlimits ergaenzt den DSN um Zeitgrenzen.
//
// Der MySQL-Treiber hat von sich aus keine. Ist die Datenbank nicht
// erreichbar, haengt eine Anfrage dann unbegrenzt - im Browser sieht das aus
// wie eine Anmeldemaske, die endlos laedt, ohne jede Fehlermeldung.
//
// Bereits im DSN gesetzte Werte bleiben unangetastet, damit sich das hier
// ueberschreiben laesst.
func mitZeitlimits(dsn string) (string, error) {
	cfg, err := mysql.ParseDSN(dsn)
	if err != nil {
		return "", fmt.Errorf("DSN nicht lesbar: %w", err)
	}

	if cfg.Timeout == 0 {
		cfg.Timeout = 5 * time.Second
	}
	if cfg.ReadTimeout == 0 {
		cfg.ReadTimeout = 30 * time.Second
	}
	if cfg.WriteTimeout == 0 {
		cfg.WriteTimeout = 30 * time.Second
	}

	return cfg.FormatDSN(), nil
}

// InitDB baut die Verbindung auf und prueft sie.
//
// Der Zugang stand bis hierher fest im Quellcode und damit dauerhaft in der
// Git-Historie. Der Default ist unveraendert derselbe Wert, damit sich lokal
// nichts aendert; produktiv wird er ueber MINIS_DB_DSN gesetzt und das
// Passwort muss gewechselt werden.
func InitDB() error {
	// Ohne Default: PruefePflichtwerte hat den Wert beim Start bereits
	// verlangt. Der frueher hier stehende Default zeigte auf die
	// Produktivdatenbank - ein `go run .` ohne .env schrieb also dorthin.
	dsn, err := mitZeitlimits(Env("MINIS_DB_DSN", ""))
	if err != nil {
		return err
	}

	db, err = sql.Open("mysql", dsn)
	if err != nil {
		return fmt.Errorf("Datenbankverbindung nicht aufbaubar: %w", err)
	}

	// sql.Open baut noch keine Verbindung auf, es prueft nur den DSN. Ohne
	// diesen Ping merkt der Server einen falschen Zugang oder eine nicht
	// erreichbare Datenbank erst bei der ersten Anfrage eines Nutzers.
	if err := db.Ping(); err != nil {
		return fmt.Errorf("Datenbank NICHT erreichbar: %w", err)
	}
	log.Println("Datenbank erreichbar")

	// Verbindungen nach drei Minuten erneuern. Steht zwischen Anwendung und
	// Datenbank eine Firewall, verwirft sie stille Verbindungen irgendwann
	// ohne Benachrichtigung - die Anwendung merkt das erst beim naechsten
	// Zugriff, der dann fehlschlaegt.
	db.SetConnMaxLifetime(3 * time.Minute)
	db.SetMaxIdleConns(4)

	// Bewusst kein SetMaxOpenConns: solange nicht jede Abfrage ihre Rows
	// zuverlaessig schliesst, wuerde eine Obergrenze aus einem Leck einen
	// Stillstand machen - alle Verbindungen belegt, jede weitere Anfrage
	// wartet ewig. Ohne Grenze bleibt ein Leck ein Leck und kein Ausfall.

	return nil
}

func CloseDB() {
	if db != nil {
		db.Close()
	}
}

// ExecuteSQL fuehrt eine lesende Abfrage aus.
//
// Gab vorher bei einem Fehler nil zurueck, und kein einziger Aufrufer hat das
// geprueft - results.Next() auf nil ist eine Panik. Der Fehler wird jetzt
// weitergegeben.
//
// Der Aufrufer muss die Rows schliessen.
func ExecuteSQL(statement string, params ...interface{}) (*sql.Rows, error) {
	return db.Query(statement, params...)
}

func ExecuteSQLRow(statement string, params ...interface{}) *sql.Row {
	return db.QueryRow(statement, params...)
}

// ExecuteDDL fuehrt eine schreibende Anweisung aus.
//
// Verwarf den Fehler vorher stillschweigend und konnte nil liefern. Damit
// meldeten die Handler auch dann Erfolg, wenn nichts gespeichert wurde.
func ExecuteDDL(statement string, params ...interface{}) (sql.Result, error) {
	return db.Exec(statement, params...)
}

func GetDB() *sql.DB {
	return db
}
