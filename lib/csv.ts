const FORMULA_PREFIX = /^[\s\u0000-\u001f]*[=+\-@]/

export function neutralizeSpreadsheetFormula(value: string) {
  return FORMULA_PREFIX.test(value) ? `'${value}` : value
}

export function csvCell(value: string | number | null | undefined) {
  const text = value === null || value === undefined ? '' : String(value)
  return `"${neutralizeSpreadsheetFormula(text).replace(/"/g, '""')}"`
}
