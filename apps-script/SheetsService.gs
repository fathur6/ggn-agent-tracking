function getSheetData_(spreadsheetId, sheetName) {
  var sheet = getSheetByName_(spreadsheetId, sheetName);
  return sheet.getDataRange().getValues();
}

function getSheetObjects_(spreadsheetId, sheetName) {
  var rows = getSheetData_(spreadsheetId, sheetName);
  return sheetToObjects_(rows);
}

function appendRow_(spreadsheetId, sheetName, values) {
  var sheet = getSheetByName_(spreadsheetId, sheetName);
  sheet.appendRow(values);
  return true;
}

function updateCell_(spreadsheetId, sheetName, rowIndex, colIndex, value) {
  var sheet = getSheetByName_(spreadsheetId, sheetName);
  sheet.getRange(rowIndex + 1, colIndex + 1).setValue(value);
  return true;
}

function findRowByColumn_(spreadsheetId, sheetName, columnName, value) {
  var data = getSheetData_(spreadsheetId, sheetName);
  if (data.length <= 1) return null;
  var colIndex = data[0].indexOf(columnName);
  if (colIndex === -1) return null;
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][colIndex] || '') === String(value)) {
      return { rowIndex: i, rowData: data[i] };
    }
  }
  return null;
}

function ensureHeader_(spreadsheetId, sheetName, headerName) {
  var sheet = getSheetByName_(spreadsheetId, sheetName);
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var idx = headers.indexOf(headerName);
  if (idx === -1) {
    sheet.getRange(1, sheet.getLastColumn() + 1).setValue(headerName);
    return sheet.getLastColumn() - 1;
  }
  return idx;
}

function deleteRowByColumn_(spreadsheetId, sheetName, columnName, value) {
  var data = getSheetData_(spreadsheetId, sheetName);
  var colIndex = data[0].indexOf(columnName);
  if (colIndex === -1) return false;
  for (var i = data.length - 1; i >= 1; i--) {
    if (String(data[i][colIndex] || '') === String(value)) {
      var sheet = getSheetByName_(spreadsheetId, sheetName);
      sheet.deleteRow(i + 1);
      return true;
    }
  }
  return false;
}
