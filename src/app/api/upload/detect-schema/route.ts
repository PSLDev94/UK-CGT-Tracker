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

    const prompt = `You are a financial data parser. You will receive the first rows of a CSV export from a UK stock broker. Analyse the headers and sample rows, then return ONLY valid JSON matching the schema with no other text, markdown, or explanation.\n\nCRITICAL DATE RULE: This is a UK broker CSV. Always default the date format to DD/MM/YYYY unless the format is unambiguously MM/DD/YYYY (e.g. a month value > 12 appears in the first position). Never assume MM/DD/YYYY for UK broker data.\n\nCSV Sample:\n${csvSample}`

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-pro',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            broker_name: { type: Type.STRING, nullable: true },
            date_column: { type: Type.STRING, nullable: true },
            date_format: { type: Type.STRING, nullable: true },
            type_column: { type: Type.STRING, nullable: true },
            type_source: { type: Type.STRING, nullable: true },
            buy_indicator: { type: Type.STRING, nullable: true },
            sell_indicator: { type: Type.STRING, nullable: true },
            dividend_indicator: { type: Type.STRING, nullable: true },
            ticker_column: { type: Type.STRING, nullable: true },
            ticker_from_description: { type: Type.BOOLEAN },
            description_column: { type: Type.STRING, nullable: true },
            quantity_column: { type: Type.STRING, nullable: true },
            quantity_from_description: { type: Type.BOOLEAN },
            price_column: { type: Type.STRING, nullable: true },
            price_from_description: { type: Type.BOOLEAN },
            amount_column: { type: Type.STRING, nullable: true },
            amount_is_split: { type: Type.BOOLEAN },
            debit_column: { type: Type.STRING, nullable: true },
            credit_column: { type: Type.STRING, nullable: true },
            fees_column: { type: Type.STRING, nullable: true },
            currency_column: { type: Type.STRING, nullable: true },
            default_currency: { type: Type.STRING },
            notes: { type: Type.STRING, nullable: true },
          },
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
