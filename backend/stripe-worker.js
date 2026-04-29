/**
 * Cloudflare Worker - Stripe Subscription Validation Backend
 *
 * Deploy this as a Cloudflare Worker (or adapt for Vercel/AWS Lambda).
 * Set the environment variable STRIPE_SECRET_KEY in your worker settings.
 *
 * Endpoints:
 *   POST /validate-subscription  { subscriptionId: "sub_..." }
 *   POST /create-checkout        { priceId: "price_...", successUrl: "...", cancelUrl: "..." }
 *   POST /create-portal          { customerId: "cus_..." }
 */

export default {
  async fetch(request, env) {
    // CORS headers for Chrome extension
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      if (path === '/validate-subscription' && request.method === 'POST') {
        const { subscriptionId } = await request.json();

        const res = await fetch(`https://api.stripe.com/v1/subscriptions/${subscriptionId}`, {
          headers: { 'Authorization': `Bearer ${env.STRIPE_SECRET_KEY}` },
        });

        if (!res.ok) {
          return json({ active: false, status: 'invalid' }, corsHeaders);
        }

        const sub = await res.json();
        return json({
          active: ['active', 'trialing'].includes(sub.status),
          status: sub.status,
          customerId: sub.customer,
          currentPeriodEnd: sub.current_period_end,
          cancelAtPeriodEnd: sub.cancel_at_period_end,
        }, corsHeaders);
      }

      if (path === '/create-checkout' && request.method === 'POST') {
        const { priceId, successUrl, cancelUrl } = await request.json();

        const params = new URLSearchParams({
          'mode': 'subscription',
          'line_items[0][price]': priceId,
          'line_items[0][quantity]': '1',
          'success_url': successUrl,
          'cancel_url': cancelUrl,
        });

        const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${env.STRIPE_SECRET_KEY}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: params.toString(),
        });

        const session = await res.json();
        return json({ url: session.url, sessionId: session.id }, corsHeaders);
      }

      if (path === '/create-portal' && request.method === 'POST') {
        const { customerId } = await request.json();

        const params = new URLSearchParams({
          'customer': customerId,
          'return_url': 'https://your-site.com/account',
        });

        const res = await fetch('https://api.stripe.com/v1/billing_portal/sessions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${env.STRIPE_SECRET_KEY}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: params.toString(),
        });

        const portal = await res.json();
        return json({ url: portal.url }, corsHeaders);
      }

      return new Response('Not Found', { status: 404, headers: corsHeaders });
    } catch (error) {
      return json({ error: error.message }, corsHeaders, 500);
    }
  },
};

function json(data, corsHeaders, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
