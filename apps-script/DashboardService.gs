function getDashboardSummary_(agentIdFilter, userEmail) {
  var user = getCurrentUser_(userEmail);

  var leads = getSheetObjects_(CONFIG.LEADS_SHEET_ID, 'Leads');

  if (user.role === 'agent') {
    leads = leads.filter(function (l) {
      var agentVal = getLeadAgent_(l);
      return agentVal === user.agentId || agentVal === user.name;
    });
  } else if (user.role === 'admin' && agentIdFilter) {
    leads = leads.filter(function (l) { return getLeadAgent_(l) === agentIdFilter; });
  }

  var totalLeads = leads.length;
  var offersSent = leads.filter(function (l) { return l.Status === 'COL Sent'; }).length;
  var accepted = leads.filter(function (l) { return l.Status === 'Agreed'; }).length;
  var enrolled = leads.filter(function (l) { return l.Status === 'Enrolled'; }).length;
  var conversionRate = offersSent > 0 ? Math.round((accepted / offersSent) * 100) : 0;

  var byAgent = {};
  leads.forEach(function (l) {
    var key = getLeadAgent_(l) || 'Unknown';
    if (!byAgent[key]) {
      byAgent[key] = { agentName: key, leadCount: 0, offersSent: 0, accepted: 0, enrolled: 0 };
    }
    byAgent[key].leadCount++;
    if (l.Status === 'Offer Sent') byAgent[key].offersSent++;
    if (l.Status === 'Accepted') byAgent[key].accepted++;
    if (l.Status === 'Enrolled') byAgent[key].enrolled++;
  });

  var byStatus = {};
  leads.forEach(function (l) {
    var st = l.Status || 'New';
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
        status: l.Status,
        timestamp: l.Timestamp,
      };
    });

  var processingStats = getProcessingStats_(user);
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
    recentActivity: recentActivity,
  };
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
