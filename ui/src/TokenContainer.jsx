import { useEffect } from 'react';
import App from './components/App';
import Authentication from './components/Authentication';
import { registerTokenRenewalHandler, registerUnauthorizedHandler } from './helper/RequestHelper';
import { myToastInfo } from './helper/ToastHelper';
import useToken from "./hooks/useToken";

function TokenContainer() {
	const { token, removeToken, setToken, erneuereToken } = useToken();

	// Wird das Token waehrend der Nutzung ungueltig - weil es abgelaufen ist
	// oder der Server mit neuem Signaturschluessel neu gestartet wurde -, laeuft
	// der Nutzer sonst in Fehlermeldung nach Fehlermeldung, bis er die App von
	// Hand neu oeffnet. Der Interceptor in RequestHelper meldet das hierher und
	// wir beenden die Sitzung geordnet.
	useEffect(() => {
		registerUnauthorizedHandler(() => {
			myToastInfo('Sitzung abgelaufen. Bitte neu anmelden.');
			removeToken();
		});
	}, [removeToken, token]);

	// Die Gegenrichtung: der Server verlaengert die Sitzung, sobald die Haelfte
	// der Gueltigkeit vorbei ist, und legt das neue Token in den Antwortkopf.
	// Ohne diesen Empfang liefe die Anmeldung trotz taeglicher Nutzung ab.
	useEffect(() => {
		registerTokenRenewalHandler(erneuereToken);
	}, [erneuereToken]);

	return (
		<div>
			{!token && token !== "" && token !== undefined ?
				<Authentication setToken={setToken} /> : <App token={token} removeToken={removeToken} />}
		</div>
	);
}

export default TokenContainer;
