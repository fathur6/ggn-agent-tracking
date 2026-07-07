function doGet(e) {
  var page = e && e.parameter && e.parameter.page;
  if (page === 'public') {
    var template = HtmlService.createTemplateFromFile('PublicForm');
    template.formId = (e && e.parameter && e.parameter.formId) || '';
    template.agentId = (e && e.parameter && e.parameter.agentId) || '';
    return template
      .evaluate()
      .setTitle('UniSZA Application')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }
  var code = e && e.parameter && e.parameter.code;
  var state = e && e.parameter && e.parameter.state;
  if (code && state) {
    try {
      var sessionToken = handleOAuthCode_(code, state);
      var baseUrl = ScriptApp.getService().getUrl();
      return HtmlService.createHtmlOutput(
        '<script>window.top.location.href="' + baseUrl.replace(/"/g, '&quot;') + '?session=' + encodeURIComponent(sessionToken) + '";</script>'
      ).setTitle('Redirecting...');
    } catch (err) {
      var baseUrl = ScriptApp.getService().getUrl();
      return HtmlService.createHtmlOutput(
        '<script>window.top.location.href="' + baseUrl.replace(/"/g, '&quot;') + '?error=' + encodeURIComponent(err.message) + '";</script>'
      ).setTitle('Redirecting...');
    }
  }
  var oauthState = Utilities.getUuid();
  CacheService.getScriptCache().put('oauth_state_' + oauthState, 'pending', 600);
  var oauthClientId = CONFIG.GOOGLE_CLIENT_ID || '';
  var appUrl = ScriptApp.getService().getUrl().replace(/\/a\/[^\/]+\/macros\//, '/macros/');
  var sess = e && e.parameter && e.parameter.session;
  if (sess) {
    var sessUser = resolveSessionToken_(sess);
    var template = HtmlService.createTemplateFromFile('Index');
    template.sessionEmail = sessUser ? sessUser.email : '';
    template.sessionUser = sessUser ? JSON.stringify(sessUser) : '';
    template.oauthClientId = oauthClientId;
    template.oauthState = oauthState;
    template.oauthRedirectUri = appUrl;
    return template
      .evaluate()
      .setTitle('UGS Agent Tracking')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
  }
  var errMsg = e && e.parameter && e.parameter.error;
  var template = HtmlService.createTemplateFromFile('Index');
  template.sessionEmail = '';
  template.sessionUser = '';
  template.oauthError = errMsg || '';
  template.oauthClientId = oauthClientId;
  template.oauthState = oauthState;
  template.oauthRedirectUri = appUrl;
  return template
    .evaluate()
    .setTitle('UGS Agent Tracking')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function getMe(userEmail) {
  try {
    var user = getCurrentUser_(userEmail);
    return { success: true, user: user };
  } catch (e) {
    var email = '';
    try { email = Session.getActiveUser().getEmail(); } catch (ex) { /* ignore */ }
    return { success: false, error: e.message, email: email };
  }
}

function getMyEmail() {
  try {
    return { success: true, email: Session.getActiveUser().getEmail() };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

function getAgents(userEmail) {
  try {
    var user = getCurrentUser_(userEmail);
    if (user.role !== 'admin') throw new Error('Admin only');
    var data = getSheetObjects_(CONFIG.AGENTS_SHEET_ID, 'Agents');
    return { success: true, agents: data };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

function createAgent(agentData, userEmail) {
  try {
    var user = getCurrentUser_(userEmail);
    if (user.role !== 'admin') throw new Error('Admin only');
    if (!agentData.name || !agentData.email) throw new Error('Name and email required');

    var sheet = getSheetByName_(CONFIG.AGENTS_SHEET_ID, 'Agents');
    var data = sheet.getDataRange().getValues();
    var headers = data[0];
    var emailCol = headers.indexOf('Email');
    if (emailCol !== -1) {
      for (var i = 1; i < data.length; i++) {
        if ((data[i][emailCol] || '').toLowerCase() === agentData.email.toLowerCase()) {
          throw new Error('Email already registered');
        }
      }
    }

    var agentId = 'AGT' + Date.now();
    var role = agentData.role || 'agent';
    if (role !== 'agent' && role !== 'admin') throw new Error('Invalid role');

    var names = [agentId, agentData.name, agentData.email, role, 'active', new Date().toISOString()];
    sheet.appendRow(names);
    return { success: true, agentId: agentId };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

function updateAgent(agentId, updates, userEmail) {
  try {
    var user = getCurrentUser_(userEmail);
    if (user.role !== 'admin') throw new Error('Admin only');

    var data = getSheetData_(CONFIG.AGENTS_SHEET_ID, 'Agents');
    var headers = data[0];
    var agentIdCol = headers.indexOf('AgentID');
    if (agentIdCol === -1) throw new Error('AgentID column not found');

    var rowIndex = -1;
    for (var i = 1; i < data.length; i++) {
      if (data[i][agentIdCol] === agentId) { rowIndex = i; break; }
    }
    if (rowIndex === -1) throw new Error('Agent not found');

    if (updates.name !== undefined) updateCell_(CONFIG.AGENTS_SHEET_ID, 'Agents', rowIndex, headers.indexOf('Name'), updates.name);
    if (updates.role !== undefined) {
      if (updates.role !== 'agent' && updates.role !== 'admin') throw new Error('Invalid role');
      updateCell_(CONFIG.AGENTS_SHEET_ID, 'Agents', rowIndex, headers.indexOf('Role'), updates.role);
    }
    if (updates.status !== undefined) {
      if (updates.status !== 'active' && updates.status !== 'inactive') throw new Error('Invalid status');
      updateCell_(CONFIG.AGENTS_SHEET_ID, 'Agents', rowIndex, headers.indexOf('Status'), updates.status);
    }
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

function deleteAgent(agentId, userEmail) {
  try {
    var user = getCurrentUser_(userEmail);
    if (user.role !== 'admin') throw new Error('Admin only');
    
    var data = getSheetData_(CONFIG.AGENTS_SHEET_ID, 'Agents');
    var headers = data[0];
    var agentIdCol = headers.indexOf('AgentID');
    var statusCol = headers.indexOf('Status');
    if (agentIdCol === -1 || statusCol === -1) throw new Error('Required columns not found');
    
    for (var i = 1; i < data.length; i++) {
      if (data[i][agentIdCol] === agentId) {
        var currentStatus = (data[i][statusCol] || '').toLowerCase();
        if (currentStatus === 'inactive') {
          var sheet = getSheetByName_(CONFIG.AGENTS_SHEET_ID, 'Agents');
          sheet.deleteRow(i + 1);
          return { success: true, action: 'permanent' };
        } else {
          updateCell_(CONFIG.AGENTS_SHEET_ID, 'Agents', i, statusCol, 'inactive');
          return { success: true, action: 'deactivated' };
        }
      }
    }
    throw new Error('Agent not found');
  } catch (e) {
    return { success: false, error: e.message };
  }
}

function getAgentNameMap_() {
  var map = {};
  var data = getSheetData_(CONFIG.AGENTS_SHEET_ID, 'Agents');
  if (data.length <= 1) return map;
  var headers = data[0];
  var idCol = headers.indexOf('AgentID');
  var nameCol = headers.indexOf('Name');
  if (idCol === -1 || nameCol === -1) return map;
  for (var i = 1; i < data.length; i++) {
    map[data[i][idCol]] = data[i][nameCol];
  }
  return map;
}

function getLeads(filters, userEmail) {
  try {
    var user = getCurrentUser_(userEmail);
    var leads = getSheetObjects_(CONFIG.LEADS_SHEET_ID, 'Leads');
    var agentNameMap = getAgentNameMap_();

    leads.forEach(function (l) {
      var agentId = getLeadAgent_(l);
      l.AgentName = agentNameMap[agentId] || agentId;
    });

    if (user.role === 'agent') {
      leads = leads.filter(function (l) {
        var agentVal = getLeadAgent_(l);
        return agentVal === user.agentId || agentVal === user.name;
      });
    }

    var showDeleted = filters && filters.showDeleted;
    if (!showDeleted) {
      leads = leads.filter(function (l) { return l.Status !== 'Deleted'; });
    }

    if (filters) {
      if (filters.status) {
        leads = leads.filter(function (l) { return l.Status === filters.status; });
      }
      if (filters.agent && user.role === 'admin') {
        leads = leads.filter(function (l) { return l.AgentName === filters.agent; });
      }
      if (filters.dateFrom) {
        leads = leads.filter(function (l) {
          return (l.Timestamp || '') >= filters.dateFrom;
        });
      }
      if (filters.dateTo) {
        leads = leads.filter(function (l) {
          return (l.Timestamp || '') <= (filters.dateTo + 'T23:59:59.999Z');
        });
      }
    }

    leads.sort(function (a, b) { return (b.Timestamp || '').localeCompare(a.Timestamp || ''); });
    return { success: true, leads: leads };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

function getLead(appId, userEmail) {
  try {
    var user = getCurrentUser_(userEmail);
    var found = findRowByColumn_(CONFIG.LEADS_SHEET_ID, 'Leads', 'Reference', appId);
    if (!found) throw new Error('Lead not found');
    
    var headers = getSheetData_(CONFIG.LEADS_SHEET_ID, 'Leads')[0];
    var agentCol = getAgentCol_(headers);
    if (user.role === 'agent' && agentCol !== -1 && String(found.rowData[agentCol]) !== user.agentId && String(found.rowData[agentCol]) !== user.name) {
      throw new Error('Access denied');
    }
    
    var lead = {};
    headers.forEach(function (h, i) { lead[h] = found.rowData[i] || ''; });
    return { success: true, lead: lead };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

function updateLead(appId, updates, userEmail) {
  var lock = LockService.getScriptLock();
  lock.waitLock(5000);
  try {
    var user = getCurrentUser_(userEmail);

    var data = getSheetData_(CONFIG.LEADS_SHEET_ID, 'Leads');
    var headers = data[0];
    var refCol = headers.indexOf('Reference');
    var agentCol = getAgentCol_(headers);
    var statusCol = headers.indexOf('Status');
    var remarksCol = headers.indexOf('Remarks');
    var nameCol = headers.indexOf('Name');
    var emailCol = headers.indexOf('Email');
    var passportCol = headers.indexOf('Passport');
    var nationalityCol = headers.indexOf('Nationality');
    var programmeCol = headers.indexOf('Programme');
    var structureCol = headers.indexOf('Structure');
    var locationCol = getLocationCol_(headers);

    if (refCol === -1) throw new Error('Reference column not found');

    var rowIndex = -1;
    for (var i = 1; i < data.length; i++) {
      if (data[i][refCol] === appId) {
        if (user.role === 'agent' && agentCol !== -1 && String(data[i][agentCol]) !== user.agentId && String(data[i][agentCol]) !== user.name) {
          throw new Error('Access denied');
        }
        rowIndex = i;
        break;
      }
    }
    if (rowIndex === -1) throw new Error('Lead not found');

    var validStatuses = ['New', 'COL Sent', 'Agreed', 'Enrolled', 'Deleted'];
    if (updates.status !== undefined) {
      if (user.role === 'agent' && String(data[rowIndex][agentCol]) !== user.agentId && String(data[rowIndex][agentCol]) !== user.name) {
        throw new Error('Access denied');
      }
      if (validStatuses.indexOf(updates.status) === -1) throw new Error('Invalid status: ' + updates.status);
      updateCell_(CONFIG.LEADS_SHEET_ID, 'Leads', rowIndex, statusCol, updates.status);
    }
    if (updates.remarks !== undefined && remarksCol !== -1) {
      if (user.role === 'agent' && String(data[rowIndex][agentCol]) !== user.agentId && String(data[rowIndex][agentCol]) !== user.name) {
        throw new Error('Access denied');
      }
      updateCell_(CONFIG.LEADS_SHEET_ID, 'Leads', rowIndex, remarksCol, String(updates.remarks));
    }

    if (user.role === 'admin') {
      if (updates.name !== undefined && nameCol !== -1) updateCell_(CONFIG.LEADS_SHEET_ID, 'Leads', rowIndex, nameCol, updates.name);
      if (updates.email !== undefined && emailCol !== -1) updateCell_(CONFIG.LEADS_SHEET_ID, 'Leads', rowIndex, emailCol, updates.email);
      if (updates.passport !== undefined && passportCol !== -1) updateCell_(CONFIG.LEADS_SHEET_ID, 'Leads', rowIndex, passportCol, updates.passport);
      if (updates.nationality !== undefined && nationalityCol !== -1) updateCell_(CONFIG.LEADS_SHEET_ID, 'Leads', rowIndex, nationalityCol, updates.nationality);
      if (updates.programme !== undefined && programmeCol !== -1) updateCell_(CONFIG.LEADS_SHEET_ID, 'Leads', rowIndex, programmeCol, updates.programme);
      if (updates.structure !== undefined && structureCol !== -1) updateCell_(CONFIG.LEADS_SHEET_ID, 'Leads', rowIndex, structureCol, updates.structure);
      if (updates.location !== undefined && locationCol !== -1) updateCell_(CONFIG.LEADS_SHEET_ID, 'Leads', rowIndex, locationCol, updates.location);
    }

    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  } finally {
    lock.releaseLock();
  }
}

function submitLead(leadData) {
  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    if (!leadData.fullName || !leadData.email || !leadData.passport) {
      throw new Error('Full name, email, and passport are required');
    }

    var agentName = 'Unknown';
    var agentEmail = '';
    var agentId = leadData.agentId || '';
    var location = '';
    var remarks = '';

    if (leadData.formId) {
      var forms = getSheetObjects_(CONFIG.FORMS_SHEET_ID, 'Forms');
      for (var j = 0; j < forms.length; j++) {
        if (forms[j].FormID === leadData.formId) {
          location = forms[j].LocationEvent || '';
          remarks = forms[j].Remark || '';
          agentName = forms[j].AgentName || agentName;
          if (forms[j].AgentID) agentId = forms[j].AgentID;
          break;
        }
      }
    }

    if (agentId && agentName === 'Unknown') {
      var sheetData = getSheetData_(CONFIG.AGENTS_SHEET_ID, 'Agents');
      var sheetHeaders = sheetData[0];
      var agentIdCol = sheetHeaders.indexOf('AgentID');
      var agentNameCol = sheetHeaders.indexOf('Name');
      var agentEmailCol = sheetHeaders.indexOf('Email');
      if (agentIdCol !== -1 && agentNameCol !== -1) {
        for (var i = 1; i < sheetData.length; i++) {
          if (sheetData[i][agentIdCol] === agentId) {
            agentName = sheetData[i][agentNameCol] || 'Unknown';
            if (agentEmailCol !== -1) agentEmail = sheetData[i][agentEmailCol] || '';
            break;
          }
        }
      }
    }

    var result = generateAndSendOffer_({
      fullName: leadData.fullName,
      email: leadData.email,
      passport: leadData.passport,
      nationality: leadData.nationality || '',
      structure: leadData.structure || '',
      programme: leadData.programme || '',
      agentId: agentId,
      agentName: agentName,
      agentEmail: agentEmail,
      formId: leadData.formId || '',
      location: location,
      remarks: remarks,
    });

    return { success: true, applicationId: result.applicationId, pdfUrl: result.pdfUrl };
  } catch (e) {
    return { success: false, error: e.message };
  } finally {
    lock.releaseLock();
  }
}

function deleteLead(appId, userEmail) {
  var lock = LockService.getScriptLock();
  lock.waitLock(5000);
  try {
    var user = getCurrentUser_(userEmail);

    var data = getSheetData_(CONFIG.LEADS_SHEET_ID, 'Leads');
    var headers = data[0];
    var refCol = headers.indexOf('Reference');
    var agentCol = getAgentCol_(headers);
    if (refCol === -1) throw new Error('Reference column not found');

    for (var i = 1; i < data.length; i++) {
      if (data[i][refCol] === appId) {
        if (user.role !== 'admin' && agentCol !== -1) {
          var leadAgent = String(data[i][agentCol] || '');
          if (leadAgent !== user.agentId && leadAgent !== user.name) throw new Error('Access denied');
        }
        var sheet = getSheetByName_(CONFIG.LEADS_SHEET_ID, 'Leads');
        sheet.deleteRow(i + 1);
        return { success: true };
      }
    }
    throw new Error('Lead not found');
  } catch (e) {
    return { success: false, error: e.message };
  } finally {
    lock.releaseLock();
  }
}

function getForms(filters, userEmail) {
  filters = filters || {};
  var step = 'start';
  try {
    Logger.log('[getForms] step=start');
    step = 'getCurrentUser_';
    var user = getCurrentUser_(userEmail);
    Logger.log('[getForms] step=done user=' + user.email + ' role=' + user.role);

    step = 'ensureFormHeaders_';
    ensureFormHeaders_();
    Logger.log('[getForms] step=done ensureFormHeaders');

    step = 'getSheetObjects_';
    var forms = getSheetObjects_(CONFIG.FORMS_SHEET_ID, 'Forms');
    Logger.log('[getForms] step=done forms count=' + forms.length);

    if (user.role === 'agent') {
      forms = forms.filter(function (f) { return f.AgentID === user.agentId && f.Active !== 'deleted'; });
    } else if (!filters.showDeleted) {
      forms = forms.filter(function (f) { return f.Active !== 'deleted'; });
    }
    var result = { success: true, forms: forms };
    try {
      var jsonStr = JSON.stringify(result);
      Logger.log('[getForms] returning success, JSON length=' + jsonStr.length);
      return JSON.parse(jsonStr);
    } catch (je) {
      Logger.log('[getForms] JSON.stringify FAILED: ' + je.message);
      return result;
    }
  } catch (e) {
    Logger.log('[getForms] ERROR at step=' + step + ' message=' + e.message + ' stack=' + e.stack);
    return { success: false, error: e.message };
  }
}

function getProgrammes() {
  try {
    var data = getSheetData_(CONFIG.AGENTS_SHEET_ID, 'Programme');
    Logger.log('[getProgrammes] raw data rows: ' + (data ? data.length : 0));
    if (!data || data.length <= 1) {
      Logger.log('[getProgrammes] no data or only headers');
      return { success: true, programmes: [] };
    }
    var headers = data[0];
    Logger.log('[getProgrammes] headers: ' + JSON.stringify(headers));
    var modeCol = headers.indexOf('Mode');
    var progCol = headers.indexOf('Programme');
    Logger.log('[getProgrammes] modeCol=' + modeCol + ' progCol=' + progCol);
    if (modeCol === -1 || progCol === -1) {
      Logger.log('[getProgrammes] column not found');
      return { success: true, programmes: [] };
    }
    var progList = [];
    for (var i = 1; i < data.length; i++) {
      var mode = String(data[i][modeCol] || '').trim();
      var prog = String(data[i][progCol] || '').trim();
      if (mode && prog) progList.push({ mode: mode, programme: prog });
    }
    Logger.log('[getProgrammes] found ' + progList.length + ' programmes');
    return { success: true, programmes: progList };
  } catch (e) {
    Logger.log('[getProgrammes] ERROR: ' + e.message);
    return { success: false, error: e.message };
  }
}

function ensureFormHeaders_() {
  var sheet = getSheetByName_(CONFIG.FORMS_SHEET_ID, 'Forms');
  var data = sheet.getDataRange().getValues();
  if (data.length === 0 || !data[0] || data[0][0] !== 'FormID') {
    var headers = ['FormID','FormName','AgentID','AgentName','DefaultFields','EnabledFields','Active','CreatedAt','LocationEvent','Remark','PublicURL','EventDate'];
    if (data.length > 0) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    } else {
      sheet.appendRow(headers);
    }
  }
}

function createForm(formData, userEmail) {
  try {
    var user = getCurrentUser_(userEmail);
    ensureFormHeaders_();

    var formId = 'FORM-' + Utilities.getUuid().slice(0, 8);
    var defaultFields = JSON.stringify([
      { key: 'fullName', label: 'Full Name', required: true },
      { key: 'email', label: 'Email', required: true },
      { key: 'passport', label: 'Passport Number', required: true },
      { key: 'nationality', label: 'Nationality', required: false },
      { key: 'structure', label: 'Research Structure', required: true },
      { key: 'programme', label: 'Programme', required: true },
    ]);

    var enabledFields = formData.enabledFields || JSON.stringify(['fullName', 'email', 'passport', 'structure', 'programme']);
    var locationEvent = formData.locationEvent || '';
    var eventDate = formData.eventDate || '';
    var remark = formData.remark || '';
    var formName = user.name + (locationEvent ? ' - ' + locationEvent : '') + (eventDate ? ' (' + eventDate + ')' : '');
    var publicUrl = getAppBaseUrl_() + '?page=public&formId=' + formId + '&agentId=' + encodeURIComponent(user.agentId);

    var row = [
      formId,
      formName,
      user.agentId,
      user.name,
      JSON.stringify(defaultFields),
      enabledFields,
      'true',
      new Date().toISOString(),
      locationEvent,
      remark,
      publicUrl,
      eventDate,
    ];
    appendRow_(CONFIG.FORMS_SHEET_ID, 'Forms', row);
    return { success: true, formId: formId, publicUrl: publicUrl };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

function updateForm(formId, updates, userEmail) {
  try {
    var user = getCurrentUser_(userEmail);

    var data = getSheetData_(CONFIG.FORMS_SHEET_ID, 'Forms');
    if (data.length <= 1) throw new Error('No forms found');
    var headers = data[0];
    var formIdCol = headers.indexOf('FormID');
    var agentIdCol = headers.indexOf('AgentID');
    var nameCol = headers.indexOf('FormName');
    var fieldsCol = headers.indexOf('EnabledFields');
    var activeCol = headers.indexOf('Active');
    var locationEventCol = headers.indexOf('LocationEvent');
    var remarkCol = headers.indexOf('Remark');
    var eventDateCol = headers.indexOf('EventDate');
    if (formIdCol === -1) throw new Error('FormID column not found');

    var rowIndex = -1;
    for (var i = 1; i < data.length; i++) {
      if (data[i][formIdCol] === formId) {
        if (user.role === 'agent' && agentIdCol !== -1 && data[i][agentIdCol] !== user.agentId) {
          throw new Error('Access denied');
        }
        rowIndex = i;
        break;
      }
    }
    if (rowIndex === -1) throw new Error('Form not found');

    if (updates.formName !== undefined && nameCol !== -1) updateCell_(CONFIG.FORMS_SHEET_ID, 'Forms', rowIndex, nameCol, updates.formName);
    if (updates.enabledFields !== undefined && fieldsCol !== -1) updateCell_(CONFIG.FORMS_SHEET_ID, 'Forms', rowIndex, fieldsCol, JSON.stringify(updates.enabledFields));
    if (updates.active !== undefined && activeCol !== -1) updateCell_(CONFIG.FORMS_SHEET_ID, 'Forms', rowIndex, activeCol, updates.active ? 'true' : 'false');
    if (updates.locationEvent !== undefined && locationEventCol !== -1) updateCell_(CONFIG.FORMS_SHEET_ID, 'Forms', rowIndex, locationEventCol, updates.locationEvent);
    if (updates.remark !== undefined && remarkCol !== -1) updateCell_(CONFIG.FORMS_SHEET_ID, 'Forms', rowIndex, remarkCol, updates.remark);
    if (updates.eventDate !== undefined && eventDateCol !== -1) updateCell_(CONFIG.FORMS_SHEET_ID, 'Forms', rowIndex, eventDateCol, updates.eventDate);
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

function deleteForm(formId, userEmail) {
  try {
    var user = getCurrentUser_(userEmail);

    var data = getSheetData_(CONFIG.FORMS_SHEET_ID, 'Forms');
    var headers = data[0];
    var formIdCol = headers.indexOf('FormID');
    var agentIdCol = headers.indexOf('AgentID');
    var activeCol = headers.indexOf('Active');
    if (formIdCol === -1) throw new Error('FormID column not found');

    for (var i = 1; i < data.length; i++) {
      if (data[i][formIdCol] === formId) {
        if (user.role === 'admin') {
          var sheet = getSheetByName_(CONFIG.FORMS_SHEET_ID, 'Forms');
          sheet.deleteRow(i + 1);
          return { success: true };
        } else {
          if (agentIdCol !== -1 && data[i][agentIdCol] !== user.agentId) throw new Error('Access denied');
          updateCell_(CONFIG.FORMS_SHEET_ID, 'Forms', i, activeCol, 'deleted');
          return { success: true };
        }
      }
    }
    throw new Error('Form not found');
  } catch (e) {
    return { success: false, error: e.message };
  }
}

function getForm(formId, userEmail) {
  try {
    var user = getCurrentUser_(userEmail);
    var found = findRowByColumn_(CONFIG.FORMS_SHEET_ID, 'Forms', 'FormID', formId);
    if (!found) throw new Error('Form not found');

    var headers = getSheetData_(CONFIG.FORMS_SHEET_ID, 'Forms')[0];
    var agentIdCol = headers.indexOf('AgentID');
    if (user.role === 'agent' && agentIdCol !== -1 && found.rowData[agentIdCol] !== user.agentId) {
      throw new Error('Access denied');
    }

    var form = {};
    headers.forEach(function (h, i) { form[h] = found.rowData[i] || ''; });
    return { success: true, form: form };
  } catch (e) {
    return { success: false, error: e.message };
  }
}



function ensureCandidatesHeaders_() {
  ensureHeader_(CONFIG.PROGRESS_SHEET_ID, 'Candidate', 'Nationality');
  ensureHeader_(CONFIG.PROGRESS_SHEET_ID, 'Candidate', 'FilingStatus');
}

function ensureGroupsHeaders_() {
  var sheet = getSheetByName_(CONFIG.PROGRESS_SHEET_ID, 'Groups');
  var headers = ['GroupID','GroupName','AgentName','AgentID','StartDate','MainInstitution','Country','ExpectedEndDate','Remarks','FilingStatus','CreatedAt'];
  var data = sheet.getDataRange().getValues();
  if (data.length === 0 || data[0][0] !== 'GroupID') {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  } else if (data[0].length < headers.length) {
    // Extend headers if missing columns
    for (var ci = data[0].length; ci < headers.length; ci++) {
      sheet.getRange(1, ci + 1).setValue(headers[ci]);
    }
  }
}

function createGroup(data, userEmail) {
  try {
    var user = getCurrentUser_(userEmail);
    if (user.role !== 'admin') throw new Error('Admin only');
    if (!data.groupName) throw new Error('Group name required');
    
    ensureGroupsHeaders_();
    var groupId = 'GRP' + Utilities.getUuid().slice(0, 8).toUpperCase();
    var row = [
      groupId,
      data.groupName,
      data.agentName || '',
      data.agentId || '',
      data.startDate || '',
      data.mainInstitution || '',
      data.country || '',
      data.expectedEndDate || '',
      data.remarks || '',
      'Active',
      new Date().toISOString(),
    ];
    appendRow_(CONFIG.PROGRESS_SHEET_ID, 'Groups', row);
    return { success: true, groupId: groupId };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

function getGroups() {
  try {
    ensureGroupsHeaders_();
    var groups = getSheetObjects_(CONFIG.PROGRESS_SHEET_ID, 'Groups');
    return { success: true, groups: groups };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

function updateGroup(groupId, data, userEmail) {
  try {
    var user = getCurrentUser_(userEmail);
    var found = findRowByColumn_(CONFIG.PROGRESS_SHEET_ID, 'Groups', 'GroupID', groupId);
    if (!found) throw new Error('Group not found');

    var headers = getSheetData_(CONFIG.PROGRESS_SHEET_ID, 'Groups')[0];
    if (user.role !== 'admin') {
      var agentIdCol = headers.indexOf('AgentID');
      if (agentIdCol === -1 || (found.rowData[agentIdCol] || '') !== user.agentId) {
        throw new Error('You can only edit your own groups');
      }
    }

    var fieldMap = { mainInstitution: 'MainInstitution', country: 'Country', expectedEndDate: 'ExpectedEndDate', remarks: 'Remarks', filingStatus: 'FilingStatus' };
    for (var key in data) {
      if (fieldMap[key] !== undefined) {
        var col = headers.indexOf(fieldMap[key]);
        if (col !== -1) updateCell_(CONFIG.PROGRESS_SHEET_ID, 'Groups', found.rowIndex, col, data[key]);
      }
    }
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

function debugCandidateSheet(userEmail) {
  try {
    var user = getCurrentUser_(userEmail);
    var sheet = getSheetByName_(CONFIG.PROGRESS_SHEET_ID, 'Candidate');
    var data = sheet.getDataRange().getValues();
    return {
      success: true,
      user: { email: user.email, name: user.name, role: user.role, agentId: user.agentId },
      sheetName: sheet.getName(),
      rowCount: data.length,
      colCount: data.length > 0 ? data[0].length : 0,
      headers: data.length > 0 ? data[0] : [],
      firstRow: data.length > 1 ? data[1] : [],
      lastRow: data.length > 1 ? data[data.length - 1] : [],
    };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

function migrateGroupsFromCandidates(userEmail) {
  try {
    var user = getCurrentUser_(userEmail);
    if (user.role !== 'admin') throw new Error('Admin only');

    ensureGroupsHeaders_();

    // Get existing group names from Groups sheet
    var existingGroups = getSheetObjects_(CONFIG.PROGRESS_SHEET_ID, 'Groups');
    var existingNames = {};
    existingGroups.forEach(function (g) { existingNames[g.GroupName] = true; });

    // Get all candidates and find unique groups with agent info
    var candidates = getSheetData_(CONFIG.PROGRESS_SHEET_ID, 'Candidate');
    if (candidates.length <= 1) return { success: true, created: 0, message: 'No candidate data' };

    var headers = candidates[0];
    var groupCol = headers.indexOf('Group');
    var agentNameCol = headers.indexOf('AgentName');
    var agentIdCol = headers.indexOf('AgentID');
    if (groupCol === -1) throw new Error('Group column not found in Candidate sheet');

    var groupInfo = {};
    for (var i = 1; i < candidates.length; i++) {
      var grp = (candidates[i][groupCol] || '').trim();
      if (!grp) continue;
      if (!groupInfo[grp]) groupInfo[grp] = { agentNames: {}, agentIds: {} };
      var aname = agentNameCol >= 0 ? (candidates[i][agentNameCol] || '') : '';
      var aid = agentIdCol >= 0 ? (candidates[i][agentIdCol] || '') : '';
      if (aname) groupInfo[grp].agentNames[aname] = (groupInfo[grp].agentNames[aname] || 0) + 1;
      if (aid) groupInfo[grp].agentIds[aid] = (groupInfo[grp].agentIds[aid] || 0) + 1;
    }

    var created = 0;
    for (var groupName in groupInfo) {
      if (existingNames[groupName]) continue;

      // Pick most common agent name and ID
      var agentName = '';
      var agentId = '';
      var nameEntries = Object.entries(groupInfo[groupName].agentNames).sort(function (a, b) { return b[1] - a[1]; });
      if (nameEntries.length > 0) agentName = nameEntries[0][0];
      var idEntries = Object.entries(groupInfo[groupName].agentIds).sort(function (a, b) { return b[1] - a[1]; });
      if (idEntries.length > 0) agentId = idEntries[0][0];

      var groupId = 'GRP' + Utilities.getUuid().slice(0, 8).toUpperCase();
      var row = [groupId, groupName, agentName, agentId, '', '', '', '', 'Migrated from candidates', 'Active', new Date().toISOString()];
      appendRow_(CONFIG.PROGRESS_SHEET_ID, 'Groups', row);
      created++;
    }

    return { success: true, created: created, total: Object.keys(groupInfo).length };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

function archiveGroup(groupId, userEmail) {
  try {
    var user = getCurrentUser_(userEmail);
    if (user.role !== 'admin') throw new Error('Admin only');
    var found = findRowByColumn_(CONFIG.PROGRESS_SHEET_ID, 'Groups', 'GroupID', groupId);
    if (!found) throw new Error('Group not found');
    var headers = getSheetData_(CONFIG.PROGRESS_SHEET_ID, 'Groups')[0];
    var statusCol = headers.indexOf('FilingStatus');
    if (statusCol === -1) throw new Error('FilingStatus column not found');
    updateCell_(CONFIG.PROGRESS_SHEET_ID, 'Groups', found.rowIndex, statusCol, 'Archived');
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

function deleteGroup(groupId, userEmail) {
  try {
    var user = getCurrentUser_(userEmail);
    if (user.role !== 'admin') throw new Error('Admin only');
    var found = findRowByColumn_(CONFIG.PROGRESS_SHEET_ID, 'Groups', 'GroupID', groupId);
    if (!found) throw new Error('Group not found');
    var headers = getSheetData_(CONFIG.PROGRESS_SHEET_ID, 'Groups')[0];
    var statusCol = headers.indexOf('FilingStatus');
    if (statusCol === -1) throw new Error('FilingStatus column not found');
    updateCell_(CONFIG.PROGRESS_SHEET_ID, 'Groups', found.rowIndex, statusCol, 'Deleted');
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

function getCandidates(userEmail) {
  try {
    ensureCandidatesHeaders_();
    var user = getCurrentUser_(userEmail);
    var data = getSheetData_(CONFIG.PROGRESS_SHEET_ID, 'Candidate');
    var candidates = [];
    if (data.length > 1) {
      var headers = data[0];
      for (var i = 1; i < data.length; i++) {
        var obj = { _row: i };
        for (var j = 0; j < headers.length; j++) {
          obj[headers[j]] = data[i][j];
        }
        if (user.role === 'agent' && obj['AgentID'] !== user.agentId) continue;
        candidates.push(obj);
      }
    }
    return { success: true, candidates: candidates };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

function updateCandidate(rowIndex, updates, userEmail) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var user = getCurrentUser_(userEmail);
    var data = getSheetData_(CONFIG.PROGRESS_SHEET_ID, 'Candidate');
    if (rowIndex < 1 || rowIndex >= data.length) throw new Error('Candidate not found');

    var headers = data[0];
    var row = data[rowIndex];

    if (user.role === 'agent') {
      var agentIdCol = headers.indexOf('AgentID');
      if (agentIdCol === -1) throw new Error('AgentID column not found');
      var candidateAgentId = String(row[agentIdCol] || '');
      if (candidateAgentId !== user.agentId) throw new Error('You can only edit your own candidates');
    }

    if (updates.fullName !== undefined) {
      var fnCol = headers.indexOf('Full Name (as in Passport)');
      if (fnCol === -1) fnCol = headers.indexOf('Full Name');
      if (fnCol !== -1) updateCell_(CONFIG.PROGRESS_SHEET_ID, 'Candidate', rowIndex, fnCol, updates.fullName);
    }
    if (updates.travelDoc !== undefined) {
      var tdCol = headers.indexOf('Travel Document No.');
      if (tdCol !== -1) updateCell_(CONFIG.PROGRESS_SHEET_ID, 'Candidate', rowIndex, tdCol, updates.travelDoc);
    }
    if (updates.nationality !== undefined) {
      var natCol = headers.indexOf('Nationality');
      if (natCol !== -1) updateCell_(CONFIG.PROGRESS_SHEET_ID, 'Candidate', rowIndex, natCol, updates.nationality);
    }
    if (updates.appNo !== undefined) {
      var appCol = headers.indexOf('Application No.');
      if (appCol !== -1) updateCell_(CONFIG.PROGRESS_SHEET_ID, 'Candidate', rowIndex, appCol, updates.appNo);
    }
    if (user.role === 'admin') {
      if (updates.group !== undefined) {
        var grpCol = headers.indexOf('Group');
        if (grpCol !== -1) updateCell_(CONFIG.PROGRESS_SHEET_ID, 'Candidate', rowIndex, grpCol, updates.group);
      }
      if (updates.status !== undefined) {
        var stCol = headers.indexOf('Application Status');
        if (stCol !== -1) updateCell_(CONFIG.PROGRESS_SHEET_ID, 'Candidate', rowIndex, stCol, updates.status);
      }
      if (updates.progress !== undefined) {
        var progCol = headers.indexOf('Progress (%)');
        if (progCol !== -1) updateCell_(CONFIG.PROGRESS_SHEET_ID, 'Candidate', rowIndex, progCol, parseFloat(updates.progress) || 0);
      }
      if (updates.filingStatus !== undefined) {
        var fsCol = headers.indexOf('FilingStatus');
        if (fsCol !== -1) updateCell_(CONFIG.PROGRESS_SHEET_ID, 'Candidate', rowIndex, fsCol, updates.filingStatus);
      }
    }

    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  } finally {
    lock.releaseLock();
  }
}

function updateCandidateFilingStatus(rowIndex, filingStatus, userEmail) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var user = getCurrentUser_(userEmail);
    if (user.role !== 'admin') throw new Error('Admin only');
    var headers = getSheetData_(CONFIG.PROGRESS_SHEET_ID, 'Candidate')[0];
    var fsCol = headers.indexOf('FilingStatus');
    if (fsCol === -1) throw new Error('FilingStatus column not found');
    updateCell_(CONFIG.PROGRESS_SHEET_ID, 'Candidate', rowIndex, fsCol, filingStatus);
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  } finally {
    lock.releaseLock();
  }
}

function addCandidateToGroup(travelDoc, groupName, userEmail) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var user = getCurrentUser_(userEmail);
    if (user.role !== 'admin') throw new Error('Admin only');
    if (!travelDoc || !groupName) throw new Error('Travel document and group name required');
    
    var data = getSheetData_(CONFIG.PROGRESS_SHEET_ID, 'Candidate');
    if (data.length <= 1) throw new Error('No candidates found');
    var headers = data[0];
    var tdCol = headers.indexOf('Travel Document No.');
    if (tdCol === -1) throw new Error('Travel Document No. column not found');
    var grpCol = headers.indexOf('Group');
    if (grpCol === -1) throw new Error('Group column not found');
    
    var rowIndex = -1;
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][tdCol] || '').trim().toLowerCase() === String(travelDoc).trim().toLowerCase()) {
        rowIndex = i;
        break;
      }
    }
    if (rowIndex === -1) throw new Error('No candidate found with that Travel Document No.');
    
    updateCell_(CONFIG.PROGRESS_SHEET_ID, 'Candidate', rowIndex, grpCol, groupName);
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  } finally {
    lock.releaseLock();
  }
}

function checkEmgsNow(userEmail) {
  try {
    var user = getCurrentUser_(userEmail);
    if (user.role !== 'admin') throw new Error('Admin only');
    var result = cronCheckEmgsStatus_();
    return { success: true, result: result };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

function getNextEmgsSchedule(userEmail) {
  try {
    var user = getCurrentUser_(userEmail);
    if (user.role !== 'admin') return { success: true, nextRun: null, active: false };
    var triggers = ScriptApp.getProjectTriggers();
    for (var i = 0; i < triggers.length; i++) {
      if (triggers[i].getHandlerFunction() === 'cronCheckEmgsStatus_') {
        var next = triggers[i].getNextRunTime();
        if (next) return { success: true, nextRun: next.toISOString(), active: true };
      }
    }
    return { success: true, nextRun: null, active: false };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

function setupEmgsCronTrigger(userEmail) {
  try {
    var user = getCurrentUser_(userEmail);
    if (user.role !== 'admin') throw new Error('Admin only');

    var triggers = ScriptApp.getProjectTriggers();
    for (var i = 0; i < triggers.length; i++) {
      if (triggers[i].getHandlerFunction() === 'cronCheckEmgsStatus_') {
        ScriptApp.deleteTrigger(triggers[i]);
      }
    }

    ScriptApp.newTrigger('cronCheckEmgsStatus_')
      .timeBased()
      .everyWeeks(1)
      .onWeekDay(ScriptApp.WeekDay.MONDAY)
      .atHour(6)
      .create();
    ScriptApp.newTrigger('cronCheckEmgsStatus_')
      .timeBased()
      .everyWeeks(1)
      .onWeekDay(ScriptApp.WeekDay.THURSDAY)
      .atHour(6)
      .create();

    return { success: true, message: 'Triggers set for Mon/Thu at 06:00 MYT' };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

var COUNTRY_TO_CODE = {
  'Afghanistan':'AF','Albania':'AL','Algeria':'DZ','Andorra':'AD','Angola':'AO','Antigua and Barbuda':'AG','Argentina':'AR','Armenia':'AM','Australia':'AU','Austria':'AT','Azerbaijan':'AZ',
  'Bahamas':'BS','Bahrain':'BH','Bangladesh':'BD','Barbados':'BB','Belarus':'BY','Belgium':'BE','Belize':'BZ','Benin':'BJ','Bhutan':'BT','Bolivia':'BO','Bosnia and Herzegovina':'BA','Botswana':'BW','Brazil':'BR','Brunei':'BN','Bulgaria':'BG','Burkina Faso':'BF','Burundi':'BI',
  'Cambodia':'KH','Cameroon':'CM','Canada':'CA','Cape Verde':'CV','Central African Republic':'CF','Chad':'TD','Chile':'CL','China':'CN','Colombia':'CO','Comoros':'KM','Congo':'CG','Costa Rica':'CR','Croatia':'HR','Cuba':'CU','Cyprus':'CY','Czech Republic':'CZ',
  'Denmark':'DK','Djibouti':'DJ','Dominica':'DM','Dominican Republic':'DO',
  'Ecuador':'EC','Egypt':'EG','El Salvador':'SV','Equatorial Guinea':'GQ','Eritrea':'ER','Estonia':'EE','Eswatini':'SZ','Ethiopia':'ET',
  'Fiji':'FJ','Finland':'FI','France':'FR',
  'Gabon':'GA','Gambia':'GM','Georgia':'GE','Germany':'DE','Ghana':'GH','Greece':'GR','Grenada':'GD','Guatemala':'GT','Guinea':'GN','Guinea-Bissau':'GW','Guyana':'GY',
  'Haiti':'HT','Honduras':'HN','Hungary':'HU',
  'Iceland':'IS','India':'IN','Indonesia':'ID','Iran':'IR','Iraq':'IQ','Ireland':'IE','Israel':'IL','Italy':'IT',
  'Jamaica':'JM','Japan':'JP','Jordan':'JO',
  'Kazakhstan':'KZ','Kenya':'KE','Kiribati':'KI','Kuwait':'KW','Kyrgyzstan':'KG',
  'Laos':'LA','Latvia':'LV','Lebanon':'LB','Lesotho':'LS','Liberia':'LR','Libya':'LY','Liechtenstein':'LI','Lithuania':'LT','Luxembourg':'LU',
  'Madagascar':'MG','Malawi':'MW','Malaysia':'MY','Maldives':'MV','Mali':'ML','Malta':'MT','Marshall Islands':'MH','Mauritania':'MR','Mauritius':'MU','Mexico':'MX','Micronesia':'FM','Moldova':'MD','Monaco':'MC','Mongolia':'MN','Montenegro':'ME','Morocco':'MA','Mozambique':'MZ','Myanmar':'MM',
  'Namibia':'NA','Nauru':'NR','Nepal':'NP','Netherlands':'NL','New Zealand':'NZ','Nicaragua':'NI','Niger':'NE','Nigeria':'NG','North Korea':'KP','North Macedonia':'MK','Norway':'NO',
  'Oman':'OM',
  'Pakistan':'PK','Palau':'PW','Palestine':'PS','Panama':'PA','Papua New Guinea':'PG','Paraguay':'PY','Peru':'PE','Philippines':'PH','Poland':'PL','Portugal':'PT','Qatar':'QA',
  'Romania':'RO','Russia':'RU','Rwanda':'RW',
  'Saint Kitts and Nevis':'KN','Saint Lucia':'LC','Saint Vincent and the Grenadines':'VC','Samoa':'WS','San Marino':'SM','Sao Tome and Principe':'ST','Saudi Arabia':'SA','Senegal':'SN','Serbia':'RS','Seychelles':'SC','Sierra Leone':'SL','Singapore':'SG','Slovakia':'SK','Slovenia':'SI','Solomon Islands':'SB','Somalia':'SO','South Africa':'ZA','South Korea':'KR','South Sudan':'SS','Spain':'ES','Sri Lanka':'LK','Sudan':'SD','Suriname':'SR','Sweden':'SE','Switzerland':'CH','Syria':'SY',
  'Taiwan':'TW','Tajikistan':'TJ','Tanzania':'TZ','Thailand':'TH','Timor-Leste':'TL','Togo':'TG','Tonga':'TO','Trinidad and Tobago':'TT','Tunisia':'TN','Turkey':'TR','Turkmenistan':'TM','Tuvalu':'TV',
  'Uganda':'UG','Ukraine':'UA','United Arab Emirates':'AE','United Kingdom':'GB','United States':'US','Uruguay':'UY','Uzbekistan':'UZ',
  'Vanuatu':'VU','Vatican City':'VA','Venezuela':'VE','Vietnam':'VN',
  'Yemen':'YE',
  'Zambia':'ZM','Zimbabwe':'ZW'
};

function cronCheckEmgsStatus_() {
  ensureCandidatesHeaders_();
  var sheet = getSheetByName_(CONFIG.PROGRESS_SHEET_ID, 'Candidate');
  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) return { checked: 0, updated: 0, skipped: 0 };

  var headers = data[0];
  var passportCol = headers.indexOf('Travel Document No.');
  if (passportCol === -1) return { error: 'Travel Document No. column not found' };
  var nationalityCol = headers.indexOf('Nationality');
  if (nationalityCol === -1) return { error: 'Nationality column not found' };
  var progressCol = headers.indexOf('Progress (%)');
  if (progressCol === -1) return { error: 'Progress (%) column not found' };
  var statusCol = headers.indexOf('Application Status');
  if (statusCol === -1) return { error: 'Application Status column not found' };
  var appNoCol = headers.indexOf('Application No.');

  var checked = 0;
  var updated = 0;
  var skipped = 0;
  var EMGS_FORM_URL = 'https://visa.educationmalaysia.gov.my/emgs/application/searchForm/';
  var EMGS_POST_URL = 'https://visa.educationmalaysia.gov.my/emgs/application/searchPost/';

  for (var i = 1; i < data.length; i++) {
    var passport = String(data[i][passportCol] || '').trim();
    var nationality = String(data[i][nationalityCol] || '').trim();
    var countryCode = COUNTRY_TO_CODE[nationality] || nationality;

    if (!passport || !countryCode) {
      skipped++;
      continue;
    }

    checked++;
    try {
      var getResp = UrlFetchApp.fetch(EMGS_FORM_URL, {
        muteHttpExceptions: true,
        followRedirects: false,
      });
      var formHtml = getResp.getContentText();

      var cookies = '';
      var respHeaders = getResp.getAllHeaders();
      if (respHeaders['Set-Cookie']) {
        cookies = respHeaders['Set-Cookie'];
      } else if (respHeaders['set-cookie']) {
        cookies = respHeaders['set-cookie'];
      }
      if (cookies && cookies.indexOf(';') > 0) {
        cookies = cookies.split(';')[0];
      }

      var formKeyMatch = formHtml.match(/name="form_key"\s+type="hidden"\s+value="([^"]+)"/i);
      if (!formKeyMatch) formKeyMatch = formHtml.match(/name="form_key"\s+value="([^"]+)"/i);
      if (!formKeyMatch) continue;

      var formKey = formKeyMatch[1];
      var postPayload = 'form_key=' + encodeURIComponent(formKey) +
        '&travel_doc_no=' + encodeURIComponent(passport) +
        '&nationality=' + encodeURIComponent(countryCode) +
        '&agreement=1';

      var headers = { 'Cookie': cookies };
      var postResp = UrlFetchApp.fetch(EMGS_POST_URL, {
        method: 'post',
        payload: postPayload,
        contentType: 'application/x-www-form-urlencoded',
        headers: headers,
        muteHttpExceptions: true,
        followRedirects: true,
      });
      var resultHtml = postResp.getContentText().replace(/\s+/g, ' ');

      var anyUpdate = false;

      var pctMatch = resultHtml.match(/<h2>\s*(\d+)\s*%\s*<\/h2>/i);
      if (pctMatch) {
        var pct = parseInt(pctMatch[1], 10);
        updateCell_(CONFIG.PROGRESS_SHEET_ID, 'Candidate', i, progressCol, pct / 100);
        anyUpdate = true;
      }

      var statusMatch = resultHtml.match(/Application Status\s*<\/label>[^:]*:(?:&nbsp;|\s)*([^<]+)/i);
      if (statusMatch) {
        var s = statusMatch[1].replace(/&nbsp;/g, ' ').trim();
        if (s.length > 0) {
          updateCell_(CONFIG.PROGRESS_SHEET_ID, 'Candidate', i, statusCol, s);
          anyUpdate = true;
        }
      }

      if (appNoCol !== -1) {
        var appNoMatch = resultHtml.match(/Application Number\s*<\/label>[^:]*:(?:&nbsp;|\s)*([0-9]+)/i);
        if (appNoMatch) {
          updateCell_(CONFIG.PROGRESS_SHEET_ID, 'Candidate', i, appNoCol, appNoMatch[1].trim());
          anyUpdate = true;
        }
      }

      if (anyUpdate) updated++;
    } catch (reqErr) {
      Logger.log('EMGS check failed for ' + passport + ': ' + reqErr);
    }

    if (i < data.length - 1) {
      Utilities.sleep(2000);
    }
  }

  return { checked: checked, updated: updated, skipped: skipped };
}

function getDashboard(agentIdFilter, userEmail) {
  try {
    var summary = getDashboardSummary_(agentIdFilter, userEmail);
    return { success: true, summary: summary };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

function fixLeadAgents(userEmail) {
  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    var user = getCurrentUser_(userEmail);
    if (user.role !== 'admin') throw new Error('Admin only');

    var leadSheet = getSheetByName_(CONFIG.LEADS_SHEET_ID, 'Leads');
    var leadData = leadSheet.getDataRange().getValues();
    if (leadData.length <= 1) return { success: true, fixed: 0, total: 0 };
    var leadHeaders = leadData[0];
    var formIdCol = leadHeaders.indexOf('FormID');
    var agentCol = getAgentCol_(leadHeaders);
    var agentIdColLead = leadHeaders.indexOf('AgentID');

    Logger.log('Leads headers: ' + JSON.stringify(leadHeaders));
    Logger.log('formIdCol=' + formIdCol + ' agentCol=' + agentCol + ' agentIdColLead=' + agentIdColLead);

    if (formIdCol === -1 || agentCol === -1) throw new Error('Required columns not found');

    var formData = getSheetData_(CONFIG.FORMS_SHEET_ID, 'Forms');
    var formHeaders = formData[0];
    var formIdIdx = formHeaders.indexOf('FormID');
    var formAgentCol = formHeaders.indexOf('AgentName');
    Logger.log('Forms headers: ' + JSON.stringify(formHeaders));
    Logger.log('formIdIdx=' + formIdIdx + ' formAgentCol=' + formAgentCol);

    var fixed = 0;
    for (var i = 1; i < leadData.length; i++) {
      var currentAgent = String(leadData[i][agentCol] || '');
      var leadFormId = String(leadData[i][formIdCol] || '');
      var leadAgentId = agentIdColLead !== -1 ? String(leadData[i][agentIdColLead] || '') : '';
      Logger.log('Lead ' + i + ': agent="' + currentAgent + '" formId="' + leadFormId + '" agentId="' + leadAgentId + '"');

      if (currentAgent !== 'Unknown') continue;

      var correctName = '';

      // Strategy 1: match by FormID
      if (leadFormId && formIdIdx !== -1 && formAgentCol !== -1) {
        for (var j = 1; j < formData.length; j++) {
          if (String(formData[j][formIdIdx]) === leadFormId) {
            correctName = formData[j][formAgentCol] || '';
            Logger.log('  Found form ' + leadFormId + ' with AgentName="' + correctName + '"');
            break;
          }
        }
      }

      // Strategy 2: match by AgentID in Agents sheet
      if (!correctName && leadAgentId) {
        var agentData = getSheetData_(CONFIG.AGENTS_SHEET_ID, 'Agents');
        var agentHeaders = agentData[0];
        var agIdCol = agentHeaders.indexOf('AgentID');
        var agNameCol = agentHeaders.indexOf('Name');
        if (agIdCol !== -1 && agNameCol !== -1) {
          for (var k = 1; k < agentData.length; k++) {
            if (String(agentData[k][agIdCol]) === leadAgentId) {
              correctName = agentData[k][agNameCol] || '';
              Logger.log('  Found agent ' + leadAgentId + ' with Name="' + correctName + '"');
              break;
            }
          }
        }
      }

      if (correctName && correctName !== 'Unknown') {
        leadSheet.getRange(i + 1, agentCol + 1).setValue(correctName);
        fixed++;
        Logger.log('  UPDATED to "' + correctName + '"');
      } else {
        Logger.log('  NO MATCH found');
      }
    }
    Logger.log('Total fixed: ' + fixed);
    return { success: true, fixed: fixed, total: leadData.length - 1 };
  } catch (e) {
    Logger.log('ERROR: ' + e.message + ' ' + e.stack);
    return { success: false, error: e.message };
  } finally {
    lock.releaseLock();
  }
}

function resetAllForms(userEmail) {
  try {
    var user = getCurrentUser_(userEmail);
    if (user.role !== 'admin') throw new Error('Admin only');
    var sheet = getSheetByName_(CONFIG.FORMS_SHEET_ID, 'Forms');
    var data = sheet.getDataRange().getValues();
    if (data.length > 1) {
      sheet.getRange(2, 1, data.length - 1, data[0].length || 12).clearContent();
    }
    ensureFormHeaders_();
    return { success: true, cleared: data.length > 1 ? data.length - 1 : 0 };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

function syncFormUrls(userEmail) {
  try {
    var user = getCurrentUser_(userEmail);
    if (user.role !== 'admin') throw new Error('Admin only');

    var data = getSheetData_(CONFIG.FORMS_SHEET_ID, 'Forms');
    var headers = data[0];
    var formIdCol = headers.indexOf('FormID');
    var publicUrlCol = headers.indexOf('PublicURL');
    if (formIdCol === -1 || publicUrlCol === -1) throw new Error('Required columns not found');

    var baseUrl = getAppBaseUrl_();
    var updated = 0;
    for (var i = 1; i < data.length; i++) {
      var formId = data[i][formIdCol];
      if (!formId) continue;
      var agentIdCol = headers.indexOf('AgentID');
      var agentId = agentIdCol !== -1 ? (data[i][agentIdCol] || '') : '';
      var newUrl = baseUrl + '?page=public&formId=' + encodeURIComponent(formId) + '&agentId=' + encodeURIComponent(agentId);
      updateCell_(CONFIG.FORMS_SHEET_ID, 'Forms', i, publicUrlCol, newUrl);
      updated++;
    }
    return { success: true, updated: updated, baseUrl: baseUrl };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

function getAgentCol_(headers) {
  var idx = headers.indexOf('AgentID');
  if (idx !== -1) return idx;
  return headers.indexOf('Agent');
}

function getLocationCol_(headers) {
  var idx = headers.indexOf('LocationEvent');
  if (idx !== -1) return idx;
  return headers.indexOf('Location');
}

function getLeadAgent_(lead) {
  return lead['AgentID'] || lead['Agent'] || '';
}



