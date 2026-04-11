const fs = require('fs')
const Papa = require('papaparse')

const csvContent = fs.readFileSync('/Users/parvinderlongani/Downloads/test-transactions.csv', 'utf8')
const parsed = Papa.parse(csvContent, { header: true, skipEmptyLines: true })
const rows = parsed.data

const schema = {
  date_column: 'Date',
  date_format: 'DD/MM/YYYY',
  ticker_column: 'Ticker',
  quantity_column: 'Quantity',
  price_column: 'Price',
  amount_column: 'Amount',
  fees_column: 'Fees',
  type_column: 'Type',
  buy_indicator: 'buy',
  sell_indicator: 'sell',
}

function parseUKDate(dateStr, format) {
  if (!dateStr) return null
  try {
    if (dateStr.includes('T')) {
      const d = new Date(dateStr)
      if (!isNaN(d.getTime())) return d.toISOString().split('T')[0]
    }
    
    const upperFormat = format ? format.toUpperCase() : ''
    const parts = dateStr.split(/[\/\-\s]/)
    
    if (parts.length >= 3) {
      let d = null
      if (upperFormat === 'YYYY-MM-DD') d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]))
      else if (upperFormat === 'MM/DD/YYYY' || upperFormat === 'MM-DD-YYYY') d = new Date(Number(parts[2]), Number(parts[0]) - 1, Number(parts[1]))
      else if (upperFormat === 'DD/MM/YYYY' || upperFormat === 'DD-MM-YYYY' || upperFormat === 'DD-MMM-YYYY') d = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]))
      
      if (d && !isNaN(d.getTime())) {
        const yyyy = d.getFullYear()
        const mm = String(d.getMonth() + 1).padStart(2, '0')
        const dd = String(d.getDate()).padStart(2, '0')
        return `${yyyy}-${mm}-${dd}`
      }
    }
    const d = new Date(dateStr)
    if (!isNaN(d.getTime())) {
        const yyyy = d.getFullYear()
        const mm = String(d.getMonth() + 1).padStart(2, '0')
        const dd = String(d.getDate()).padStart(2, '0')
        return `${yyyy}-${mm}-${dd}`
    }
    return null
  } catch {
    return null
  }
}

const transactions = []
let droppedCount = 0

for (const row of rows) {
  let typeStr = ''
  if (schema.type_column && row[schema.type_column]) {
    typeStr = String(row[schema.type_column]).toUpperCase()
  } else if (schema.description_column && row[schema.description_column]) {
    typeStr = String(row[schema.description_column]).toUpperCase()
  }

  let type = null
  if (schema.buy_indicator && typeStr.includes(schema.buy_indicator.toUpperCase())) type = 'BUY'
  else if (schema.sell_indicator && typeStr.includes(schema.sell_indicator.toUpperCase())) type = 'SELL'
  else if (schema.dividend_indicator && typeStr.includes(schema.dividend_indicator.toUpperCase())) type = 'DIVIDEND'
  
  if (!type) {
    if (schema.amount_column && row[schema.amount_column]) {
       const amt = parseFloat(String(row[schema.amount_column]).replace(/,/g, ''))
       if (amt < 0) type = 'BUY'
       else if (amt > 0) type = 'SELL'
    }
  }
  
  if (!type) { droppedCount++; continue; }

  let ticker = schema.ticker_column ? row[schema.ticker_column] : ''
  if (!ticker && schema.description_column) {
     ticker = String(row[schema.description_column]).split(' ')[0]
  }
  if (!ticker) { droppedCount++; continue; }

  let qty = 0
  if (schema.quantity_column && row[schema.quantity_column]) {
    qty = Math.abs(parseFloat(String(row[schema.quantity_column]).replace(/,/g, '')))
  }

  let price = 0
  if (schema.price_column && row[schema.price_column]) {
    price = Math.abs(parseFloat(String(row[schema.price_column]).replace(/,/g, '')))
  }

  let totalGBP = 0
  if (schema.amount_is_split) {
     if (type === 'BUY' && schema.debit_column && row[schema.debit_column]) totalGBP = Math.abs(parseFloat(String(row[schema.debit_column]).replace(/,/g, '')))
     if (type === 'SELL' && schema.credit_column && row[schema.credit_column]) totalGBP = Math.abs(parseFloat(String(row[schema.credit_column]).replace(/,/g, '')))
  } else if (schema.amount_column && row[schema.amount_column]) {
     totalGBP = Math.abs(parseFloat(String(row[schema.amount_column]).replace(/,/g, '')))
  }

  let fees = 0
  if (schema.fees_column && row[schema.fees_column]) {
    fees = Math.abs(parseFloat(String(row[schema.fees_column]).replace(/,/g, '')))
  }

  if (!price && qty > 0) price = totalGBP / qty

  const dateStr = schema.date_column ? row[schema.date_column] : ''
  const date = parseUKDate(dateStr, schema.date_format)

  if (!date || isNaN(qty) || isNaN(totalGBP) || qty <= 0) { 
    console.log(`DROPPED: Date: ${date}, dateStr: ${dateStr}, qty: ${qty}, totalGBP: ${totalGBP}`); 
    droppedCount++; 
    continue; 
  }

  transactions.push({ date, type, ticker, qty, price, totalGBP, fees })
}

console.log(`Total rows: ${rows.length}`);
console.log(`Parsed successfully: ${transactions.length}`);
console.log(`Dropped rows: ${droppedCount}`);
if (transactions.length > 0) console.log("Sample of first 2:", transactions.slice(0, 2));

