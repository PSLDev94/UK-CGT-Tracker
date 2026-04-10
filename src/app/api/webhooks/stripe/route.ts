import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createAdminClient } from '@/lib/supabase/admin'

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error('STRIPE_SECRET_KEY is not configured')
  return new Stripe(key, { apiVersion: '2025-02-24.acacia' })
}

export async function POST(req: Request) {
  try {
    const stripe = getStripe()
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
    if (!webhookSecret) {
      return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 })
    }

    const rawBody = await req.text()
    const signature = req.headers.get('stripe-signature')

    if (!signature) {
      return NextResponse.json({ error: 'Missing stripe signature' }, { status: 400 })
    }

    let event: Stripe.Event

    try {
      event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret)
    } catch (err: any) {
      console.error(`Webhook signature verification failed.`, err.message)
      return NextResponse.json({ error: err.message }, { status: 400 })
    }

    const supabase: any = createAdminClient()

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const customerId = session.customer as string

        // Retrieve subscription to get end date
        if (session.subscription) {
          const subscription: any = await stripe.subscriptions.retrieve(session.subscription as string)
          await supabase
            .from('profiles')
            .update({
              subscription_status: 'active',
              subscription_end_date: new Date(subscription.current_period_end * 1000).toISOString(),
            })
            .eq('stripe_customer_id', customerId)
        }
        break
      }
      
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as any
        if (invoice.subscription) {
          const subscription: any = await stripe.subscriptions.retrieve(invoice.subscription as string)
          await supabase
            .from('profiles')
            .update({
              subscription_status: 'active',
              subscription_end_date: new Date(subscription.current_period_end * 1000).toISOString(),
            })
            .eq('stripe_customer_id', subscription.customer as string)
        }
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as any
        if (invoice.subscription) {
          const subscription: any = await stripe.subscriptions.retrieve(invoice.subscription as string)
          await supabase
            .from('profiles')
            .update({
              subscription_status: 'past_due',
            })
            .eq('stripe_customer_id', subscription.customer as string)
            
          // TODO: Send payment failed email
        }
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as any
        await supabase
          .from('profiles')
          .update({
            subscription_status: 'canceled',
          })
          .eq('stripe_customer_id', subscription.customer as string)
        break
      }

      default:
        console.log(`Unhandled event type ${event.type}`)
    }

    return NextResponse.json({ received: true })
  } catch (err: any) {
    console.error('Error in Stripe webhook:', err)
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 })
  }
}
