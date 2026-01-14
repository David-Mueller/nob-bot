declare module 'xlsx-populate' {
  export interface Cell {
    value(): unknown
    value(val: unknown): Cell
    style(name: string): unknown
    style(name: string, value: unknown): Cell
    formula(): string | undefined
    formula(formula: string): Cell
    rowNumber(): number
    columnNumber(): number
  }

  interface Range {
    startCell(): Cell
    endCell(): Cell
    value(): unknown[][]
    value(val: unknown[][]): Range
  }

  interface Row {
    cell(columnNumber: number): Cell
    height(): number
    height(height: number): Row
  }

  interface Column {
    width(): number
    width(width: number): Column
  }

  export interface Sheet {
    name(): string
    cell(address: string): Cell
    cell(rowNumber: number, columnNumber: number): Cell
    row(rowNumber: number): Row
    column(columnNumber: number | string): Column
    range(address: string): Range
    range(startRowNumber: number, startColumnNumber: number, endRowNumber: number, endColumnNumber: number): Range
    usedRange(): Range | undefined
  }

  export interface Workbook {
    sheet(nameOrIndex: string | number): Sheet | undefined
    sheets(): Sheet[]
    addSheet(name: string, indexOrBeforeSheet?: number | string | Sheet): Sheet
    deleteSheet(nameOrIndex: string | number): Workbook
    outputAsync(type?: string | object): Promise<Buffer | Blob | string | Uint8Array | ArrayBuffer>
    toFileAsync(path: string): Promise<void>
  }

  function fromFileAsync(path: string): Promise<Workbook>
  function fromDataAsync(data: Buffer | ArrayBuffer | Uint8Array | Blob): Promise<Workbook>
  function fromBlankAsync(): Promise<Workbook>

  // Date conversion utilities
  function dateToNumber(date: Date): number
  function numberToDate(num: number): Date
}
