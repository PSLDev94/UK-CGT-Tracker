import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { GoogleGenAI, Type } from '@google/genai'
import Papa from 'papaparse'

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })

/**
 * Validate that the AI-returned column names actually exist in the CSV headers.
 */
function validateSchema(schema: any, headers: string[]) {
  const errors: string[] = []
  const warnings: string[] = []

  const requiredColumns = [
    { key: 'date_column', label: 'Date' },
    { key: 'quantity_column', label: 'Quantity' },
  ]
  const optionalColumns = [
    { key: 'price_column', label: 'Price' },
    { key: 'amount_column', label: 'Amount' },
    { key: 'type_column', label: 'Type' },
    { key: 'ticker_column', label: 'Ticker' },
    { key: 'description_column', label: 'Description' },
    { key: 'fees_column', label: 'Fees' },
    { key: 'currency_column', label: 'Currency' },
    { key: 'debit_column', label: 'Debit' },
    { key: 'credit_column', label: 'Credit' },
    { key: 'metadata_column', label: 'Metadata' },
  ]

  for (const col of requiredColumns) {
    if (schema[col.key] && !headers.includes(schema[col.key])) {
      errors.push(`${col.label} column "${schema[col.key]}" not found in CSV headers: ${headers.join(', ')}`)
    }
  }

  for (const col of optionalColumns) {
    if (schema[col.key] && !headers.includes(schema[col.key])) {
      warnings.push(`${col.label} column "${schema[col.key]}" not found in headers — will be ignored`)
      schema[col.key] = null // Clear invalid mapping
    }
  }

  // Need at least price or amount
  if (!schema.price_column && !schema.amount_column) {
    errors.push('Neither Price nor Amount column could be identified')
  }

  // Need at least ticker or description
  if (!schema.ticker_column && !schema.description_column) {
    errors.push('Neither Ticker nor Description column could be identified')
  }

  return { errors, warnings }
}

