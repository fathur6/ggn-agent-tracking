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

function getLeads(filters) {
  try {
    var user = getCurrentUser_();
    var leads = getSheetObjects_(CONFIG.LEADS_SHEET_ID, 'Leads');

    if (user.role === 'agent') {
      leads = leads.filter(function (l) { return l.Agent === user.name; });
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
        leads = leads.filter(function (l) { return l.Agent === filters.agent; });
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

function getLead(appId) {
  try {
    var user = getCurrentUser_();
    var found = findRowByColumn_(CONFIG.LEADS_SHEET_ID, 'Leads', 'Reference', appId);
    if (!found) throw new Error('Lead not found');
    
    var headers = getSheetData_(CONFIG.LEADS_SHEET_ID, 'Leads')[0];
    var agentCol = headers.indexOf('Agent');
    if (user.role === 'agent' && agentCol !== -1 && found.rowData[agentCol] !== user.name) {
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
  var lock = LockService.getScriptLock();
  lock.waitLock(5000);
  try {
    var user = getCurrentUser_();

    var data = getSheetData_(CONFIG.LEADS_SHEET_ID, 'Leads');
    var headers = data[0];
    var refCol = headers.indexOf('Reference');
    var agentCol = headers.indexOf('Agent');
    var statusCol = headers.indexOf('Status');
    var remarksCol = headers.indexOf('Remarks');
    var nameCol = headers.indexOf('Name');
    var emailCol = headers.indexOf('Email');
    var passportCol = headers.indexOf('Passport');
    var nationalityCol = headers.indexOf('Nationality');
    var programmeCol = headers.indexOf('Programme');
    var structureCol = headers.indexOf('Structure');
    var locationCol = headers.indexOf('Location');

    if (refCol === -1) throw new Error('Reference column not found');

    var rowIndex = -1;
    for (var i = 1; i < data.length; i++) {
      if (data[i][refCol] === appId) {
        if (user.role === 'agent' && agentCol !== -1 && data[i][agentCol] !== user.name) {
          throw new Error('Access denied');
        }
        rowIndex = i;
        break;
      }
    }
    if (rowIndex === -1) throw new Error('Lead not found');

    var validStatuses = ['New', 'Offer Sent', 'Accepted', 'Enrolled', 'Deleted'];
    if (updates.status !== undefined) {
      if (user.role === 'agent' && user.name !== data[rowIndex][agentCol]) {
        throw new Error('Access denied');
      }
      if (validStatuses.indexOf(updates.status) === -1) throw new Error('Invalid status: ' + updates.status);
      updateCell_(CONFIG.LEADS_SHEET_ID, 'Leads', rowIndex, statusCol, updates.status);
    }
    if (updates.remarks !== undefined && remarksCol !== -1) {
      if (user.role === 'agent' && user.name !== data[rowIndex][agentCol]) {
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

function deleteLead(appId) {
  var lock = LockService.getScriptLock();
  lock.waitLock(5000);
  try {
    var user = getCurrentUser_();
    if (user.role !== 'admin') throw new Error('Admin only');

    var data = getSheetData_(CONFIG.LEADS_SHEET_ID, 'Leads');
    var headers = data[0];
    var refCol = headers.indexOf('Reference');
    var statusCol = headers.indexOf('Status');
    if (refCol === -1 || statusCol === -1) throw new Error('Required columns not found');

    for (var i = 1; i < data.length; i++) {
      if (data[i][refCol] === appId) {
        updateCell_(CONFIG.LEADS_SHEET_ID, 'Leads', i, statusCol, 'Deleted');
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

function restoreLead(appId) {
  var lock = LockService.getScriptLock();
  lock.waitLock(5000);
  try {
    var user = getCurrentUser_();
    if (user.role !== 'admin') throw new Error('Admin only');

    var data = getSheetData_(CONFIG.LEADS_SHEET_ID, 'Leads');
    var headers = data[0];
    var refCol = headers.indexOf('Reference');
    var statusCol = headers.indexOf('Status');
    if (refCol === -1 || statusCol === -1) throw new Error('Required columns not found');

    for (var i = 1; i < data.length; i++) {
      if (data[i][refCol] === appId) {
        updateCell_(CONFIG.LEADS_SHEET_ID, 'Leads', i, statusCol, 'New');
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

function getForms(filters) {
  filters = filters || {};
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

function getForm(formId) {
  try {
    var user = getCurrentUser_();
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



function getDashboard(agentIdFilter) {
  try {
    var summary = getDashboardSummary_(agentIdFilter);
    return { success: true, summary: summary };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

function fixLeadAgents() {
  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    var user = getCurrentUser_();
    if (user.role !== 'admin') throw new Error('Admin only');

    var leadSheet = getSheetByName_(CONFIG.LEADS_SHEET_ID, 'Leads');
    var leadData = leadSheet.getDataRange().getValues();
    if (leadData.length <= 1) return { success: true, fixed: 0, total: 0 };
    var leadHeaders = leadData[0];
    var formIdCol = leadHeaders.indexOf('FormID');
    var agentCol = leadHeaders.indexOf('Agent');
    if (formIdCol === -1 || agentCol === -1) throw new Error('Required columns not found');

    var formData = getSheetData_(CONFIG.FORMS_SHEET_ID, 'Forms');
    var formHeaders = formData[0];
    var formIdIdx = formHeaders.indexOf('FormID');
    var formAgentCol = formHeaders.indexOf('AgentName');
    if (formIdIdx === -1 || formAgentCol === -1) { formIdIdx = -1; }

    var fixed = 0;
    for (var i = 1; i < leadData.length; i++) {
      var currentAgent = String(leadData[i][agentCol] || '');
      var leadFormId = String(leadData[i][formIdCol] || '');
      if (currentAgent === 'Unknown' && leadFormId && formIdIdx !== -1) {
        for (var j = 1; j < formData.length; j++) {
          if (String(formData[j][formIdIdx]) === leadFormId) {
            var correctName = formData[j][formAgentCol] || '';
            if (correctName && correctName !== 'Unknown') {
              leadSheet.getRange(i + 1, agentCol + 1).setValue(correctName);
              fixed++;
            }
            break;
          }
        }
      }
    }
    return { success: true, fixed: fixed, total: leadData.length - 1 };
  } catch (e) {
    return { success: false, error: e.message };
  } finally {
    lock.releaseLock();
  }
}

function resetAllForms() {
  try {
    var user = getCurrentUser_();
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

