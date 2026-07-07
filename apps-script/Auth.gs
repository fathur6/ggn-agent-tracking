function getCurrentUser_(optEmail) {
  var email = optEmail || '';
  if (!email) {
    try { email = Session.getActiveUser().getEmail(); } catch (ex) {}
  }
  if (!email) throw new Error('Not authenticated');
  var user = lookupUser_(email);
  if (!user) throw new Error('Your email is not registered in the system: ' + email);
  return user;
}

function getGoogleClientId() {
  return CONFIG.GOOGLE_CLIENT_ID || '';
}

function handleOAuthCode_(code, state) {
  var cache = CacheService.getScriptCache();
  var stateKey = 'oauth_state_' + state;
  var stored = cache.get(stateKey);
  if (!stored) throw new Error('Invalid or expired OAuth state');
  cache.remove(stateKey);
  var clientId = CONFIG.GOOGLE_CLIENT_ID || '';
  var clientSecret = CONFIG.GOOGLE_CLIENT_SECRET || '';
  var redirectUri = ScriptApp.getService().getUrl().replace(/\/a\/[^\/]+\/macros\//, '/macros/');
  var tokenPayload = {
    code: code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code'
  };
  var options = {
    method: 'post',
    payload: tokenPayload,
    muteHttpExceptions: true
  };
  var response = UrlFetchApp.fetch('https://oauth2.googleapis.com/token', options);
  var result = JSON.parse(response.getContentText());
  if (!result.id_token) throw new Error('OAuth failed: ' + JSON.stringify(result));
  var parts = result.id_token.split('.');
  var b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
  var payload = JSON.parse(Utilities.newBlob(Utilities.base64Decode(b64)).getDataAsString());
  if (!payload.email) throw new Error('No email in OAuth response');
  if (!payload.email_verified) throw new Error('Email not verified by Google');
  var user = lookupUser_(payload.email);
  if (!user) throw new Error('Your email is not registered in the system: ' + payload.email);
  var sessionToken = Utilities.getUuid();
  cache.put('oauth_session_' + sessionToken, payload.email, 86400);
  return sessionToken;
}

function resolveSessionToken_(token) {
  if (!token) return null;
  var cache = CacheService.getScriptCache();
  var email = cache.get('oauth_session_' + token);
  if (!email) return null;
  var user = lookupUser_(email);
  if (!user) return null;
  return user;
}

function getSessionEmail() {
  try { return Session.getActiveUser().getEmail() || ''; } catch (ex) { return ''; }
}

function verifySessionEmailAndLogin(typedEmail) {
  try {
    var sessionEmail = Session.getActiveUser().getEmail();
    if (sessionEmail && sessionEmail.toLowerCase() !== typedEmail.toLowerCase()) {
      return { success: false, error: 'Google account mismatch. Signed in as ' + sessionEmail + ', but entered ' + typedEmail + '. Please sign out and sign in with the correct Google account first.' };
    }
    if (!typedEmail) throw new Error('Email required');
    var user = lookupUser_(typedEmail);
    if (!user) return { success: false, error: 'Email not registered as agent' };
    return user;
  } catch (e) {
    return { success: false, error: e.message };
  }
}

function loginAgent(email) {
  try {
    if (!email) throw new Error('Email required');
    var user = lookupUser_(email);
    if (!user) throw new Error('Email not registered as agent');
    return user;
  } catch (e) {
    return { success: false, error: e.message };
  }
}

function lookupUser_(email) {
  var data = getSheetData_(CONFIG.AGENTS_SHEET_ID, 'Agents');
  if (data.length <= 1) return null;
  var headers = data[0];
  var emailCol = headers.indexOf('Email');
  if (emailCol === -1) return null;
  var emailLower = email.toLowerCase();
  for (var i = 1; i < data.length; i++) {
    if ((data[i][emailCol] || '').toLowerCase() === emailLower) {
      var row = data[i];
      var agentIdCol = headers.indexOf('AgentID');
      var nameCol = headers.indexOf('Name');
      var roleCol = headers.indexOf('Role');
      var statusCol = headers.indexOf('Status');
      var agentStatus = statusCol !== -1 ? (row[statusCol] || 'active').toLowerCase() : 'active';
      if (agentStatus === 'inactive') throw new Error('Account is inactive');
      return {
        agentId: agentIdCol !== -1 ? row[agentIdCol] : '',
        email: row[emailCol],
        name: nameCol !== -1 ? row[nameCol] : email,
        role: (roleCol !== -1 ? row[roleCol] : 'agent') || 'agent',
      };
    }
  }
  return null;
}
