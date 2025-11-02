package models

type Login struct {
	Username string `json:"username"`
	Password string `json:"password"`
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
