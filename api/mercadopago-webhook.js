/**
 * Vercel Serverless Function: Webhook Mercado Pago
 * Recebe notificações automáticas de pagamentos (Pix e Cartão) e aprova o presente no Supabase instantaneamente.
 * Endpoint: POST /api/mercadopago-webhook
 */

const SUPABASE_URL = "https://bvbckfajmkfiajjymkmu.supabase.co";
const SUPABASE_KEY = "sb_publishable_4tijqvw0v2NFeD6Lg8q_9w_wvDw6SyL";
const ADMIN_PIN = "EG01052027";

module.exports = async (req, res) => {
  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  // Mercado Pago pode enviar dados via query parameters ou body
  const paymentId =
    req.query["data.id"] ||
    req.query.id ||
    (req.body && req.body.data && req.body.data.id) ||
    (req.body && req.body.id);

  const topic = req.query.type || req.query.topic || (req.body && req.body.type);

  if (!paymentId || (topic && topic !== "payment")) {
    return res.status(200).json({ status: "ignored" });
  }

  const accessToken =
    process.env.MP_ACCESS_TOKEN ||
    process.env.MERCADO_PAGO_ACCESS_TOKEN ||
    "APP_USR-4886951032560827-090416-0a3fe71b92203582c68fb30b49df9540-474353646";

  try {
    const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: {
        "Authorization": `Bearer ${accessToken.trim()}`,
      },
    });

    if (!mpRes.ok) {
      console.warn(`Webhook: Não foi possível obter dados do pagamento ${paymentId}`);
      return res.status(200).send("OK");
    }

    const mpData = await mpRes.json();

    if (mpData.status !== "approved") {
      return res.status(200).json({ status: `payment_${mpData.status}` });
    }

    let itemId = null;
    let guestName = "Convidado";
    let itemName = "Presente";

    if (mpData.external_reference) {
      try {
        const ref = JSON.parse(mpData.external_reference);
        itemId = ref.id;
        guestName = ref.guest || guestName;
        itemName = ref.item || itemName;
      } catch (_) {}
    }

    if (!itemId && Array.isArray(mpData.additional_info?.items) && mpData.additional_info.items.length > 0) {
      itemId = Number(mpData.additional_info.items[0].id) || null;
      itemName = mpData.additional_info.items[0].title || itemName;
    }

    if (!itemId) {
      console.warn("Webhook: ItemId não encontrado no pagamento", paymentId);
      return res.status(200).send("OK");
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
      return res.status(200).send("OK");
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

    console.log(`Webhook: Item ${itemId} aprovado automaticamente para ${guestName}!`);
    return res.status(200).send("OK");
  } catch (err) {
    console.error("Erro no processamento do webhook:", err);
    return res.status(200).send("OK");
  }
};
