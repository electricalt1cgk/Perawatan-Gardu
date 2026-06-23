/**
 * CARA PENGGUNAAN:
 * 1. Buka Google Spreadsheet baru.
 * 2. Buat sheet/tab pertama dengan nama "Inspeksi" atau biarkan "Sheet1".
 *    Header kolom di baris 1 (Urutan bebas, nama harus sama persis):
 *    - Timestamp
 *    - Area
 *    - Gardu/Panel
 *    - Tanggal
 *    - Kegiatan Perawatan
 *    - Kondisi
 *    - PIC
 *    - Catatan Tambahan
 * 3. Buat sheet/tab kedua dengan nama "Corrective" (Opsional, jika ingin memisahkan laporan corrective).
 *    Header kolom di baris 1 (Urutan bebas, nama harus sama persis):
 *    - Timestamp
 *    - Area
 *    - Gardu/Panel
 *    - Tanggal
 *    - Uraian Masalah
 *    - Tindakan Perbaikan
 *    - Status Perbaikan
 *    - PIC
 * 4. Klik menu "Ekstensi" > "Apps Script".
 * 5. Hapus semua kode yang ada, lalu paste kode di bawah ini.
 * 6. Simpan (Ctrl+S).
 * 7. Klik "Terapkan" (Deploy) > "Deployment baru".
 *    - Pilih jenis: Aplikasi Web (Web App)
 *    - Deskripsi: Bebas
 *    - Jalankan sebagai: Saya
 *    - Yang memiliki akses: Siapa saja (Anyone)
 * 8. Klik Terapkan/Deploy. Berikan otorisasi akses (Lanjutkan > Buka yang tidak aman / Advanced > Go to...).
 * 9. Copy URL Web App yang dihasilkan.
 * 10. Paste URL tersebut ke dalam aplikasi kita (di bagian Settings).
 */

const SHEET_PREVENTIVE_DEFAULT = "Sheet1";

function doPost(e) {
  return handleResponse(e);
}

function doGet(e) {
  return handleResponse(e);
}

function handleResponse(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(10000);

  try {
    var doc = SpreadsheetApp.getActiveSpreadsheet();
    
    // We expect a POST request with JSON payload or URL encoded params.
    var data = {};
    if (e.postData && e.postData.contents) {
      data = JSON.parse(e.postData.contents);
    } else {
      data = e.parameter;
    }

    if (data["action"] === "login") {
      var usersSheet = doc.getSheetByName("Users");
      if (!usersSheet) {
         return ContentService.createTextOutput(JSON.stringify({"result":"error", "message":"Tab 'Users' belum dibuat di Spreadsheet"})).setMimeType(ContentService.MimeType.JSON);
      }
      var usersData = usersSheet.getDataRange().getValues();
      var usersHeaders = usersData[0];
      var usernameIdx = usersHeaders.indexOf("Username");
      var passwordIdx = usersHeaders.indexOf("Password");
      var namaIdx = usersHeaders.indexOf("Nama");

      if (usernameIdx === -1 || passwordIdx === -1) {
         return ContentService.createTextOutput(JSON.stringify({"result":"error", "message":"Kolom Username atau Password tidak ditemukan di tab Users"})).setMimeType(ContentService.MimeType.JSON);
      }
      
      for (var j = 1; j < usersData.length; j++) {
          if (usersData[j][usernameIdx] == data["username"] && usersData[j][passwordIdx] == data["password"]) {
              var picName = namaIdx !== -1 ? usersData[j][namaIdx] : data["username"];
              return ContentService.createTextOutput(JSON.stringify({"result":"success", "nama": picName})).setMimeType(ContentService.MimeType.JSON);
          }
      }
      return ContentService.createTextOutput(JSON.stringify({"result":"error", "message":"Username atau Password salah"})).setMimeType(ContentService.MimeType.JSON);
    }

    // Mencegah baris kosong jika URL Web App tidak sengaja diklik/dibuka secara manual
    if (!data || Object.keys(data).length === 0 || !data["Area"]) {
      return ContentService
        .createTextOutput(JSON.stringify({"result":"error", "message":"No valid data received"}))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // Tentukan target sheet berdasarkan tipe laporan
    var targetSheetName = SHEET_PREVENTIVE_DEFAULT;
    if (data["Tipe Laporan"] === "Corrective") {
      // Jika tipe corrective, arahkan ke sheet "Corrective"
      targetSheetName = "Corrective";
    } else {
      // Jika sheet "Rutin" ada, gunakan itu, jika tidak gunakan "Sheet1"
      if (doc.getSheetByName("Rutin")) {
        targetSheetName = "Rutin";
      } else if (doc.getSheetByName("Inspeksi")) {
        targetSheetName = "Inspeksi";
      }
    }

    var sheet = doc.getSheetByName(targetSheetName);
    if (!sheet) {
      // Jika sheet khusus tidak ditemukan, gunakan sheet pertama yang ada
      var sheets = doc.getSheets();
      if (sheets && sheets.length > 0) {
          sheet = sheets[0];
      }
    }
    
    if (!sheet) {
       return ContentService
        .createTextOutput(JSON.stringify({"result":"error", "error":"Sheet tidak ditemukan"}))
        .setMimeType(ContentService.MimeType.JSON);
    }

    var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    var nextRow = sheet.getLastRow() + 1; // get next row
    
    var row = []; 
    // Loop through the header columns
    for (var i = 0; i < headers.length; i++) {
      var headerName = headers[i];
      if (headerName === "Timestamp") {
        row.push(Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm:ss"));
      } else {
        // use header name to get data from incoming JSON
        row.push(data[headerName] || "");
      }
    }
    
    // more efficient to set values as [][] array than individually
    sheet.getRange(nextRow, 1, 1, row.length).setValues([row]);
    
    return ContentService
      .createTextOutput(JSON.stringify({"result":"success", "row": nextRow}))
      .setMimeType(ContentService.MimeType.JSON);
  } catch(err) {
    return ContentService
      .createTextOutput(JSON.stringify({"result":"error", "error": err.message}))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

// Tambahan fungsi untuk menangani pre-flight CORS dari browser (OPTIONS request)
function doOptions(e) {
  var headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400"
  };
  return ContentService.createTextOutput("")
    .setMimeType(ContentService.MimeType.TEXT)
    .setHeaders(headers);
}
