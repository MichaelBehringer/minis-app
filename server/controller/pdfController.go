package controller

import (
	"bytes"
	"database/sql"
	"fmt"
	"strings"
	"time"

	"github.com/go-pdf/fpdf"
)

// -----------------------------------------------------------------------------
// Configuration & Constants (Theme)
// -----------------------------------------------------------------------------

const (
	ColorPrimaryR, ColorPrimaryG, ColorPrimaryB = 44, 62, 80    // Navy Blue
	ColorAccentR, ColorAccentG, ColorAccentB    = 52, 152, 219  // Bright Blue
	ColorLightR, ColorLightG, ColorLightB       = 245, 245, 245 // Light Grey
	ColorTextR, ColorTextG, ColorTextB          = 50, 50, 50    // Dark Grey text
)

// -----------------------------------------------------------------------------
// Data Structures
// -----------------------------------------------------------------------------

type PdfEvent struct {
	ID        int
	Name      string
	DateBegin string // Format YYYY-MM-DD
	TimeBegin string // Format HH:MM:SS
	Location  string
}

type AssignedUser struct {
	Firstname string
	Lastname  string
}

type FullEvent struct {
	Event PdfEvent
	Users []AssignedUser
}

// -----------------------------------------------------------------------------
// Public Function
// -----------------------------------------------------------------------------

func CreateEventPlanPDF(db *sql.DB, startDate string, endDate string) ([]byte, error) {
	events, err := loadEventsWithAssignedUsers(db, startDate, endDate)
	if err != nil {
		return nil, err
	}

	// Initialize PDF
	pdf := fpdf.New("P", "mm", "A4", "")

	// Note: Ensure these paths are correct for your project structure
	pdf.AddUTF8Font("myArial", "", "ressources/arial-unicode-ms.ttf")
	pdf.AddUTF8Font("myArial", "B", "ressources/arial-unicode-ms-bold.ttf")
	pdf.AddUTF8Font("myArial", "I", "ressources/arial-unicode-ms.ttf") // Using regular as italic placeholder if bold not avail

	// Set Header and Footer
	pdf.SetHeaderFunc(func() { drawHeader(pdf, startDate, endDate) })
	pdf.SetFooterFunc(func() { drawFooter(pdf) })

	// Margins
	pdf.SetMargins(15, 25, 15)
	pdf.AddPage()

	// Draw Events
	for i, ev := range events {
		// Add a visual separator before every event except the first one
		if i > 0 {
			pdf.SetDrawColor(200, 200, 200)
			pdf.Line(15, pdf.GetY(), 195, pdf.GetY())
			pdf.Ln(8) // Padding after line
		}

		drawEventBlock(pdf, ev)
	}

	// Return Bytes
	buf := new(bytes.Buffer)
	err = pdf.Output(buf)
	if err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}

// -----------------------------------------------------------------------------
// Layout & Drawing Functions
// -----------------------------------------------------------------------------

// -----------------------------------------------------------------------------
// PDF HEADER (Mit Logo)
// -----------------------------------------------------------------------------

func drawHeader(pdf *fpdf.Fpdf, start, end string) {
	// 1. Hintergrund-Farbbalken (Navy Blue)
	pdf.SetFillColor(ColorPrimaryR, ColorPrimaryG, ColorPrimaryB)
	pdf.Rect(0, 0, 210, 30, "F")

	// 2. Logo einfügen
	// Pfad: ressources/logo.png
	// X: 10mm, Y: 5mm, Breite: 0 (automatisch proportional), Höhe: 20mm
	pdf.ImageOptions("ressources/logoRemBG.png", 10, 5, 0, 20, false, fpdf.ImageOptions{ReadDpi: true}, 0, "")

	// 3. Titel (Zentriert)
	pdf.SetY(8)
	pdf.SetTextColor(255, 255, 255)
	pdf.SetFont("myArial", "B", 20)
	// Wir nutzen Align "C", das Logo ist links, der Text bleibt in der Mitte der Seite
	pdf.CellFormat(0, 10, "MINISTRANTENPLAN", "", 1, "C", false, 0, "")

	// 4. Untertitel (Datum)
	formattedStart := formatDate(start)
	formattedEnd := formatDate(end)

	pdf.SetFont("myArial", "", 10)
	pdf.CellFormat(0, 6, fmt.Sprintf("%s bis %s", formattedStart, formattedEnd), "", 1, "C", false, 0, "")

	// Margin für den Inhalt zurücksetzen (unterhalb des Headers)
	pdf.SetY(35)
}

