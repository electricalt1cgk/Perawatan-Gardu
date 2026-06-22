const fs = require('fs');

const originalData = {
  'SO 24': ['Ruangan', 'SDP', 'PP GARBARATA 4 BOARDING LOUNGE', 'GB', 'LP-BL 4E (BOARDING LOUNGE EMERGENCY)', 'PP-BL 4P (BOARDING LOUNGE PRIORITY)', 'LP-BL 4E (BOARDING LOUNGE EMERGENCY)', 'PP-BL-4P (BOARDING LOUNGE PRIORITY)'],
  'SO 25': ['Ruangan', 'SDP', 'SDP-P7', 'PP GARBARATA-5 BOARDING LOUNGE', 'SDP. VAC AHU', 'GB', 'PP/LP-BL 5E', 'PP/LP BL 5P'],
  'SO 26': ['Ruangan', 'SDP', 'SDP-P8', 'SDP-VAC AHU 9', 'SDP-EMERGENCY-2 GARBARATA DAN ESCALATOR', 'PP-GARBARATA-6 BOARDING LOUNGE', 'GB', 'PP. TOILET SURVEY+CUSTOMER SURVEY BL2', 'PP. ACCES CONTROL+LAN BL2', 'PP. IPTN BL2', 'PP. DIDS-BIDS BL2', 'PANEL X-RAY 6 (BL 5-7)', 'PP/LP-BL 6P', 'PP/LP-BL 6E'],
  'SO 27': ['Ruangan', 'SDP', 'SDP-VAC AHU 10', 'PP-GARBARATA-7 BOARDING LOUNGE', 'SDP-P9 (L+DASAR)', 'GB', 'PP/LP-BL 7E', 'PP/LP-BL 7P'],
  'P 15': ['Ruangan', 'LVDMP', 'SO 28P (AFL)', 'SO 28NP (AFL)', 'LVMDP PRIORITY 1A', 'LVMDP PRIORITY 1B', 'LVMDP PRIORITY 2A', 'LVMDP PRIORITY 2B', 'LVMDP PRIORITY 3A', 'LVMDP PRIORITY 3B', 'LVMDP PRIORITY 4A', 'LVMDP PRIORITY 4B', 'LVMDP PRIORITY 5A', 'LVMDP PRIORITY 5B', 'LVMDP PRIORITY 6A', 'LVMDP PRIORITY 6B'],
  'NP 15': ['Ruangan', 'LVMDP', 'LVMDP CHILLER C1A', 'LVMDP CHILLER C1B', 'LVMDP CHILLER C1C', 'P.UTILITY CHILLER', 'P-UPS CHILLER'],
  'ROOFTOP NP15 CHILLER': ['Ruangan', 'GB', 'CONTROL PANEL FOR COOLING TOWER 1', 'CONTROL PANEL FOR COOLING TOWER 2', 'CONTROL PANEL FOR COOLING TOWER 3', 'MAIN CONTROL VALVE COOLING TOWER 1', 'MAIN CONTROL VALVE COOLING TOWER 2', 'MAIN CONTROL VALVE COOLING TOWER 3'],
  'CC 17': ['Ruangan', 'SDP', 'SDP-VAC AHU 1', 'SDP-P1', 'SDP-UPS E1', 'SDP-BELT CONVEYOR 1', 'GB', 'PP-CMP', 'LP-CMP', 'PP-CME', 'LP-CME'],
  'CHECK IN SAYAP KIRI': ['Ruangan', 'GB', 'PP/LP-C1 2P', 'PP/LP-C1 2E', 'PP/LP-C1 1P', 'PP/LP-C1 1E'],
  'CHECK IN SAYAP KANAN': ['Ruangan', 'GB', 'P-DIDS DAN BIDS MBI LTD', 'PP-CUPPS', 'PP/LP C1 3P', 'PP/LP C1 3E'],
  'CC 25': ['Ruangan', 'SDP', 'SDP UPS-OUT-E1 & E2', 'SDP UPS-IN-E1 & E2', 'GB', 'LP-KR P', 'PP-KR P', 'LP-KR E', 'PP-KR E'],
  'CC 20': ['Ruangan', 'SDP', 'SDP LIFT', 'SDP BELT CONVEYOR 2', 'SDP UPS E2', 'SDP P2', 'SDP-VAC AHU 2'],
  'CC 19': ['Ruangan', 'SDP', 'SDP ESCALATOR', 'GB', 'PP-TOILET SURVEY', 'PP-ACCES CONTROL+LAN', 'PP-SELF CHECK IN'],
  'MAKE UP AREA (PANEL X - RAY BAGGAGE)': ['Ruangan', 'GB', 'P-IPTV MB LTD', 'PANEL X-RAY 1', 'PP/LP - BM P'],
  'BAGGAGE CLAIM KANAN': ['Ruangan', 'GB', 'PP/LP - BR 3P', 'PP/LP - BR 3E', 'PP/LP BA P'],
  'SDP NP 15 (CHILLER/CC 21)': ['Ruangan', 'SDP', 'SDP - VAC AHU 3', 'SDP - UPS E3', 'PANEL UPS IN-E3 & E4', 'PANEL UPS OUT-E3 & E5', 'SDP - P3'],
  'CKR BAWAH': ['Ruangan', 'SDP', 'SDP - VAC AHU 7', 'SDP - P10', 'SDP - UPS E4', 'SDP - GARBARATA 1', 'SDP - GARBARATA 2', 'GB', 'P - IPTV BL 3', 'UPS - IN 50 Kva', 'UPS - OUT 50 Kva', 'P - DIDS DAN BIDS BL3', 'UPS - IN EBL', 'UPS - OUT EBL', 'P - TOILET SURVEY + CUSTOMER SURVEY BL 3', 'PP - AC P', 'PP - AC E', 'LP - AC P', 'LP - AC E', 'LP - AC P', 'LP - AC E'],
  'SHOPPING ARCADE SAYAP KIRI': ['Ruangan', 'SDP', 'SDP - TENANT MB', 'SDP - VAC AHU 12', 'SDP - UPS E6', 'UPS-IN-E5 & E6', 'UPS-OUT-E5 & E7', 'SDP - P 12', 'GB', 'LP - OFF 2P', 'LP - OFF 2E', 'LP - OFF 2P', 'PP - OFF 2P', 'PP - OFF 2E', 'P - IPTV - MB LT.1', 'P - ACCES CONTROL'],
  'SHOPPING ARCADE SAYAP KIRI 2': ['Ruangan', 'SDP', 'SDP - VAC AHU 11', 'SDP - P 11', 'SDP - UPS E5', 'GB', 'PP/LP - OFF 1E', 'PP/LP - K-P', 'LP - OL 1E EMERGENCY LT 1', 'LP - OL 1P PRIORITY LT 1'],
  'SHOPPING ARCADE SAYAP KANAN': ['Ruangan', 'SDP', 'SDP - E7', 'SDP - VAC AHU 13', 'PANEL -UPS IN E7 & E8', 'PANEL -UPS OUT E7 & E8', 'SDP - P 13', 'GB', 'PP. TOILET SURVEY + CUSTOMER SURVEY MB LT.1', 'PP. ACCESS CONTROL + LAN', 'LP. OL 3E EMERGENCY LT. 1', 'LP - OL 3P PRIORITY LT. 1', 'PP/LP - LA E', 'PP - CA P', 'PP - CA E', 'LP - CA P', 'PP/LP - OFF 3E', 'PP/LP - OFF 3P'],
  'PERKANTORAN INJOURNEY': ['Ruangan', 'SDP', 'SDP - P 14', 'SDP - E8', 'SDP - VAC AHU 14', 'GB', 'LP. OL 4E EMERGENCY LT.1', 'LP. OL 4P PRIORITY LT.1', 'PP/LP - OFF 4E', 'PP/LP - OFF 4P'],
  'SO 21': ['Ruangan', 'SDP', 'SDP - P4', 'PP - GARBARATA - 1 MAIN BUILDING', 'SDP - VAC AHU 4', 'GB', 'PP/LP - BL 1P', 'PP/LP - BL 1E'],
  'SO 22': ['Ruangan', 'SDP', 'SDP - P5', 'SDP - VAC AHU 5', 'SDP - EMERGENCY - 1', 'GARBARATA - ESCALATOR PP - GARBARATA - 1 MAIN BUILDING', 'GB', 'PP/LP - BL 2P', 'PP/LP - BL 2E', 'PP. TOILET SURVEY + CUSTOMER SURVEY BL 1', 'PP. ACCESS CONTROL + LAN BL1', 'PP. IPTV BL 1', 'PP. DIDS - BIDS BL 1', 'PANEL X-RAY 2 (BL 1-4)'],
  'SO 23': ['Ruangan', 'SDP', 'SDP - VAC AHU 6', 'PP - GARBARATA - 3 BOARDING LOUNGE', 'SDP - UPS P6 (LT. DASAR)', 'GB', 'PP/LP - BL 3P', 'PP/LP - BL 3E'],
  'DATA CENTER': ['Ruangan', 'SDP', 'PANEL DATA CENTER'],
  'KANTOR SEWA AIRSIDE': ['Ruangan', 'GB', 'PP-KS (KANTOR SEWA)'],
  'BAGGAGE CLAIM KIRI': ['Ruangan', 'GB', 'PP/LP - BR 1P', 'PP/LP - BR 1E', 'PP/LP - BR 2E', 'PP/LP - BR 2P'],
  'CIC SAYAP KANAN BELAKANG': ['Ruangan', 'GB', 'PANEL UPS-IN EL 1', 'PANEL UPS-IN EL 2', 'PANEL UPS-OUT EL 1', 'PANEL UPS-OUT EL 2', 'PP-IPTV', 'PP-BIDS & FIDS', 'PANEL CITILINK', 'CITILINK MB LT.DASAR SAYAP KIRI', 'CITILINK MB LT.1']
};

let finalData = {};

for (let area in originalData) {
  let newList = [];
  let currentPrefix = "";
  
  originalData[area].forEach(item => {
    let upperItem = item.toUpperCase().trim();
    if (upperItem === "SDP" || upperItem === "GB" || upperItem === "LVDMP" || upperItem === "LVMDP") {
       currentPrefix = upperItem === "LVDMP" ? "LVMDP" : upperItem;
       // Skip adding the subheader itself
       return;
    }
    
    if (item === "Ruangan") {
       newList.push(item);
       return;
    }
    
    // For other items, check if we need to prefix
    let finalItem = item;
    if (currentPrefix !== "") {
       // Check if item already starts with the prefix
       // e.g. if currentPrefix is "SDP", and item is "SDP-P7" or "SDP . VAC"
       if (!upperItem.startsWith(currentPrefix)) {
          finalItem = currentPrefix + " " + item;
       }
    }
    newList.push(finalItem);
  });
  
  finalData[area] = newList;
}

const newDataStr = 'const lvmdpData = ' + JSON.stringify(finalData, null, 2) + ';\n';
fs.writeFileSync('data.js', newDataStr, 'utf8');
console.log('Restored and formatted perfectly!');
