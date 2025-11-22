package controller

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"log"
	"math"
	"strings"
	"time"
)

/*
AssignUsersToEvent

- Purpose: Automatically assign users to an event according to the rules provided.
- Signature: func AssignUsersToEvent(eventID int, db *sql.DB) error
- Behavior:
  1. Loads the event (to know date and minimalUser).
  2. Loads all active users and related data (weekdays, bans for event date, last plan date, preferences).
  3. Iteratively selects the user with the highest computed score and inserts them into plan.
  4. Uses prepared statements, transactions, and logs important steps/errors.

Ranking & weights (exposed here as constants for easy tuning):
- baseScore = 1.0 for all active/eligible users
- fairnessWeight = 2.5 (high importance) -> scales with log(daysSinceLastAssignment+1)
- preferenceWeight = 2.0 (high importance) -> applied when preferred partner is already selected
- incenseWeight = 0.5 (medium/low) -> small boost when event requires/incense incentive
- If user is excluded by ban or weekday or inactive -> they are ineligible (score 0)

Note: The algorithm selects deterministically the highest-score user each iteration (greedy).
*/

type AssignEvent struct {
	ID          int
	Name        string
	DateBegin   time.Time // date only (time zeroed)
	MinimalUser int
}

type AssignUser struct {
	ID        int
	FirstName string
	LastName  string
	Active    bool
	Incense   bool
	// dynamic fields:
	LastAssigned *time.Time // nil if never assigned
	Weekdays     map[string]bool
	Excluded     bool // true if ban or weekday mismatch or inactive
	Score        float64
}

// preference graph: for each user id, list of partner ids they prefer to be together with
type Preferences map[int][]int

// weights - tuneable
const (
	baseScore        = 1.0
	fairnessWeight   = 1.8 // high importance
	preferenceWeight = 6.0 // high importance
	incenseWeight    = 0.7 // moderate / light influence
	// a maxDaysSince to avoid extreme values; if someone never assigned, treat as large days
	neverAssignedDays = 3650 // ~10 years effectively "very long"
)

