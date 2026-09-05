/**
 * Vercel Serverless Function: Consulta de status de pagamento Pix em tempo real
 * Endpoint: GET /api/check-pix-status?paymentId=...
 */

const SUPABASE_URL = "https://bvbckfajmkfiajjymkmu.supabase.co";
const SUPABASE_KEY = "sb_publishable_4tijqvw0v2NFeD6Lg8q_9w_wvDw6SyL";
const ADMIN_PIN = "EG01052027";

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  const paymentId = req.query.paymentId || req.query.id;
  if (!paymentId) {
    return res.status(400).json({ error: "paymentId é obrigatório." });
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
      return res.status(mpRes.status).json({ error: "mp_error", message: "Não foi possível consultar pagamento." });
    }

    const mpData = await mpRes.json();
    const isApproved = mpData.status === "approved";

    // Se aprovado, confirma no Supabase imediatamente caso ainda não tenha sido confirmado
    if (isApproved && mpData.external_reference) {
      try {
        const ref = JSON.parse(mpData.external_reference);
        const itemId = ref.id;
        const guestName = ref.guest || "Convidado";
        const itemName = ref.item || "Presente";

        const headers = {
          "apikey": SUPABASE_KEY,
          "Authorization": `Bearer ${SUPABASE_KEY}`,
          "Content-Type": "application/json",
        };

        const stateRes = await fetch(`${SUPABASE_URL}/rest/v1/wedding_gift_states?item_id=eq.${Number(itemId)}&select=*`, {
          headers,
        });
        const stateData = await stateRes.json();
        const existingState = Array.isArray(stateData) && stateData.length > 0 ? stateData[0] : null;

        if (!existingState || existingState.status !== "purchased") {
          let requestId = existingState ? existingState.purchase_request_id : null;
          if (!requestId) {
            const submitRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/wedding_submit_purchase_request`, {
              method: "POST",
              headers,
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
              headers,
              body: JSON.stringify({
                p_request_id: requestId,
                p_pin: ADMIN_PIN,
                p_action: "approve",
              }),
            });
          }
        }
      } catch (autoApproveErr) {
        console.warn("Aviso ao aprovar no check-pix-status:", autoApproveErr);
      }
    }

    return res.status(200).json({
      status: mpData.status,
      approved: isApproved,
    });
  } catch (err) {
    return res.status(500).json({ error: "internal_error", message: err.message });
  }
};
