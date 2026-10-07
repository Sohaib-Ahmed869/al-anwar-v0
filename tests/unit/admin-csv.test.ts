import { describe, expect, it } from 'vitest'
import { csvCell, toCsv } from '../../server/lib/csv'
import { looksLike, photoType, typeOf } from '../../server/lib/filetypes'

/* M13: every export goes through one cell function, and anything a
   spreadsheet would run as a formula is neutralised — but plain numbers,
   including negative amounts, stay numbers. */
describe('CSV cells (M13)', () => {
  it.each([
    ['=HYPERLINK("http://evil","x")'],
    ['+1+cmd|calc'],
    ['-1+HYPERLINK("http://evil")'],
    ['-cmd'],
    ['@SUM(A1)'],
    ['\tTAB'],
    ['\rCR'],
    ['＝1+1'],
  ])('neutralises %j', (v) => {
    const out = csvCell(v)
    expect(out.replace(/^"/, '').startsWith("'")).toBe(true)
  })

  it.each([['-12.50'], ['42'], ['0.5'], ['-3']])('leaves the number %j alone', (v) => {
    expect(csvCell(v)).toBe(v)
  })

  it('quotes commas, quotes and line breaks', () => {
    expect(csvCell('Smith, John')).toBe('"Smith, John"')
    expect(csvCell('say "hi"')).toBe('"say ""hi"""')
    expect(toCsv([['a', 1, null, true]])).toBe('a,1,,Yes\r\n')
  })
})

/* H1: the server, not the browser, decides what an uploaded file is. */
describe('file types (H1)', () => {
  const PDF = Buffer.from('%PDF-1.4\n%…')
  const HTML = Buffer.from('<html><script>alert(1)</script></html>')
  const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0])
  const ZIP = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0, 0])

  it('accepts a file whose bytes match its extension', () => {
    expect(looksLike('.pdf', PDF)).toBe(true)
    expect(looksLike('.png', PNG)).toBe(true)
    expect(looksLike('.docx', ZIP)).toBe(true)
    expect(looksLike('.txt', HTML)).toBe(true)
  })

  it('refuses HTML dressed up as a PDF, image or Word file', () => {
    expect(looksLike('.pdf', HTML)).toBe(false)
    expect(looksLike('.png', HTML)).toBe(false)
    expect(looksLike('.docx', HTML)).toBe(false)
    expect(looksLike('.html', HTML)).toBe(false)
  })

  it('takes the type from the extension only', () => {
    expect(typeOf('policy.pdf')).toBe('application/pdf')
    expect(typeOf('notes.txt')).toBe('text/plain; charset=utf-8')
    expect(typeOf('page.html')).toBe('application/octet-stream')
  })

  it('reads a photo type from its bytes', () => {
    expect(photoType(PNG)?.mime).toBe('image/png')
    expect(photoType(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))?.ext).toBe('.jpg')
    expect(photoType(HTML)).toBeNull()
  })
})
