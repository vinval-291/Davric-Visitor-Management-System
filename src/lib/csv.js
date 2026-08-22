/**
 * CSV export.
 *
 * Fields are quoted and internal quotes doubled, per RFC 4180. That
 * matters here: company names contain commas ("Acme, Ltd") and
 * purposes contain line breaks, both of which corrupt a naive export.
 *
 * The BOM is not decoration -- without it Excel opens UTF-8 as
 * Latin-1 and mangles any non-ASCII character in a visitor's name.
 */
function cell(value) {
  if (value === null || value === undefined) return ''
  const text = String(value)
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export function toCsv(columns, rows) {
  const header = columns.map((c) => cell(c.label)).join(',')
  const body = rows.map((row) =>
    columns.map((c) => cell(c.value(row))).join(','),
  )
  return [header, ...body].join('\r\n')
}

export function downloadCsv(filename, csv) {
  const blob = new Blob(['﻿' + csv], {
    type: 'text/csv;charset=utf-8;',
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  // Revoke on the next tick so the download has taken the reference.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
