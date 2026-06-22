/**
 * CARA PENGGUNAAN:
 * 1. Buka Google Spreadsheet baru.
 * 2. Buat header di baris pertama secara berurutan:
 *    A1: Timestamp
 *    B1: Area
 *    C1: Gardu/Panel
 *    D1: Tanggal
 *    E1: Kegiatan Perawatan
 *    F1: Kondisi
 *    G1: PIC
 *    H1: Catatan Tambahan
 * 3. Klik menu "Ekstensi" > "Apps Script".
 * 4. Hapus semua kode yang ada, lalu paste kode di bawah ini.
 * 5. Simpan (Ctrl+S).
 * 6. Klik "Terapkan" (Deploy) > "Deployment baru".
 *    - Pilih jenis: Aplikasi Web (Web App)
 *    - Deskripsi: Bebas
 *    - Jalankan sebagai: Saya
 *    - Yang memiliki akses: Siapa saja (Anyone)
 * 7. Klik Terapkan/Deploy. Berikan otorisasi akses (Lanjutkan > Buka yang tidak aman / Advanced > Go to...).
 * 8. Copy URL Web App yang dihasilkan.
 * 9. Paste URL tersebut ke dalam aplikasi kita (di bagian Settings atau app.js).
 */

const SHEET_NAME = "Sheet1"; // Ganti jika nama sheet Anda berbeda

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
    var sheet = doc.getSheetByName(SHEET_NAME);
    
    // Header names must match the order in spreadsheet exactly if doing mapping, 
    // but here we'll just append raw row for simplicity or parse JSON.
    
    // We expect a POST request with JSON payload or URL encoded params.
    var data = {};
    if (e.postData && e.postData.contents) {
      data = JSON.parse(e.postData.contents);
    } else {
      data = e.parameter;
    }

    // Mencegah baris kosong jika URL Web App tidak sengaja diklik/dibuka secara manual
    if (!data || Object.keys(data).length === 0 || !data["Area"]) {
      return ContentService
        .createTextOutput(JSON.stringify({"result":"error", "message":"No valid data received"}))
        .setMimeType(ContentService.MimeType.JSON);
    }

    var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    var nextRow = sheet.getLastRow() + 1; // get next row
    
    var row = []; 
    // Loop through the header columns
    for (var i = 0; i < headers.length; i++) {
      var headerName = headers[i];
      if (headerName === "Timestamp") {
        row.push(new Date());
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