// AssignUsersToEvent assigns users to the given eventID using the described rules.
// Uses a DB transaction and prepared statements. Returns error on failure.
func AssignUsersToEvent(eventID int, db *sql.DB) error {
	fmt.Println("1")
	ctx := context.Background()

	// Start transaction to keep selection + inserts consistent
	tx, err := db.BeginTx(ctx, &sql.TxOptions{Isolation: sql.LevelSerializable})
	if err != nil {
		return fmt.Errorf("begin txn: %w", err)
	}
	fmt.Println("2")
	// Ensure we either commit or rollback
	committed := false
	defer func() {
		if !committed {
			if rerr := tx.Rollback(); rerr != nil && rerr != sql.ErrTxDone {
				log.Printf("rollback failed: %v", rerr)
			}
		}
	}()

	fmt.Println("3")
	// 1) Load event
	event, err := loadEvent(ctx, tx, eventID)
	if err != nil {
		return fmt.Errorf("load event: %w", err)
	}
	log.Printf("Event loaded: id=%d name=%q date=%s minimalUser=%d", event.ID, event.Name, event.DateBegin.Format("2006-01-02"), event.MinimalUser)

	fmt.Println("4")
	// 2) Load all active users
	users, err := loadActiveUsers(ctx, tx)
	if err != nil {
		return fmt.Errorf("load active users: %w", err)
	}
	if len(users) == 0 {
		return errors.New("no users found in system")
	}
	log.Printf("Active users loaded: count=%d", len(users))

	fmt.Println("5")
	// 3) Load user weekdays
	if err := populateUserWeekdays(ctx, tx, users); err != nil {
		return fmt.Errorf("populate user weekdays: %w", err)
	}

	fmt.Println("6")
	// 4) Load bans for event date
	if err := populateBansForDate(ctx, tx, users, event.DateBegin); err != nil {
		return fmt.Errorf("populate bans: %w", err)
	}

	fmt.Println("7")
	// 5) Load last assignment date per user (plan)
	if err := populateLastAssigned(ctx, tx, users); err != nil {
		return fmt.Errorf("populate last assigned: %w", err)
	}

	fmt.Println("8")
	// 6) Load preferences together
	prefs, err := loadPreferences(ctx, tx)
	if err != nil {
		return fmt.Errorf("load preferences: %w", err)
	}

	// 7) Initialize ineligible/excluded users (ban, weekday, active false)
	eventWeekday := strings.ToUpper(event.DateBegin.Weekday().String()[:3]) // "Mon", "Tue", ...
	for _, u := range users {
		// inactive check is already done: we only loaded active users, but keep the field check for safety
		if !u.Active {
			u.Excluded = true
			continue
		}
		// weekday check: user must have eventWeekday in user_weekday table
		if !u.Weekdays[eventWeekday] {
			u.Excluded = true
			continue
		}
		// bans were set earlier; populateBansForDate sets Excluded = true if banned
		// so nothing more here
	}

	// 8) Prepare insert statement for plan
	insertPlanStmt, err := tx.PrepareContext(ctx, "INSERT INTO plan (user_id, event_id) VALUES (?, ?)")
	if err != nil {
		return fmt.Errorf("prepare insert plan: %w", err)
	}
	defer insertPlanStmt.Close()

	// 9) Optionally: check how many already assigned (maybe some entries exist), avoid duplicates
	currentAssignedCount, err := countAssignedForEvent(ctx, tx, event.ID)
	if err != nil {
		return fmt.Errorf("count assigned: %w", err)
	}
	if currentAssignedCount >= event.MinimalUser {
		log.Printf("Event %d already has %d assigned (>= minimalUser %d). Nothing to do.", event.ID, currentAssignedCount, event.MinimalUser)
		if err := tx.Commit(); err != nil {
			return fmt.Errorf("commit after no-op: %w", err)
		}
		committed = true
		return nil
	}
	toAssign := event.MinimalUser - currentAssignedCount
	log.Printf("Need to assign %d more users (event minimalUser=%d currentAssigned=%d)", toAssign, event.MinimalUser, currentAssignedCount)

	fmt.Println("9")
	// 10) Iteratively select best candidate and insert into plan
	selected := make(map[int]bool) // userID -> selected
	// If some users are already in plan for this event, mark them as selected to influence preferences.
	if err := markAlreadyAssigned(ctx, tx, event.ID, selected); err != nil {
		return fmt.Errorf("mark already assigned: %w", err)
	}
	fmt.Println("10")

	for assigned := 0; assigned < toAssign; assigned++ {
		// compute scores for all non-excluded and non-selected users
		best := -1
		bestScore := -math.MaxFloat64
		for _, u := range users {
			if u.Excluded {
				continue
			}
			if selected[u.ID] {
				continue
			}

			score := computeUserScore(u, prefs, selected, event.MinimalUser, event.DateBegin)
			u.Score = score
			if score > bestScore {
				bestScore = score
				best = u.ID
			}
			fmt.Printf("score: %.4f user %d \n", score, u.ID)
		}

		if best == -1 || bestScore <= 0 {
			// No eligible candidate left with positive score; log and break (partial assignments kept)
			log.Printf("No more eligible users to assign (assigned so far=%d, needed total=%d). Breaking.", assigned, toAssign)
			break
		}

		// Insert into plan
		if _, err := insertPlanStmt.ExecContext(ctx, best, event.ID); err != nil {
			// If insertion violates unique constraint, mark user as selected or excluded and continue
			// We treat error as fatal unless it's a duplicate user/event entry
			// Assume MySQL error code 1062 for duplicate entry (unique_user_event)
			log.Printf("insert plan for user %d failed: %v", best, err)
			// attempt to mark user excluded and continue
			markUserExcluded(users, best)
			assigned-- // don't count this iteration
			continue
		}
		selected[best] = true
		log.Printf("Assigned user %d to event %d (score=%.4f)", best, event.ID, bestScore)
	}
	fmt.Println("11")

	// Optionally, we can attempt incense rule check/logging: if minimalUser>=8 we tried to bias for incense,
	// but we do not enforce strictness. So we only log result.
	incenseCount, err := countIncenseAssigned(ctx, tx, event.ID)
	if err != nil {
		// non-fatal: continue
		log.Printf("warning: couldn't count incense assigned: %v", err)
	} else {
		if event.MinimalUser >= 8 && incenseCount < 2 {
			log.Printf("Note: event %d minimalUser>=8 but only %d incense users were assigned (preferred >=2).", event.ID, incenseCount)
		}
	}

	// Commit transaction
	if err := tx.Commit(); err != nil {
		return fmt.Errorf("commit tx: %w", err)
	}
	committed = true
	log.Printf("Assignment complete for event %d", event.ID)
	return nil
}

