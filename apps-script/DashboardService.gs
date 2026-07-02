function getDashboardSummary_(agentIdFilter) {
  var user = getCurrentUser_();

  var leads = getSheetObjects_(CONFIG.LEADS_SHEET_ID, 'Leads');

  if (user.role === 'agent') {
    leads = leads.filter(function (l) { return l.Agent === user.name; });
  } else if (user.role === 'admin' && agentIdFilter) {
    leads = leads.filter(function (l) { return l.Agent === agentIdFilter; });
  }

  var totalLeads = leads.length;
  var offersSent = leads.filter(function (l) { return l.Status === 'Offer Sent'; }).length;
  var accepted = leads.filter(function (l) { return l.Status === 'Accepted'; }).length;
  var enrolled = leads.filter(function (l) { return l.Status === 'Enrolled'; }).length;
  var conversionRate = offersSent > 0 ? Math.round((accepted / offersSent) * 100) : 0;

  var byAgent = {};
  leads.forEach(function (l) {
    var key = l.Agent || 'Unknown';
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

  return {
    totalLeads: totalLeads,
    offersSent: offersSent,
    accepted: accepted,
    enrolled: enrolled,
    conversionRate: conversionRate,
    byAgent: Object.values(byAgent),
    byStatus: byStatus,
    recentActivity: recentActivity,
  };
}
