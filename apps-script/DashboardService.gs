function getDashboardSummary_(agentIdFilter, userEmail, filters) {
  var user = getCurrentUser_(userEmail);
  filters = filters || {};

  var leads = getSheetObjects_(CONFIG.LEADS_SHEET_ID, 'Leads');

  var startDate = filters.dateFrom ? new Date(filters.dateFrom + 'T00:00:00') : null;
  var endDate = filters.dateTo ? new Date(filters.dateTo + 'T23:59:59') : null;
  if (startDate || endDate) {
    leads = leads.filter(function (l) {
      var timestamp = l.Timestamp ? new Date(l.Timestamp) : null;
      if (!timestamp || isNaN(timestamp.getTime())) return false;
      return (!startDate || timestamp >= startDate) && (!endDate || timestamp <= endDate);
    });
  }

  if (user.role === 'agent') {
    leads = leads.filter(function (l) {
      var agentVal = getLeadAgent_(l);
      return agentVal === user.agentId || agentVal === user.name;
    });
  } else if (user.role === 'admin' && agentIdFilter) {
    leads = leads.filter(function (l) { return getLeadAgent_(l) === agentIdFilter; });
  }

  var agents = getAgentDirectory_();
  var totalLeads = leads.length;
  var offersSent = leads.filter(function (l) { return normalizeLeadStatus_(l.Status) === 'COL Sent'; }).length;
  var accepted = leads.filter(function (l) { return normalizeLeadStatus_(l.Status) === 'Agreed'; }).length;
  var enrolled = leads.filter(function (l) { return normalizeLeadStatus_(l.Status) === 'Enrolled'; }).length;
  var conversionRate = offersSent > 0 ? Math.round((accepted / offersSent) * 100) : 0;

  var byAgent = {};
  leads.forEach(function (l) {
    var key = getLeadAgent_(l) || 'Unknown';
    if (!byAgent[key]) {
      byAgent[key] = { agentId: key, agentName: agents.byId[key] || key, leadCount: 0, offersSent: 0, accepted: 0, enrolled: 0 };
    }
    byAgent[key].leadCount++;
    var status = normalizeLeadStatus_(l.Status);
    if (status === 'COL Sent') byAgent[key].offersSent++;
    if (status === 'Agreed') byAgent[key].accepted++;
    if (status === 'Enrolled') byAgent[key].enrolled++;
  });
  agents.active.forEach(function (agent) {
    if (!byAgent[agent.id]) {
      byAgent[agent.id] = { agentId: agent.id, agentName: agent.name, leadCount: 0, offersSent: 0, accepted: 0, enrolled: 0 };
    }
  });

  var byStatus = {};
  leads.forEach(function (l) {
    var st = normalizeLeadStatus_(l.Status);
    byStatus[st] = (byStatus[st] || 0) + 1;
  });

  var recentActivity = leads
    .filter(function (l) { return l.Timestamp; })
    .sort(function (a, b) { return (b.Timestamp || '').localeCompare(a.Timestamp || ''); })
    .slice(0, 5)
    .map(function (l) {
      return {
        applicationId: l.Reference,
        fullName: l.Name,
         status: normalizeLeadStatus_(l.Status),
        timestamp: l.Timestamp,
      };
    });

  var processingStats = getProcessingStats_(user);
  var trend = {};
  leads.forEach(function (l) {
    if (!l.Timestamp) return;
    var day = l.Timestamp instanceof Date ? Utilities.formatDate(l.Timestamp, Session.getScriptTimeZone(), 'yyyy-MM-dd') : String(l.Timestamp).slice(0, 10);
    if (!trend[day]) trend[day] = { date: day, leads: 0, colSent: 0, agreed: 0, enrolled: 0 };
    trend[day].leads++;
    var status = normalizeLeadStatus_(l.Status);
    if (status === 'COL Sent') trend[day].colSent++;
    if (status === 'Agreed') trend[day].agreed++;
    if (status === 'Enrolled') trend[day].enrolled++;
  });

  return {
    totalLeads: totalLeads,
    offersSent: offersSent,
    accepted: accepted,
    enrolled: enrolled,
    conversionRate: conversionRate,
    groupsCount: processingStats.groupsCount,
    evalApproved: processingStats.evalApproved,
    underProcessing: processingStats.underProcessing,
    byAgent: Object.values(byAgent),
    byStatus: byStatus,
    funnel: { leads: totalLeads, colSent: offersSent, agreed: accepted, enrolled: enrolled },
    trend: Object.keys(trend).sort().map(function (key) { return trend[key]; }),
    filters: { dateFrom: filters.dateFrom || '', dateTo: filters.dateTo || '', agentId: agentIdFilter || '' },
    recentActivity: recentActivity,
  };
}

function normalizeLeadStatus_(status) {
  var value = String(status || '').trim().toLowerCase();
  if (value === 'offer sent' || value === 'col sent') return 'COL Sent';
  if (value === 'accepted' || value === 'agreed') return 'Agreed';
  if (value === 'enrolled') return 'Enrolled';
  if (value === 'deleted') return 'Deleted';
  return status || 'New';
}

function getAgentDirectory_() {
  var directory = { byId: {}, active: [] };
  try {
    var data = getSheetData_(CONFIG.AGENTS_SHEET_ID, 'Agents');
    var headerRow = 0;
    for (var i = 0; i < data.length; i++) {
      if (data[i].indexOf('AgentID') !== -1) { headerRow = i; break; }
    }
    var headers = data[headerRow] || [];
    var idCol = headers.indexOf('AgentID');
    var nameCol = headers.indexOf('Name');
    var statusCol = headers.indexOf('Status');
    if (idCol === -1 || nameCol === -1) return directory;
    for (var r = headerRow + 1; r < data.length; r++) {
      if (data[r][idCol]) {
        var id = data[r][idCol];
        var name = data[r][nameCol] || id;
        directory.byId[id] = name;
        if (statusCol === -1 || String(data[r][statusCol] || 'active').toLowerCase() !== 'inactive') {
          directory.active.push({ id: id, name: name });
        }
      }
    }
  } catch (e) { /* dashboard remains usable without directory data */ }
  return directory;
}

function getProcessingStats_(user) {
  var stats = { groupsCount: 0, evalApproved: 0, underProcessing: 0 };
  try {
    var groups = getSheetObjects_(CONFIG.PROGRESS_SHEET_ID, 'Groups');
    stats.groupsCount = groups.filter(function(g) { return g.FilingStatus === 'Active'; }).length;
  } catch (e) { /* ignore */ }
  try {
    var candidates = getSheetObjects_(CONFIG.PROGRESS_SHEET_ID, 'Candidate');
    candidates.forEach(function (c) {
      if (user.role === 'agent' && (c.AgentID || '') !== user.agentId) return;
      var progress = parseFloat(c['Progress (%)'] || 0);
      if (progress > 0.35) stats.evalApproved++;
      if (progress > 0 && progress < 0.80) stats.underProcessing++;
    });
  } catch (e) { /* ignore */ }
  return stats;
}