// -----------------------------------------------------------------------------
// PDF FOOTER (Mit URL)
// -----------------------------------------------------------------------------

func drawFooter(pdf *fpdf.Fpdf) {
	// Position: 1,5 cm von unten
	pdf.SetY(-15)
	pdf.SetFont("myArial", "", 8)
	pdf.SetTextColor(150, 150, 150)

	// Linke Seite: URL
	// Wir setzen X auf den linken Rand (15mm)
	pdf.SetX(15)
	pdf.CellFormat(0, 10, "https://ministranten.dynv6.net:33333/", "", 0, "L", false, 0, "")

	// Rechte Seite: Seitenzahl
	// Wir setzen X wieder zurück, um "über" die Zeile zu schreiben, aber rechtsbündig
	pdf.SetX(15)
	pdf.CellFormat(0, 10, fmt.Sprintf("Seite %d", pdf.PageNo()), "", 0, "R", false, 0, "")
}

func drawEventBlock(pdf *fpdf.Fpdf, ev FullEvent) {
	// 1. Calculate Heights to check for Page Break
	// Use a temporary Y check. If too low, AddPage.
	_, pageHeight := pdf.GetPageSize()
	_, _, _, bottomMargin := pdf.GetMargins()

	// Estimate height: Title (8) + Loc (6) + (Users lines * 5) + Buffer(10)
	userLines := float64((len(ev.Users) + 1) / 2) // 2 users per line approximation
	if len(ev.Users) == 0 {
		userLines = 1
	}
	neededHeight := 14.0 + (userLines * 6.0) + 10.0

	if pdf.GetY()+neededHeight > pageHeight-bottomMargin {
		pdf.AddPage()
	}

	// Save current Y
	startY := pdf.GetY()

	// --- LEFT COLUMN: DATE & TIME (Width: 35mm) ---
	pdf.SetTextColor(ColorPrimaryR, ColorPrimaryG, ColorPrimaryB)
	pdf.SetFont("myArial", "B", 11)

	// Format Date: "Sun, 24.12."
	dateStr := formatDateShort(ev.Event.DateBegin)
	timeStr := ""
	if len(ev.Event.TimeBegin) >= 5 {
		timeStr = ev.Event.TimeBegin[:5] + " Uhr"
	}

	pdf.CellFormat(35, 6, dateStr, "", 2, "L", false, 0, "")

	pdf.SetFont("myArial", "", 10)
	pdf.SetTextColor(100, 100, 100)
	pdf.CellFormat(35, 5, timeStr, "", 0, "L", false, 0, "")

	// Return to top of row for Right Column
	pdf.SetXY(50, startY)

	// --- RIGHT COLUMN: CONTENT (Width: Remaining) ---

	// Event Name
	pdf.SetTextColor(ColorTextR, ColorTextG, ColorTextB)
	pdf.SetFont("myArial", "B", 12)
	pdf.CellFormat(0, 6, ev.Event.Name, "", 1, "L", false, 0, "")

	// Location
	pdf.SetXY(50, pdf.GetY())                                  // Indent
	pdf.SetTextColor(ColorAccentR, ColorAccentG, ColorAccentB) // Blue accent
	pdf.SetFont("myArial", "", 10)
	pdf.CellFormat(0, 6, strings.ToUpper(ev.Event.Location), "", 1, "L", false, 0, "")

	// Spacing before users
	pdf.SetXY(50, pdf.GetY()+2)

	// Users List
	if len(ev.Users) > 0 {
		drawUserGrid(pdf, ev.Users)
	} else {
		pdf.SetXY(50, pdf.GetY())
		pdf.SetTextColor(150, 150, 150)
		pdf.SetFont("myArial", "I", 10)
		pdf.Cell(0, 6, "- Keine Einteilung -")
		pdf.Ln(10)
	}

	// Add bottom padding
	pdf.Ln(6)
}

