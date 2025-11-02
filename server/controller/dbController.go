package controller

import (
	"database/sql"
	"fmt"

	_ "github.com/go-sql-driver/mysql"
)

var db *sql.DB
var err error

func InitDB() {
	db, err = sql.Open("mysql", "myuser:gnidmewff112@tcp(130.61.10.8:3306)/minis")
	if err != nil {
		panic(err.Error())
	}
}

func CloseDB() {
	db.Close()
}

func ExecuteSQL(statement string, params ...interface{}) *sql.Rows {
	results, err := db.Query(statement, params...)
	if err != nil {
		fmt.Println("Err", err.Error())
		return nil
	}
	return results
}

func ExecuteSQLRow(statement string, params ...interface{}) *sql.Row {
	return db.QueryRow(statement, params...)
}

func ExecuteDDL(statement string, params ...interface{}) sql.Result {
	result, _ := db.Exec(statement, params...)
	return result
}
