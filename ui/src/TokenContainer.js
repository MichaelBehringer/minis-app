
import React from 'react';
import App from './components/App';
import Authentication from './components/Authentication';
import useToken from "./hooks/useToken";

function TokenContainer() {
	const {token, removeToken, setToken} = useToken();

	return (
		<div>
			{!token && token !== "" && token !== undefined ?
				<Authentication setToken={setToken} /> : <App token={token} removeToken={removeToken}/>}
		</div>
	);
}

export default TokenContainer;
