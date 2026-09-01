function parseLegacyTextArray(value) {
  if (!value.startsWith('{') || !value.endsWith('}')) return null

  const contents = value.slice(1, -1).trim()
  if (!contents) return []

  try {
    const parsed = JSON.parse(`[${contents}]`)
    return Array.isArray(parsed) ? parsed : null
  } catch {
    return null
  }
}

export function serializeJsonRestoreValue(value) {
  if (value === null || value === undefined) return null

  if (typeof value !== 'string') return JSON.stringify(value)

  try {
    return JSON.stringify(JSON.parse(value))
  } catch {
    const legacyArray = parseLegacyTextArray(value)
    if (legacyArray) return JSON.stringify(legacyArray)

    // Preserve legacy text exactly when it cannot be interpreted as structured JSON.
    return JSON.stringify(value)
  }
}

export async function loadJsonColumns(client) {
  const result = await client.query(
    `SELECT table_name, column_name
     FROM information_schema.columns
     WHERE table_schema = current_schema()
       AND data_type IN ('json', 'jsonb')`,
  )

  const columnsByTable = new Map()
  for (const row of result.rows) {
    const columns = columnsByTable.get(row.table_name) || new Set()
    columns.add(row.column_name)
    columnsByTable.set(row.table_name, columns)
  }
  return columnsByTable
}

export function restoreRowValues(table, columns, row, jsonColumnsByTable) {
  const jsonColumns = jsonColumnsByTable.get(table) || new Set()
  return columns.map((column) => (
    jsonColumns.has(column)
      ? serializeJsonRestoreValue(row[column])
      : row[column]
  ))
}
