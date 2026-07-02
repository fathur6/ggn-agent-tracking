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
    var templateDoc = DriveApp.getFileById(CONFIG.OFFER_TEMPLATE_DOC_ID);
    var copiedDoc = templateDoc.makeCopy(docName, DriveApp.getFolderById(CONFIG.OFFER_OUTPUT_FOLDER_ID));
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
    var folder = DriveApp.getFolderById(CONFIG.OFFER_OUTPUT_FOLDER_ID);
    var pdfFile = folder.createFile(pdfBlob).setName(pdfFilename);
    var pdfUrl = pdfFile.getUrl();

    copiedDoc.setTrashed(true);

    var sheet = getSheetByName_(CONFIG.LEADS_SHEET_ID, 'Leads');
    var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn() || 13).getValues()[0];

    ensureHeader_(sheet, headers, 'Timestamp');
    ensureHeader_(sheet, headers, 'FormID');
    ensureHeader_(sheet, headers, 'Agent');
    ensureHeader_(sheet, headers, 'Location');
    ensureHeader_(sheet, headers, 'Remarks');
    ensureHeader_(sheet, headers, 'Reference');
    ensureHeader_(sheet, headers, 'Name');
    ensureHeader_(sheet, headers, 'Email');
    ensureHeader_(sheet, headers, 'Passport');
    ensureHeader_(sheet, headers, 'Nationality');
    ensureHeader_(sheet, headers, 'Programme');
    ensureHeader_(sheet, headers, 'Structure');
    ensureHeader_(sheet, headers, 'Status');

    var rowValues = [
      now.toISOString(),
      input.formId || '',
      input.agentName || 'Unknown',
      input.location || '',
      input.remarks || '',
      appId,
      input.fullName || '',
      input.email || '',
      input.passport || '',
      input.nationality || '',
      input.programme || '',
      input.structure || '',
      'Offer Sent',
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
      cc: ccEmails.join(','),
      replyTo: CONFIG.EMAIL_REPLY_TO,
    });

    return { applicationId: appId, pdfUrl: pdfUrl };
  } finally {
    lock.releaseLock();
  }
}

function ensureHeader_(sheet, headers, name) {
  if (headers.indexOf(name) === -1) {
    sheet.getRange(1, sheet.getLastColumn() + 1).setValue(name);
  }
}
