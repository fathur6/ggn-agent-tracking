function doGet(e) {
  var page = e && e.parameter && e.parameter.page;
  if (page === 'public') {
    return HtmlService.createTemplateFromFile('PublicForm')
      .evaluate()
      .setTitle('UniSZA Application')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('UGS Agent Tracking')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function getMe() {
  try {
    var user = getCurrentUser_();
    return { success: true, user: user };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

function getAgents() {
  try {
    var user = getCurrentUser_();
    if (user.role !== 'admin') throw new Error('Admin only');
    var data = getSheetObjects_(CONFIG.AGENTS_SHEET_ID, 'Agents');
    return { success: true, agents: data };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

function createAgent(agentData) {
  try {
    var user = getCurrentUser_();
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

function updateAgent(agentId, updates) {
  try {
    var user = getCurrentUser_();
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

function deleteAgent(agentId) {
  try {
    var user = getCurrentUser_();
    if (user.role !== 'admin') throw new Error('Admin only');
    
    var data = getSheetData_(CONFIG.AGENTS_SHEET_ID, 'Agents');
    var headers = data[0];
    var agentIdCol = headers.indexOf('AgentID');
    var statusCol = headers.indexOf('Status');
    if (agentIdCol === -1 || statusCol === -1) throw new Error('Required columns not found');
    
    for (var i = 1; i < data.length; i++) {
      if (data[i][agentIdCol] === agentId) {
        updateCell_(CONFIG.AGENTS_SHEET_ID, 'Agents', i, statusCol, 'inactive');
        return { success: true };
      }
    }
    throw new Error('Agent not found');
  } catch (e) {
    return { success: false, error: e.message };
  }
}

function getLeads(agentIdFilter) {
  try {
    var user = getCurrentUser_();
    var leads = getSheetObjects_(CONFIG.LEADS_SHEET_ID, 'Leads');

    if (user.role === 'agent') {
      leads = leads.filter(function (l) { return l.AgentID === user.agentId; });
    } else if (user.role === 'admin' && agentIdFilter) {
      leads = leads.filter(function (l) { return l.AgentID === agentIdFilter; });
    }

    leads.sort(function (a, b) { return (b.Timestamp || '').localeCompare(a.Timestamp || ''); });
    return { success: true, leads: leads };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

function getLead(appId) {
  try {
    var user = getCurrentUser_();
    var found = findRowByColumn_(CONFIG.LEADS_SHEET_ID, 'Leads', 'ApplicationID', appId);
    if (!found) throw new Error('Lead not found');
    
    var headers = getSheetData_(CONFIG.LEADS_SHEET_ID, 'Leads')[0];
    var agentIdCol = headers.indexOf('AgentID');
    if (user.role === 'agent' && agentIdCol !== -1 && found.rowData[agentIdCol] !== user.agentId) {
      throw new Error('Access denied');
    }
    
    var lead = {};
    headers.forEach(function (h, i) { lead[h] = found.rowData[i] || ''; });
    return { success: true, lead: lead };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

function updateLead(appId, updates) {
  try {
    var user = getCurrentUser_();

    var data = getSheetData_(CONFIG.LEADS_SHEET_ID, 'Leads');
    var headers = data[0];
    var appIdCol = headers.indexOf('ApplicationID');
    var agentIdCol = headers.indexOf('AgentID');
    var statusCol = headers.indexOf('Status');
    var notesCol = headers.indexOf('Notes');

    if (appIdCol === -1) throw new Error('ApplicationID column not found');

    var rowIndex = -1;
    for (var i = 1; i < data.length; i++) {
      if (data[i][appIdCol] === appId) {
        if (user.role === 'agent' && agentIdCol !== -1 && data[i][agentIdCol] !== user.agentId) {
          throw new Error('Access denied');
        }
        rowIndex = i;
        break;
      }
    }
    if (rowIndex === -1) throw new Error('Lead not found');

    if (updates.status && statusCol !== -1) updateCell_(CONFIG.LEADS_SHEET_ID, 'Leads', rowIndex, statusCol, updates.status);
    if (updates.notes !== undefined && notesCol !== -1) updateCell_(CONFIG.LEADS_SHEET_ID, 'Leads', rowIndex, notesCol, String(updates.notes));

    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

function submitLead(leadData) {
  try {
    if (!leadData.fullName || !leadData.email || !leadData.passport) {
      throw new Error('Full name, email, and passport are required');
    }

    var agentName = 'Unknown';
    if (leadData.agentId) {
      var data = getSheetData_(CONFIG.AGENTS_SHEET_ID, 'Agents');
      var headers = data[0];
      var agentIdCol = headers.indexOf('AgentID');
      var agentNameCol = headers.indexOf('Name');
      if (agentIdCol !== -1 && agentNameCol !== -1) {
        for (var i = 1; i < data.length; i++) {
          if (data[i][agentIdCol] === leadData.agentId) {
            agentName = data[i][agentNameCol] || 'Unknown';
            break;
          }
        }
      }
    }

    var result = generateAndSendOffer_({
      fullName: leadData.fullName,
      email: leadData.email,
      passport: leadData.passport,
      structure: leadData.structure || '',
      programme: leadData.programme || '',
      agentId: leadData.agentId || '',
      agentName: agentName,
      formId: leadData.formId || '',
    });

    return { success: true, applicationId: result.applicationId, pdfUrl: result.pdfUrl };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

function getForms() {
  var step = 'start';
  try {
    Logger.log('[getForms] step=start');
    step = 'getCurrentUser_';
    var user = getCurrentUser_();
    Logger.log('[getForms] step=done user=' + user.email + ' role=' + user.role);

    step = 'ensureFormHeaders_';
    ensureFormHeaders_();
    Logger.log('[getForms] step=done ensureFormHeaders');

    step = 'getSheetObjects_';
    var forms = getSheetObjects_(CONFIG.FORMS_SHEET_ID, 'Forms');
    Logger.log('[getForms] step=done forms count=' + forms.length);

    if (user.role === 'agent') {
      forms = forms.filter(function (f) { return f.AgentID === user.agentId; });
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

function createForm(formData) {
  try {
    var user = getCurrentUser_();
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

function updateForm(formId, updates) {
  try {
    var user = getCurrentUser_();

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

function deleteForm(formId) {
  try {
    var user = getCurrentUser_();

    var data = getSheetData_(CONFIG.FORMS_SHEET_ID, 'Forms');
    var headers = data[0];
    var formIdCol = headers.indexOf('FormID');
    var agentIdCol = headers.indexOf('AgentID');
    var activeCol = headers.indexOf('Active');

    if (formIdCol === -1) throw new Error('FormID column not found');
    
    for (var i = 1; i < data.length; i++) {
      if (data[i][formIdCol] === formId) {
        if (user.role === 'agent' && agentIdCol !== -1 && data[i][agentIdCol] !== user.agentId) {
          throw new Error('Access denied');
        }
        updateCell_(CONFIG.FORMS_SHEET_ID, 'Forms', i, activeCol, 'false');
        return { success: true };
      }
    }
    throw new Error('Form not found');
  } catch (e) {
    return { success: false, error: e.message };
  }
}

function getDashboard(agentIdFilter) {
  try {
    var summary = getDashboardSummary_(agentIdFilter);
    return { success: true, summary: summary };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

function syncFormUrls() {
  try {
    var user = getCurrentUser_();
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
