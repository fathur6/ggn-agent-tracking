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

function sheetToObjects_(rows) {
  if (!rows || rows.length === 0) return [];
  var headers = rows[0];
  return rows.slice(1).map(function (row) {
    var obj = {};
    headers.forEach(function (h, i) {
      obj[h] = row[i] || '';
    });
    return obj;
  });
}

function findColumnIndex_(headers, name) {
  var idx = headers.indexOf(name);
  if (idx === -1) return null;
  return idx;
}

function formatDate_(date) {
  var y = date.getFullYear();
  var m = ('0' + (date.getMonth() + 1)).slice(-2);
  var d = ('0' + date.getDate()).slice(-2);
  return y + m + d;
}

function formatDateLong_(date) {
  var months = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  return date.getDate() + ' ' + months[date.getMonth()] + ' ' + date.getFullYear();
}

function padNumber_(num, size) {
  var s = String(num);
  while (s.length < size) s = '0' + s;
  return s;
}

function generateApplicationId_(spreadsheetId, sheetName) {
  var sheet = getSheetByName_(spreadsheetId, sheetName);
  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) return formatDate_(new Date()).slice(0, 8) + '-001';
  
  var headers = data[0];
  var appIdCol = headers.indexOf('Reference');
  if (appIdCol === -1) return formatDate_(new Date()).slice(0, 8) + '-001';
  
  var today = formatDate_(new Date()).slice(0, 8);
  var maxNum = 0;
  for (var i = 1; i < data.length; i++) {
    var appId = data[i][appIdCol] || '';
    if (appId.startsWith(today)) {
      var num = parseInt(appId.split('-')[1], 10) || 0;
      if (num > maxNum) maxNum = num;
    }
  }
  return today + '-' + padNumber_(maxNum + 1, 3);
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
