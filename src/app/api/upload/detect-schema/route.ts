import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { GoogleGenAI, Type } from '@google/genai'

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })

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

    const prompt = `You are a financial data parser designed to map broker CSV formats. Extract the exact column header names for Date, Ticker, Quantity, Price, Amount, and Fees from the provided sample. 
    
IMPORTANT RULES:
1. For the date format, analyse the date strings and explicitly output "DD/MM/YYYY" or "MM/DD/YYYY". If ambiguous, always assume "DD/MM/YYYY" for this UK user. Do not return null for columns that exist in the header.
2. If the transaction type is embedded in a description field as a word like 'Bought', 'Sold', 'Buy', 'Sell', or a phrase like 'Market buy', 'Market sell' — extract it via substring/word matching, not exact match.
3. If a price or cost column name contains '(p)' or 'pence' — the values are in pence and must be divided by 100 to convert to pounds.
4. If there is no explicit BUY/SELL column but there IS a quantity column where negative values represent sells — set type_source to 'quantity_sign'.
5. If there are metadata/header rows mixed into the data (e.g. a column value of 'Header' or 'SubTotal') — set has_metadata_rows to true and specify which column value identifies them so they can be skipped.
6. Always return the ticker column name separately from the description column. If the ticker must be extracted from a description field, set ticker_from_description to true and provide a regex pattern.

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
            broker_name: { type: Type.STRING, nullable: true, description: "Name of the broker, e.g. Trading212, Hargreaves Lansdown, IBKR" },
            date_column: { type: Type.STRING, description: "Exact name of the date column" },
            date_format: { type: Type.STRING, description: "Strict format of the date, must be DD/MM/YYYY or MM/DD/YYYY" },
            type_column: { type: Type.STRING, nullable: true, description: "Column determining if it is a buy, sell, or dividend" },
            type_source: { type: Type.STRING, nullable: true },
            buy_indicator: { type: Type.STRING, nullable: true, description: "The string text inside the type column that indicates a BUY" },
            sell_indicator: { type: Type.STRING, nullable: true, description: "The string text inside the type column that indicates a SELL" },
            dividend_indicator: { type: Type.STRING, nullable: true },
            ticker_column: { type: Type.STRING, description: "Exact name of the ticker or symbol column" },
            ticker_from_description: { type: Type.BOOLEAN },
            ticker_regex: { type: Type.STRING, nullable: true, description: "Regex pattern to extract ticker if ticker_from_description is true" },
            description_column: { type: Type.STRING, nullable: true },
            quantity_column: { type: Type.STRING, description: "Exact name of the quantity or shares column" },
            quantity_from_description: { type: Type.BOOLEAN },
            price_column: { type: Type.STRING, description: "Exact name of the price per share column" },
            price_from_description: { type: Type.BOOLEAN },
            amount_column: { type: Type.STRING, description: "Exact name of the total amount or net value column" },
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
            notes: { type: Type.STRING, nullable: true },
          },
          required: ["date_column", "date_format", "ticker_column", "quantity_column", "price_column", "amount_column"]
        },
        temperature: 0.1,
      }
    })

    const text = response.text
    if (!text) {
      throw new Error('No response from Gemini')
    }

    const schemaMapping = JSON.parse(text)
    
    // In a real app we'd also check the DB for cached schemas from the same broker.
    
    return NextResponse.json({ schema: schemaMapping })
  } catch (error: any) {
    console.error('Schema detection error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
