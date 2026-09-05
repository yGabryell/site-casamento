/**
 * Netlify Function: Confirmação Automática de Compra
 * Endpoint: POST /.netlify/functions/confirm-purchase
 */

const SUPABASE_URL = "https://bvbckfajmkfiajjymkmu.supabase.co";
const SUPABASE_KEY = "sb_publishable_4tijqvw0v2NFeD6Lg8q_9w_wvDw6SyL";
const ADMIN_PIN = "EG01052027";

exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed. Use POST." }) };
  }

  try {
    const body = JSON.parse(event.body || "{}");
    let { itemId, guestName, itemName, paymentId } = body;

    if (!itemId) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: "itemId é obrigatório." }) };
    }

    const accessToken =
      process.env.MP_ACCESS_TOKEN ||
      process.env.MERCADO_PAGO_ACCESS_TOKEN ||
      "APP_USR-4886951032560827-090416-0a3fe71b92203582c68fb30b49df9540-474353646";

    if (paymentId && accessToken) {
      try {
        const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
          headers: { "Authorization": `Bearer ${accessToken.trim()}` },
        });
        if (mpRes.ok) {
          const mpData = await mpRes.json();
          if (mpData.status && mpData.status !== "approved") {
            return {
              statusCode: 200,
              headers,
              body: JSON.stringify({
                success: false,
                status: mpData.status,
                message: `Pagamento ainda não aprovado (status: ${mpData.status}).`,
              }),
            };
          }
          if (mpData.external_reference) {
            try {
              const ref = JSON.parse(mpData.external_reference);
              if (ref.id) itemId = ref.id;
              if (ref.guest) guestName = ref.guest;
              if (ref.item) itemName = ref.item;
            } catch (_) {}
          }
        }
      } catch (mpErr) {
        console.warn("Aviso ao validar com Mercado Pago:", mpErr);
      }
    }

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

    if (existingState && existingState.status === "purchased") {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, alreadyPurchased: true, itemId: Number(itemId) }),
      };
    }

    let requestId = existingState ? existingState.purchase_request_id : null;

    if (!requestId) {
      const submitRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/wedding_submit_purchase_request`, {
        method: "POST",
        headers: supabaseHeaders,
        body: JSON.stringify({
          p_item_id: Number(itemId),
          p_item_name: itemName || "Presente",
          p_guest_name: guestName || "Convidado",
        }),
      });
      requestId = await submitRes.json();
    }

    if (requestId) {
      const reviewRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/wedding_review_purchase_request`, {
        method: "POST",
        headers: supabaseHeaders,
        body: JSON.stringify({
          p_request_id: requestId,
          p_pin: ADMIN_PIN,
          p_action: "approve",
        }),
      });

      if (!reviewRes.ok) {
        const submitRetry = await fetch(`${SUPABASE_URL}/rest/v1/rpc/wedding_submit_purchase_request`, {
          method: "POST",
          headers: supabaseHeaders,
          body: JSON.stringify({
            p_item_id: Number(itemId),
            p_item_name: itemName || "Presente",
            p_guest_name: guestName || "Convidado",
          }),
        });
        const retryId = await submitRetry.json();
        if (retryId) {
          await fetch(`${SUPABASE_URL}/rest/v1/rpc/wedding_review_purchase_request`, {
            method: "POST",
            headers: supabaseHeaders,
            body: JSON.stringify({
              p_request_id: retryId,
              p_pin: ADMIN_PIN,
              p_action: "approve",
            }),
          });
        }
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        itemId: Number(itemId),
        status: "purchased",
        guestName: guestName || "Convidado",
      }),
    };
  } catch (err) {
    console.error("Erro ao confirmar compra no Netlify Function:", err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "internal_error", message: err.message }),
    };
  }
};
