import { NextResponse } from 'next/server'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { name, email, message } = body

    // Validate required fields
    if (!name || !email || !message) {
      return NextResponse.json(
        { error: 'All fields are required: name, email, and message.' },
        { status: 400 }
      )
    }

    // Basic email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Please provide a valid email address.' },
        { status: 400 }
      )
    }

    // Sanitise inputs for safe HTML rendering
    const sanitise = (str: string) =>
      str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

    const { data, error } = await resend.emails.send({
      from: 'CGT Tracker Website <support@cgttracker.com>',
      to: 'support@cgttracker.com',
      subject: `New Contact Request: ${sanitise(name)}`,
      replyTo: email,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #2563eb 0%, #4f46e5 100%); padding: 24px 32px; border-radius: 12px 12px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 20px; font-weight: 700;">New Contact Request</h1>
          </div>
          <div style="background: #ffffff; padding: 32px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
              <tr>
                <td style="padding: 8px 0; color: #6b7280; font-size: 14px; font-weight: 600; width: 100px; vertical-align: top;">Name</td>
                <td style="padding: 8px 0; color: #111827; font-size: 14px;">${sanitise(name)}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280; font-size: 14px; font-weight: 600; vertical-align: top;">Email</td>
                <td style="padding: 8px 0; color: #111827; font-size: 14px;"><a href="mailto:${sanitise(email)}" style="color: #2563eb;">${sanitise(email)}</a></td>
              </tr>
            </table>
            <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px;">
              <div style="color: #6b7280; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px;">Message</div>
              <div style="color: #111827; font-size: 14px; line-height: 1.6; white-space: pre-wrap;">${sanitise(message)}</div>
            </div>
            <p style="margin-top: 24px; color: #9ca3af; font-size: 12px;">You can reply directly to this email to respond to the sender.</p>
          </div>
        </div>
      `,
    })

    if (error) {
      console.error('[Contact API] Resend error:', error)
      return NextResponse.json(
        { error: 'Failed to send message. Please try again later.' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, id: data?.id })
  } catch (err: any) {
    console.error('[Contact API] Unexpected error:', err)
    return NextResponse.json(
      { error: 'An unexpected error occurred. Please try again later.' },
      { status: 500 }
    )
  }
}
