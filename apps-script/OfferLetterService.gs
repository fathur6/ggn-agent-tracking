function generateAndSendOffer_(input) {
  var appId = generateApplicationId_(CONFIG.PROSPECT_SHEET_ID, 'Prospects');
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

  var sheet = getSheetByName_(CONFIG.PROSPECT_SHEET_ID, 'Prospects');
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn() || 10).getValues()[0];
  if (headers.indexOf('Timestamp') === -1) sheet.getRange(1, sheet.getLastColumn() + 1).setValue('Timestamp');
  if (headers.indexOf('Agent') === -1) sheet.getRange(1, sheet.getLastColumn() + 1).setValue('Agent');
  if (headers.indexOf('Location') === -1) sheet.getRange(1, sheet.getLastColumn() + 1).setValue('Location');
  if (headers.indexOf('Remarks') === -1) sheet.getRange(1, sheet.getLastColumn() + 1).setValue('Remarks');
  if (headers.indexOf('Reference') === -1) sheet.getRange(1, sheet.getLastColumn() + 1).setValue('Reference');
  if (headers.indexOf('Name') === -1) sheet.getRange(1, sheet.getLastColumn() + 1).setValue('Name');
  if (headers.indexOf('Passport') === -1) sheet.getRange(1, sheet.getLastColumn() + 1).setValue('Passport');
  if (headers.indexOf('Email') === -1) sheet.getRange(1, sheet.getLastColumn() + 1).setValue('Email');
  if (headers.indexOf('Programme') === -1) sheet.getRange(1, sheet.getLastColumn() + 1).setValue('Programme');
  if (headers.indexOf('Structure') === -1) sheet.getRange(1, sheet.getLastColumn() + 1).setValue('Structure');

  var rowValues = [
    now.toISOString(),
    input.agentName || 'Unknown',
    input.location || '',
    input.remarks || '',
    appId,
    input.fullName || '',
    input.passport || '',
    input.email || '',
    input.programme || '',
    input.structure || '',
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

  return {
    applicationId: appId,
    pdfUrl: pdfUrl,
  };
}
