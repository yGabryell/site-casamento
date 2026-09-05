/**
 * Vercel Serverless Function: Liberação de Presente Pendente
 * Libera um item que estava com checkout pendente se o usuário cancelou ou o tempo expirou.
 * Nunca altera itens já com status "purchased" (comprados).
 * Endpoint: POST /api/release-item
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
    const { itemId } = body;

    if (!itemId) {
      return res.status(400).json({ error: "itemId é obrigatório." });
    }

    const headers = {
      "apikey": SUPABASE_KEY,
      "Authorization": `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
    };

    // 1. Verificar o status atual do item no Supabase
    const stateRes = await fetch(`${SUPABASE_URL}/rest/v1/wedding_gift_states?item_id=eq.${Number(itemId)}&select=*`, {
      headers,
    });
    const stateData = await stateRes.json();
    const existingState = Array.isArray(stateData) && stateData.length > 0 ? stateData[0] : null;

    // Se o item já foi comprado com sucesso, JAMAIS resetamos!
    if (existingState && existingState.status === "purchased") {
      return res.status(200).json({
        success: false,
        message: "Item já adquirido, não pode ser liberado.",
        itemId: Number(itemId),
      });
    }

    // Se estiver pendente ou existir registro não-comprado, removemos para voltar a 'available'
    if (existingState) {
      await fetch(`${SUPABASE_URL}/rest/v1/rpc/wedding_delete_purchase_item`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          p_item_id: Number(itemId),
          p_pin: ADMIN_PIN,
        }),
      });
    }

    return res.status(200).json({
      success: true,
      message: "Item liberado com sucesso.",
      itemId: Number(itemId),
    });
  } catch (error) {
    console.error("Erro ao liberar item:", error);
    return res.status(500).json({
      error: "server_error",
      message: error.message || "Erro interno ao liberar item.",
    });
  }
};
