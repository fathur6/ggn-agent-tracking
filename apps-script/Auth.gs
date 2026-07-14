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

function lookupUser_(email) {
  var data = getSheetData_(CONFIG.AGENTS_SHEET_ID, 'Agents');
  if (data.length < 2) return null;
  var startRow = 0;
  if (data.length > 1 && (data[0][0] === '' || data[0][0] === null || data[0][0] === undefined)) {
    startRow = 1;
  }
  var headers = data[startRow];
  var emailCol = headers.indexOf('Email');
  if (emailCol === -1) return null;
  var emailLower = email.toLowerCase();
  for (var i = startRow + 1; i < data.length; i++) {
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