/* -------------------------
   Helper functions below
   ------------------------- */

func dateOnly(t time.Time) time.Time {
	year, month, day := t.Date()
	return time.Date(year, month, day, 0, 0, 0, 0, time.UTC)
}

// loadEvent loads event row by id. Expects tx (transaction) context.
func loadEvent(ctx context.Context, tx *sql.Tx, eventID int) (*AssignEvent, error) {
	stmt, err := tx.PrepareContext(ctx,
		"SELECT id, name, date_begin, minimalUser FROM event WHERE id = ? FOR UPDATE")
	if err != nil {
		return nil, err
	}
	defer stmt.Close()

	var (
		id      int
		name    sql.NullString
		dateStr sql.NullString // <-- FIX: scan DATE into string
		minimal sql.NullInt64
	)

	err = stmt.QueryRowContext(ctx, eventID).Scan(&id, &name, &dateStr, &minimal)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, fmt.Errorf("event %d not found", eventID)
		}
		return nil, err
	}

	if !dateStr.Valid || dateStr.String == "" {
		return nil, fmt.Errorf("event %d has no date_begin set", eventID)
	}

	// Parse date string "YYYY-MM-DD"
	parsedDate, err := time.Parse("2006-01-02", dateStr.String)
	if err != nil {
		return nil, fmt.Errorf("invalid date_begin format for event %d: %w", eventID, err)
	}

	ev := &AssignEvent{
		ID:          id,
		Name:        name.String,
		DateBegin:   parsedDate,
		MinimalUser: int(minimal.Int64),
	}

	return ev, nil
}

