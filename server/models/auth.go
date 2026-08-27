package models

type Login struct {
	Username string `json:"username"`
	Password string `json:"password"`
	// Remember ist das Haekchen "Angemeldet bleiben". Es entscheidet ueber die
	// Gueltigkeitsdauer des Tokens - bisher lag diese Wahl allein beim
	// Frontend, das das Token je nachdem in localStorage oder sessionStorage
	// gelegt hat. Der Server hat immer dieselbe Dauer ausgegeben.
	Remember bool `json:"remember"`
}

type ResponseText struct {
	Reason string `json:"reason"`
}

type AccessToken struct {
	AccessToken string `json:"accessToken"`
}

type AuthHeader struct {
	IDToken string `header:"Authorization"`
}
