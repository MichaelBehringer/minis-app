import {useState} from 'react';

// Hooks used for user authentication with Tokens
function useToken() {

  function getToken() {
    const userTokenLocal = localStorage.getItem('jwtToken');
    const userTokenSession = sessionStorage.getItem('jwtToken');
    return userTokenLocal ? userTokenLocal : userTokenSession ? userTokenSession : null;
  }

  const [token, setToken] = useState(getToken());

  function saveToken(userToken, remember) {
    if (remember) {
      localStorage.setItem('jwtToken', userToken);
    } else {
      sessionStorage.setItem('jwtToken', userToken);
    }
    setToken(userToken);
  };

  function removeToken() {
    localStorage.removeItem("jwtToken");
    sessionStorage.removeItem("jwtToken");
    setToken(null);
  }
  return {
    setToken: saveToken,
    token,
    removeToken
  };
}

export default useToken;