// loadActiveUsers returns a slice of pointers to User for all users with active = 1
func loadActiveUsers(ctx context.Context, tx *sql.Tx) ([]*AssignUser, error) {
	stmt, err := tx.PrepareContext(ctx, "SELECT id, firstname, lastname, active, COALESCE(incense,0) FROM `user` WHERE active = 1")
	if err != nil {
		return nil, err
	}
	defer stmt.Close()

	rows, err := stmt.QueryContext(ctx)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var users []*AssignUser
	for rows.Next() {
		var id int
		var firstname, lastname sql.NullString
		var activeInt int
		var incenseInt int
		if err := rows.Scan(&id, &firstname, &lastname, &activeInt, &incenseInt); err != nil {
			return nil, err
		}
		u := &AssignUser{
			ID:        id,
			FirstName: firstname.String,
			LastName:  lastname.String,
			Active:    activeInt == 1,
			Incense:   incenseInt == 1,
			Weekdays:  make(map[string]bool),
		}
		users = append(users, u)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return users, nil
}

// populateUserWeekdays fills each user's Weekdays map from user_weekday table
func populateUserWeekdays(ctx context.Context, tx *sql.Tx, users []*AssignUser) error {
	// Build a map for quick lookup userID->*User
	userMap := make(map[int]*AssignUser, len(users))
	for _, u := range users {
		userMap[u.ID] = u
	}
	stmt, err := tx.PrepareContext(ctx, "SELECT user_id, weekday FROM user_weekday WHERE user_id IN (?)")
	// The above won't work with a single placeholder for IN list; to be robust, query without IN by scanning all rows where user_id in set.
	// Simpler: fetch all user_weekday rows and filter locally (cheap w.r.t. simplicity).
	stmt.Close() // we will do a different query
	rows, err := tx.QueryContext(ctx, "SELECT user_id, weekday FROM user_weekday")
	if err != nil {
		return err
	}
	defer rows.Close()
	for rows.Next() {
		var uid sql.NullInt64
		var weekday sql.NullString
		if err := rows.Scan(&uid, &weekday); err != nil {
			return err
		}
		if !uid.Valid || !weekday.Valid {
			continue
		}
		u, ok := userMap[int(uid.Int64)]
		if !ok {
			continue
		}
		// store as first 3 letters e.g. "Mon"
		wd := weekday.String
		if len(wd) >= 3 {
			u.Weekdays[wd[:3]] = true
		} else {
			u.Weekdays[wd] = true
		}
	}
	return rows.Err()
}

// populateBansForDate marks users.Excluded = true if they have a ban on the event date
func populateBansForDate(ctx context.Context, tx *sql.Tx, users []*AssignUser, date time.Time) error {
	// Create map userID -> *User
	userMap := make(map[int]*AssignUser, len(users))
	for _, u := range users {
		userMap[u.ID] = u
	}

	stmt, err := tx.PrepareContext(ctx, "SELECT user_id FROM ban WHERE ban_date = ?")
	if err != nil {
		return err
	}
	defer stmt.Close()

	rows, err := stmt.QueryContext(ctx, date.Format("2006-01-02"))
	if err != nil {
		return err
	}
	defer rows.Close()
	for rows.Next() {
		var uid sql.NullInt64
		if err := rows.Scan(&uid); err != nil {
			return err
		}
		if !uid.Valid {
			continue
		}
		if u, ok := userMap[int(uid.Int64)]; ok {
			u.Excluded = true
		}
	}
	return rows.Err()
}

// populateLastAssigned fills LastAssigned for each user by querying plan table (latest event date)
func populateLastAssigned(ctx context.Context, tx *sql.Tx, users []*AssignUser) error {
	userMap := make(map[int]*AssignUser, len(users))
	for _, u := range users {
		userMap[u.ID] = u
	}
	// We need the latest event date for each user's last assignment:
	// SELECT p.user_id, MAX(e.date_begin) FROM plan p JOIN event e ON p.event_id = e.id WHERE p.user_id IN (...) GROUP BY p.user_id;
	// For simplicity and portability, fetch joins and filter locally.
	rows, err := tx.QueryContext(ctx, `
		SELECT p.user_id, e.date_begin
		FROM plan p
		JOIN event e ON p.event_id = e.id
		ORDER BY p.user_id, e.date_begin DESC`)
	if err != nil {
		return err
	}
	defer rows.Close()

	// We'll keep the first seen (latest) date per user.
	seen := make(map[int]bool)
	for rows.Next() {
		var uid sql.NullInt64
		var dt sql.NullString
		if err := rows.Scan(&uid, &dt); err != nil {
			fmt.Println(err)
			return err
		}
		if !uid.Valid || !dt.Valid {
			continue
		}
		id := int(uid.Int64)
		if seen[id] {
			continue
		}
		if u, ok := userMap[id]; ok {
			t, _ := time.Parse("2006-01-02", dt.String)
			t = time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, t.Location())
			u.LastAssigned = &t
			seen[id] = true
		}
	}
	return rows.Err()
}

// loadPreferences loads preference_together table into Preferences map
func loadPreferences(ctx context.Context, tx *sql.Tx) (Preferences, error) {
	rows, err := tx.QueryContext(ctx, "SELECT user_id_1, user_id_2 FROM preference_together")
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	prefs := make(Preferences)
	for rows.Next() {
		var a sql.NullInt64
		var b sql.NullInt64
		if err := rows.Scan(&a, &b); err != nil {
			return nil, err
		}
		if !a.Valid || !b.Valid {
			continue
		}
		ai := int(a.Int64)
		bi := int(b.Int64)
		prefs[ai] = append(prefs[ai], bi)
		prefs[bi] = append(prefs[bi], ai) // preferences are symmetric for boosting
	}
	return prefs, rows.Err()
}