export async function POST(req: Request) {
  try {
    const supabase: any = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { csvSample } = await req.json()
    if (!csvSample) {
      return NextResponse.json({ error: 'Missing csvSample' }, { status: 400 })
    }

    // Parse the sample to extract headers for validation
    const sampleParsed = Papa.parse(csvSample, { header: true, skipEmptyLines: true })
    const headers = sampleParsed.meta.fields || []
    const sampleRows = sampleParsed.data as any[]

    if (headers.length === 0) {
      return NextResponse.json({
        schema: null,
        confidence: 0,
        validation_errors: ['CSV appears to have no column headers'],
        validation_warnings: [],
        sample_type_values: [],
        headers: [],
      })
    }

    const prompt = `You are a financial data parser designed to map broker CSV formats. Extract the exact column header names for Date, Ticker, Quantity, Price, Amount, and Fees from the provided sample. 
    
IMPORTANT RULES:
1. For the date format, analyse the date strings and explicitly output "DD/MM/YYYY" or "MM/DD/YYYY". If ambiguous, always assume "DD/MM/YYYY" for this UK user. Do not return null for columns that exist in the header.
2. If the transaction type is embedded in a description field as a word like 'Bought', 'Sold', 'Buy', 'Sell', or a phrase like 'Market buy', 'Market sell' — extract it via substring/word matching, not exact match.
3. If a price or cost column name contains '(p)' or 'pence' — the values are in pence and must be divided by 100 to convert to pounds.
4. If there is no explicit BUY/SELL column but there IS a quantity column where negative values represent sells — set type_source to 'quantity_sign'.
5. If there are metadata/header rows mixed into the data (e.g. a column value of 'Header' or 'SubTotal') — set has_metadata_rows to true and specify which column value identifies them so they can be skipped.
6. Always return the ticker column name separately from the description column. If the ticker must be extracted from a description field, set ticker_from_description to true and provide a regex pattern.

CRITICAL INSTRUCTIONS:
- Do not guess the broker name. Only set broker_name if you are highly confident. If uncertain, set broker_name to null.
- Do not guess column mappings. If you cannot clearly identify what a column contains, set it to null rather than guessing.
- For transaction type detection, list ALL distinct values you see in the type column or description column in the 'sample_type_values' array so the developer can verify.
- If the CSV uses transaction codes (e.g. BUY, SELL, MKT BUY, B, S, SLD, BOT, DIV, CDIV, REC) specify the exact strings in buy_indicator and sell_indicator.
- If you are not confident about a mapping, it is better to return null than to return a wrong value.
- Return a 'confidence' integer from 0-100 indicating how confident you are in the overall mapping. Return confidence below 70 if: the CSV format is unfamiliar, columns are ambiguous, or transaction types are unclear.

Available CSV Headers: ${JSON.stringify(headers)}

CSV Sample:
${csvSample}`

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-pro',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            broker_name: { type: Type.STRING, nullable: true, description: "Name of the broker, e.g. Trading212, Hargreaves Lansdown, IBKR. Null if uncertain." },
            date_column: { type: Type.STRING, description: "Exact name of the date column" },
            date_format: { type: Type.STRING, description: "Strict format of the date, must be DD/MM/YYYY or MM/DD/YYYY" },
            type_column: { type: Type.STRING, nullable: true, description: "Column determining if it is a buy, sell, or dividend" },
            type_source: { type: Type.STRING, nullable: true },
            buy_indicator: { type: Type.STRING, nullable: true, description: "The exact string text inside the type column that indicates a BUY" },
            sell_indicator: { type: Type.STRING, nullable: true, description: "The exact string text inside the type column that indicates a SELL" },
            dividend_indicator: { type: Type.STRING, nullable: true },
            ticker_column: { type: Type.STRING, nullable: true, description: "Exact name of the ticker or symbol column" },
            ticker_from_description: { type: Type.BOOLEAN },
            ticker_regex: { type: Type.STRING, nullable: true, description: "Regex pattern to extract ticker if ticker_from_description is true" },
            description_column: { type: Type.STRING, nullable: true },
            quantity_column: { type: Type.STRING, description: "Exact name of the quantity or shares column" },
            quantity_from_description: { type: Type.BOOLEAN },
            price_column: { type: Type.STRING, nullable: true, description: "Exact name of the price per share column" },
            price_from_description: { type: Type.BOOLEAN },
            amount_column: { type: Type.STRING, nullable: true, description: "Exact name of the total amount or net value column" },
            amount_is_split: { type: Type.BOOLEAN },
            debit_column: { type: Type.STRING, nullable: true },
            credit_column: { type: Type.STRING, nullable: true },
            fees_column: { type: Type.STRING, nullable: true, description: "Exact name of the column for broker fees or commission" },
            currency_column: { type: Type.STRING, nullable: true },
            default_currency: { type: Type.STRING, nullable: true },
            has_metadata_rows: { type: Type.BOOLEAN },
            metadata_column: { type: Type.STRING, nullable: true, description: "Column containing metadata line identifiers" },
            metadata_exclusion_value: { type: Type.STRING, nullable: true, description: "Value marking a row to exclude, like 'Header'" },
            datetime_has_time: { type: Type.BOOLEAN, description: "True if the date column contains time components (e.g. HH:MM:SS), false if date-only" },
            confidence: { type: Type.NUMBER, description: "0-100 confidence in overall mapping accuracy. Below 70 if format is unfamiliar or ambiguous." },
            sample_type_values: { type: Type.ARRAY, items: { type: Type.STRING }, description: "All distinct values seen in the type/description column" },
            notes: { type: Type.STRING, nullable: true },
          },
          required: ["date_column", "date_format", "quantity_column", "confidence"]
        },
        temperature: 0.1,
      }
    })

    const text = response.text
    if (!text) {
      throw new Error('No response from Gemini')
    }

    const schemaMapping = JSON.parse(text)

    // Server-side validation
    const { errors: validationErrors, warnings: validationWarnings } = validateSchema(schemaMapping, headers)

    // If critical validation errors, reduce confidence to 0
    const finalConfidence = validationErrors.length > 0 ? 0 : (schemaMapping.confidence || 50)

    console.log('[Schema Detection]', {
      broker: schemaMapping.broker_name,
      confidence: finalConfidence,
      errors: validationErrors,
      warnings: validationWarnings,
      sampleTypes: schemaMapping.sample_type_values,
    })

    return NextResponse.json({
      schema: schemaMapping,
      confidence: finalConfidence,
      validation_errors: validationErrors,
      validation_warnings: validationWarnings,
      sample_type_values: schemaMapping.sample_type_values || [],
      headers,
    })
  } catch (error: any) {
    console.error('Schema detection error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
