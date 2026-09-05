/**
 * Netlify Function: Checagem em tempo real do status Pix
 * Endpoint: GET /.netlify/functions/check-pix-status?paymentId=...
 */

const SUPABASE_URL = "https://bvbckfajmkfiajjymkmu.supabase.co";
const SUPABASE_KEY = "sb_publishable_4tijqvw0v2NFeD6Lg8q_9w_wvDw6SyL";
const ADMIN_PIN = "EG01052027";

exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Content-Type": "application/json",
  };

  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers, body: "" };

  const paymentId = (event.queryStringParameters && event.queryStringParameters.paymentId) ||
    (event.queryStringParameters && event.queryStringParameters.id);

  if (!paymentId) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "paymentId obrigatório" }) };
  }

  const accessToken =
    process.env.MP_ACCESS_TOKEN ||
    process.env.MERCADO_PAGO_ACCESS_TOKEN ||
    "APP_USR-4886951032560827-090416-0a3fe71b92203582c68fb30b49df9540-474353646";

  try {
    const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { "Authorization": `Bearer ${accessToken.trim()}` },
    });

    if (!mpRes.ok) {
      return { statusCode: mpRes.status, headers, body: JSON.stringify({ error: "mp_error" }) };
    }

    const mpData = await mpRes.json();
    const isApproved = mpData.status === "approved";

    if (isApproved && mpData.external_reference) {
      try {
        const ref = JSON.parse(mpData.external_reference);
        const itemId = ref.id;
        const guestName = ref.guest || "Convidado";
        const itemName = ref.item || "Presente";

        const supabaseHeaders = {
          "apikey": SUPABASE_KEY,
          "Authorization": `Bearer ${SUPABASE_KEY}`,
          "Content-Type": "application/json",
        };

        const stateRes = await fetch(`${SUPABASE_URL}/rest/v1/wedding_gift_states?item_id=eq.${Number(itemId)}&select=*`, {
          headers: supabaseHeaders,
        });
        const stateData = await stateRes.json();
        const existingState = Array.isArray(stateData) && stateData.length > 0 ? stateData[0] : null;

        if (!existingState || existingState.status !== "purchased") {
          let requestId = existingState ? existingState.purchase_request_id : null;
          if (!requestId) {
            const submitRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/wedding_submit_purchase_request`, {
              method: "POST",
              headers: supabaseHeaders,
              body: JSON.stringify({
                p_item_id: Number(itemId),
                p_item_name: itemName,
                p_guest_name: guestName,
              }),
            });
            requestId = await submitRes.json();
          }

          if (requestId) {
            await fetch(`${SUPABASE_URL}/rest/v1/rpc/wedding_review_purchase_request`, {
              method: "POST",
              headers: supabaseHeaders,
              body: JSON.stringify({
                p_request_id: requestId,
                p_pin: ADMIN_PIN,
                p_action: "approve",
              }),
            });
          }
        }
      } catch (autoErr) {
        console.warn("Aviso ao auto-aprovar Netlify Function:", autoErr);
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ status: mpData.status, approved: isApproved }),
    };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
