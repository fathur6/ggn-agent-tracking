function generateAndSendOffer_(input) {
  var lock = LockService.getScriptLock();
  lock.waitLock(15000);

  try {
    var appId = generateApplicationId_(CONFIG.LEADS_SHEET_ID, 'Leads');
    var now = new Date();
    var formattedDate = formatDateLong_(now);

    var progLower = (input.programme || '').toLowerCase();
    var programmeLevel = 'M';
    if (progLower.indexOf('doctor') !== -1 || progLower.indexOf('ph.d') !== -1 || progLower.indexOf('phd') !== -1) {
      programmeLevel = 'PHD';
    }

    var docName = 'Conditional Offer - ' + (input.fullName || 'Student');
    var templateDoc = DriveApp.getFileById(CONFIG.OFFER_LETTER_DOC_TEMPLATE_ID);
    var copiedDoc = templateDoc.makeCopy(docName, DriveApp.getFolderById(CONFIG.OFFER_LETTER_FOLDER_ID));
    var docId = copiedDoc.getId();
    var doc = DocumentApp.openById(docId);
    var body = doc.getBody();

    body.replaceText('\\{\\{Reference\\}\\}', appId);
    body.replaceText('\\{\\{Date\\}\\}', formattedDate);
    body.replaceText('\\{\\{Name\\}\\}', input.fullName || '');
    body.replaceText('\\{\\{Passport\\}\\}', input.passport || '');
    body.replaceText('\\{\\{Email\\}\\}', input.email || '');
    body.replaceText('\\{\\{Programme\\}\\}', input.programme || '');
    body.replaceText('\\{\\{Structure\\}\\}', input.structure || '');

    doc.saveAndClose();

    var pdfBlob = DriveApp.getFileById(docId).getAs('application/pdf');
    var pdfFilename = 'UNISZA Conditional Offer - ' + (input.fullName || 'Student') + '.pdf';
    var pdfFile = DriveApp.getFolderById(CONFIG.OFFER_LETTER_FOLDER_ID).createFile(pdfBlob).setName(pdfFilename);
    var pdfUrl = pdfFile.getUrl();

    copiedDoc.setTrashed(true);

    var sheet = getSheetByName_(CONFIG.LEADS_SHEET_ID, 'Leads');
    ensureLeadsHeaders_(sheet);

    var rowValues = [
      now.toISOString(),
      input.formId || '',
      input.agentId || '',
      input.location || '',
      input.remarks || '',
      appId,
      input.fullName || '',
      input.email || '',
      input.passport || '',
      input.nationality || '',
      input.programme || '',
      input.structure || '',
      'COL Sent',
    ];

    sheet.appendRow(rowValues);

    var emailBody = [
      'Dear ' + (input.fullName || 'Applicant') + ',',
      '',
      'Thank you for your interest in postgraduate study at Universiti Sultan Zainal Abidin.',
      '',
      'Please find attached your Conditional Offer Letter.',
      '',
      'Application ID: ' + appId,
      '',
      'You are required to submit your formal application through the official UniSZA application portal: https://siswa.unisza.edu.my/pascaonline/',
      '',
      'Best regards,',
      '',
      'Graduate School',
      'Universiti Sultan Zainal Abidin',
    ].join('\n');

    var ccEmails = [];
    if (input.agentEmail) ccEmails.push(input.agentEmail);
    ccEmails.push(CONFIG.EMAIL_CC);

    GmailApp.sendEmail(input.email, 'Conditional Offer - Universiti Sultan Zainal Abidin', emailBody, {
      attachments: [pdfBlob],
      name: 'UniSZA Graduate School',
      from: CONFIG.EMAIL_FROM,
      replyTo: CONFIG.EMAIL_REPLY_TO,
      cc: ccEmails.join(','),
    });

    return { applicationId: appId, pdfUrl: pdfUrl };
  } finally {
    lock.releaseLock();
  }
}

function ensureLeadsHeaders_(sheet) {
  var LEADS_HEADERS = [
    'Timestamp', 'FormID', 'AgentID', 'LocationEvent', 'Remarks',
    'Reference', 'Name', 'Email', 'Passport', 'Nationality',
    'Programme', 'Structure', 'Status',
  ];

  var data = sheet.getDataRange().getValues();
  if (data.length === 0) {
    sheet.appendRow(LEADS_HEADERS);
    return;
  }

  var existing = data[0];
  if (existing[0] === 'Timestamp' && existing.length === LEADS_HEADERS.length) {
    var match = true;
    for (var i = 0; i < LEADS_HEADERS.length; i++) {
      if (existing[i] !== LEADS_HEADERS[i]) { match = false; break; }
    }
    if (match) return;
  }

  if (data.length === 1 || !data[0] || String(data[0][0]) === '') {
    sheet.getRange(1, 1, 1, LEADS_HEADERS.length).setValues([LEADS_HEADERS]);
    return;
  }

  var isDirty = false;
  for (var j = 0; j < LEADS_HEADERS.length; j++) {
    if (j >= existing.length || existing[j] !== LEADS_HEADERS[j]) {
      isDirty = true;
      break;
    }
  }
  if (isDirty) {
    var renamed = false;
    if (existing.length >= 3 && existing[2] === 'Agent') {
      sheet.getRange(1, 3).setValue('AgentID');
      renamed = true;
    }
    if (existing.length >= 4 && existing[3] === 'Location') {
      sheet.getRange(1, 4).setValue('LocationEvent');
      renamed = true;
    }
    if (!renamed) {
      throw new Error('Leads sheet headers mismatch. Run migrateLeadsHeaders() from the editor or delete the Leads sheet and re-submit.');
    }
  }
}

function migrateLeadsHeaders() {
  try {
    var sheet = getSheetByName_(CONFIG.LEADS_SHEET_ID, 'Leads');
    var existing = sheet.getDataRange().getValues();
    if (existing.length === 0) return { success: true, message: 'No data' };
    var h = existing[0];
    var renamed = 0;
    if (h.length >= 3 && h[2] === 'Agent') { sheet.getRange(1, 3).setValue('AgentID'); renamed++; }
    if (h.length >= 4 && h[3] === 'Location') { sheet.getRange(1, 4).setValue('LocationEvent'); renamed++; }
    return { success: true, renamed: renamed };
  } catch (e) {
    return { success: false, error: e.message };
  }
}