func drawUserGrid(pdf *fpdf.Fpdf, users []AssignedUser) {
	// Settings
	pdf.SetTextColor(ColorTextR, ColorTextG, ColorTextB)
	pdf.SetFont("myArial", "", 10)

	// We will print users in 2 columns to save space
	// Column 1 starts at X=50, Column 2 starts at X=120
	col1X := 50.0
	col2X := 125.0
	lineHeight := 5.0

	currentY := pdf.GetY()

	for i, u := range users {
		name := fmt.Sprintf("• %s %s", u.Firstname, u.Lastname)

		if i%2 == 0 {
			// Left Column
			pdf.SetXY(col1X, currentY)
			pdf.Cell(70, lineHeight, name)
		} else {
			// Right Column
			pdf.SetXY(col2X, currentY)
			pdf.Cell(70, lineHeight, name)
			// Move Y down after filling the row
			currentY += lineHeight
		}
	}

	// If we ended on an even number (left col filled), we need to advance Y
	if len(users)%2 != 0 {
		currentY += lineHeight
	}

	pdf.SetY(currentY)
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

// Helper: Turns "2023-12-24" into "24.12.2023"
func formatDate(dbDate string) string {
	t, err := time.Parse("2006-01-02", dbDate)
	if err != nil {
		return dbDate
	}
	return t.Format("02.01.2006")
}

// Helper: Turns "2023-12-24" into "So, 24.12." (German Short)
func formatDateShort(dbDate string) string {
	t, err := time.Parse("2006-01-02", dbDate)
	if err != nil {
		return dbDate
	}

	// Quick German translation for weekdays
	weekdays := []string{"So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"}
	wd := weekdays[t.Weekday()]

	return fmt.Sprintf("%s, %s", wd, t.Format("02.01."))
}

// -----------------------------------------------------------------------------
// DB Code (Unchanged logic, just minified for context)
// -----------------------------------------------------------------------------

func loadEventsWithAssignedUsers(db *sql.DB, startDate string, endDate string) ([]FullEvent, error) {
	queryEvents := `SELECT e.id, e.name, e.date_begin, e.time_begin, l.name FROM event e LEFT JOIN location l ON e.location_id = l.id WHERE e.date_begin BETWEEN ? AND ? ORDER BY e.date_begin, e.time_begin`
	rows, err := db.Query(queryEvents, startDate, endDate)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []FullEvent
	for rows.Next() {
		var ev PdfEvent
		if err := rows.Scan(&ev.ID, &ev.Name, &ev.DateBegin, &ev.TimeBegin, &ev.Location); err != nil {
			return nil, err
		}
		users, _ := loadAssignedUsers(db, ev.ID) // Error handling omitted for brevity
		result = append(result, FullEvent{Event: ev, Users: users})
	}
	return result, nil
}

func loadAssignedUsers(db *sql.DB, eventID int) ([]AssignedUser, error) {
	queryUsers := `SELECT u.firstname, u.lastname FROM plan p INNER JOIN user u ON p.user_id = u.id WHERE p.event_id = ? ORDER BY u.lastname, u.firstname`
	rows, err := db.Query(queryUsers, eventID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var users []AssignedUser
	for rows.Next() {
		var u AssignedUser
		rows.Scan(&u.Firstname, &u.Lastname)
		users = append(users, u)
	}
	return users, nil
}
