/**
 * Netlify Function: Criação de Pagamento Pix Direto via Mercado Pago API
 * Endpoint: POST /.netlify/functions/create-pix
 */

const SUPABASE_URL = "https://bvbckfajmkfiajjymkmu.supabase.co";
const SUPABASE_KEY = "sb_publishable_4tijqvw0v2NFeD6Lg8q_9w_wvDw6SyL";

exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
  };

  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };

  const host = event.headers.host || event.headers["x-forwarded-host"];
  const SITE_URL = host ? `https://${host}` : "https://casamentoericaegabriel.vercel.app";

  const accessToken =
    process.env.MP_ACCESS_TOKEN ||
    process.env.MERCADO_PAGO_ACCESS_TOKEN ||
    "APP_USR-4886951032560827-090416-0a3fe71b92203582c68fb30b49df9540-474353646";

  try {
    const body = JSON.parse(event.body || "{}");
    const { itemId, itemName, itemPrice, guestName } = body;

    if (!itemName || !itemPrice || Number(itemPrice) <= 0) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: "Item e preço inválidos." }) };
    }

    const price = Number(Number(itemPrice).toFixed(2));
    const safeGuest = String(guestName || "Convidado").trim().slice(0, 50);

    const externalRef = JSON.stringify({
      id: Number(itemId) || 0,
      item: String(itemName).slice(0, 60),
      guest: safeGuest,
      method: "pix",
    });

    const idempotencyKey = `pix-${itemId}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    const mpPayload = {
      transaction_amount: price,
      description: `${String(itemName).slice(0, 50)} • Erica & Gabriel`,
      payment_method_id: "pix",
      payer: {
        email: "convidado@casamentoericaegabriel.com.br",
        first_name: safeGuest,
      },
      external_reference: externalRef,
      notification_url: `${SITE_URL}/api/mercadopago-webhook`,
    };

    const mpRes = await fetch("https://api.mercadopago.com/v1/payments", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken.trim()}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify(mpPayload),
    });

    const mpData = await mpRes.json();

    if (!mpRes.ok) {
      console.error("Erro MP Pix:", mpData);
      return {
        statusCode: mpRes.status || 500,
        headers,
        body: JSON.stringify({ error: "mp_pix_error", message: mpData.message || "Erro ao gerar cobrança Pix." }),
      };
    }

    const qrCode = mpData.point_of_interaction?.transaction_data?.qr_code || "";
    const qrCodeBase64 = mpData.point_of_interaction?.transaction_data?.qr_code_base64 || "";
    const paymentId = mpData.id;

    try {
      await fetch(`${SUPABASE_URL}/rest/v1/rpc/wedding_submit_purchase_request`, {
        method: "POST",
        headers: {
          "apikey": SUPABASE_KEY,
          "Authorization": `Bearer ${SUPABASE_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          p_item_id: Number(itemId),
          p_item_name: itemName,
          p_guest_name: safeGuest,
        }),
      });
    } catch (_) {}

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        paymentId,
        qrCode,
        qrCodeBase64,
        amount: price,
        status: mpData.status,
      }),
    };
  } catch (err) {
    console.error("Erro interno ao gerar Pix:", err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: "internal_error", message: err.message }) };
  }
};
