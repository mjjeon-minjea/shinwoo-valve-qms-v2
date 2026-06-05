// server/db_connector.js
// Mock Database Connector for Shinwoo Valve QMS
// Acting as a placeholder for Oracle/MSSQL connection

console.log("🔌 [DB] Connector Module Loaded");

const MOCK_DATA = {
  V_QMS_INBOUND: [
    { id: 1, item_code: "V-001", inspect_date: "2026-01-26", status: "OK" },
    { id: 2, item_code: "V-002", inspect_date: "2026-01-26", status: "NG" }
  ],
  V_QMS_PROCESS: [
    { id: 101, batch_no: "B20260126-01", process_name: "Casting", result: "PASS" }
  ],
  V_ITEM_MASTER: [
    { item_code: "V-001", item_name: "Butterfly Valve 100A", spec: "ANSI 150" },
    { item_code: "V-002", item_name: "Butterfly Valve 200A", spec: "ANSI 150" }
  ]
};

async function executeQuery(queryOrViewName) {
  console.log(`🔍 [DB] Executing Query on Mock DB: ${queryOrViewName}`);
  
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 500));

  if (MOCK_DATA[queryOrViewName]) {
    console.log(`✅ [DB] Found ${MOCK_DATA[queryOrViewName].length} records for ${queryOrViewName}`);
    return MOCK_DATA[queryOrViewName];
  }

  console.warn(`⚠️ [DB] No data found for ${queryOrViewName}`);
  return [];
}

export { executeQuery };