// computeUserScore computes the ranking score for a single user given current selections and preferences.
func computeUserScore(u *AssignUser, prefs Preferences, selected map[int]bool, minimalUser int, eventDate time.Time) float64 {
	// If user excluded or inactive: score 0
	if u == nil || u.Excluded || !u.Active {
		return 0.0
	}
	score := baseScore

	// 1) Fairness: higher if user hasn't been assigned recently
	// We use daysSince = days between today and lastAssigned; log-scale growth to avoid extremes.
	nowDate := dateOnly(eventDate)

	var daysSince float64
	if u.LastAssigned == nil {
		daysSince = neverAssignedDays
	} else {
		last := dateOnly(*u.LastAssigned)

		// Zeitdifferenz rein nach Datum
		d := nowDate.Sub(last)
		daysSince = math.Abs(math.Floor(d.Hours() / 24))

		/*if daysSince < 0 {
			daysSince = 0
		}*/
	}

	fairnessContribution := fairnessWeight * daysSince
	score += fairnessContribution

	fmt.Printf("daysSince: %.4f fairnessContribution %.4f u.LastAssigned %s    ", daysSince, fairnessContribution, u.LastAssigned)

	// 2) Preferences: if any preferred partner already selected, boost
	if partners, ok := prefs[u.ID]; ok && len(partners) > 0 {
		for _, p := range partners {
			if selected[p] {
				score += preferenceWeight
			}
		}
	}

	// 3) Incense rule: slight boost when event large (we don't get event here; pass minimalUser)
	if minimalUser >= 8 && u.Incense {
		score += incenseWeight
	}

	// Ensure numeric stability
	if math.IsNaN(score) || math.IsInf(score, 0) {
		return baseScore
	}
	return score
}

// markUserExcluded finds the user in the slice and marks them excluded (helper after insertion error)
func markUserExcluded(users []*AssignUser, userID int) {
	for _, u := range users {
		if u.ID == userID {
			u.Excluded = true
			return
		}
	}
}

// countAssignedForEvent returns number of plan rows for event
func countAssignedForEvent(ctx context.Context, tx *sql.Tx, eventID int) (int, error) {
	stmt, err := tx.PrepareContext(ctx, "SELECT COUNT(*) FROM plan WHERE event_id = ?")
	if err != nil {
		return 0, err
	}
	defer stmt.Close()
	var cnt int
	if err := stmt.QueryRowContext(ctx, eventID).Scan(&cnt); err != nil {
		return 0, err
	}
	return cnt, nil
}

// markAlreadyAssigned loads existing plan.user_id rows for the event and marks them as selected
func markAlreadyAssigned(ctx context.Context, tx *sql.Tx, eventID int, selected map[int]bool) error {
	rows, err := tx.QueryContext(ctx,
		"SELECT user_id FROM plan WHERE event_id = ?",
		eventID,
	)

	if err != nil {

		fmt.Println(err)

		return err
	}
	defer rows.Close()
	for rows.Next() {
		var uid sql.NullInt64
		if err := rows.Scan(&uid); err != nil {
			return err
		}
		if !uid.Valid {
			continue
		}
		selected[int(uid.Int64)] = true
	}
	return rows.Err()
}

// countIncenseAssigned counts assigned plan entries for which user.incense = 1 for the event
func countIncenseAssigned(ctx context.Context, tx *sql.Tx, eventID int) (int, error) {
	// join plan and user
	stmt, err := tx.PrepareContext(ctx, "SELECT COUNT(*) FROM plan p JOIN `user` u ON p.user_id = u.id WHERE p.event_id = ? AND COALESCE(u.incense,0) = 1")
	if err != nil {
		return 0, err
	}
	defer stmt.Close()
	var cnt int
	if err := stmt.QueryRowContext(ctx, eventID).Scan(&cnt); err != nil {
		return 0, err
	}
	return cnt, nil
}
