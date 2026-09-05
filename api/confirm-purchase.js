/**
 * Vercel Serverless Function: Confirmação Automática de Compra
 * Endpoint: POST /api/confirm-purchase
 */

const SUPABASE_URL = "https://bvbckfajmkfiajjymkmu.supabase.co";
const SUPABASE_KEY = "sb_publishable_4tijqvw0v2NFeD6Lg8q_9w_wvDw6SyL";
const ADMIN_PIN = "EG01052027";

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed. Use POST." });
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    let { itemId, guestName, itemName, paymentId } = body;

    if (!itemId) {
      return res.status(400).json({ error: "itemId é obrigatório." });
    }

    const accessToken =
      process.env.MP_ACCESS_TOKEN ||
      process.env.MERCADO_PAGO_ACCESS_TOKEN ||
      "APP_USR-4886951032560827-090416-0a3fe71b92203582c68fb30b49df9540-474353646";

    // Se paymentId foi informado, valida na API do Mercado Pago
    if (paymentId && accessToken) {
      try {
        const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
          headers: {
            "Authorization": `Bearer ${accessToken.trim()}`,
          },
        });
        if (mpRes.ok) {
          const mpData = await mpRes.json();
          if (mpData.status && mpData.status !== "approved") {
            return res.status(200).json({
              success: false,
              status: mpData.status,
              message: `Pagamento ainda não aprovado (status: ${mpData.status}).`,
            });
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

    const headers = {
      "apikey": SUPABASE_KEY,
      "Authorization": `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
    };

    // 1. Verificar se o item já existe no Supabase
    const stateRes = await fetch(`${SUPABASE_URL}/rest/v1/wedding_gift_states?item_id=eq.${Number(itemId)}&select=*`, {
      headers,
    });
    const stateData = await stateRes.json();
    const existingState = Array.isArray(stateData) && stateData.length > 0 ? stateData[0] : null;

    if (existingState && existingState.status === "purchased") {
      return res.status(200).json({
        success: true,
        alreadyPurchased: true,
        itemId: Number(itemId),
      });
    }

    let requestId = existingState ? existingState.purchase_request_id : null;

    // 2. Se não houver pedido pendente vinculado, cria um
    if (!requestId) {
      const submitRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/wedding_submit_purchase_request`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          p_item_id: Number(itemId),
          p_item_name: itemName || "Presente",
          p_guest_name: guestName || "Convidado",
        }),
      });
      requestId = await submitRes.json();
    }

    // 3. Aprova automaticamente no Supabase
    if (requestId) {
      const reviewRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/wedding_review_purchase_request`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          p_request_id: requestId,
          p_pin: ADMIN_PIN,
          p_action: "approve",
        }),
      });

      if (!reviewRes.ok) {
        // Se a tentativa falhou (ex: request já modificado), cria um novo e aprova
        const submitRetry = await fetch(`${SUPABASE_URL}/rest/v1/rpc/wedding_submit_purchase_request`, {
          method: "POST",
          headers,
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
            headers,
            body: JSON.stringify({
              p_request_id: retryId,
              p_pin: ADMIN_PIN,
              p_action: "approve",
            }),
          });
        }
      }
    }

    return res.status(200).json({
      success: true,
      itemId: Number(itemId),
      status: "purchased",
      guestName: guestName || "Convidado",
    });
  } catch (err) {
    console.error("Erro interno ao confirmar compra:", err);
    return res.status(500).json({
      error: "internal_error",
      message: err.message || "Erro ao confirmar compra automaticamente.",
    });
  }
};
