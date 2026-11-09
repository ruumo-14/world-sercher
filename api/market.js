"use strict";

const { db, send, bodyOf, getSession, handleError } = require("../lib/backend");

module.exports = async function handler(req, res) {
  try {
    const session = getSession(req);
    if (!session) return send(res, 401, { error: "ログインが必要です。" });

    if (req.method === "GET") {
      await db("rpc/market_return_expired", {}, { method: "POST", body: { p_user_id: session.sub } });
      const rows = await db("market_listings", {
        select: "id,seller_user_id,seller_name,item_data,rarity,quantity,unit_price,created_at,expires_at",
        status: "eq.active",
        expires_at: "gt." + new Date().toISOString(),
        order: "unit_price.asc",
        limit: "100",
      });
      return send(res, 200, { listings: rows || [] });
    }

    if (req.method !== "POST") {
      res.setHeader("Allow", "GET, POST");
      return send(res, 405, { error: "この操作には対応していません。" });
    }

    const body = bodyOf(req);
    const action = String(body.action || "");
    if (action === "create") {
      const item = body.item;
      const rarity = String(body.rarity || "");
      const quantity = Math.floor(Number(body.quantity));
      const price = Math.floor(Number(body.unitPrice));
      const rarityMap = {
        N: Number(process.env.MARKET_MIN_N || 0),
        R: Number(process.env.MARKET_MIN_R || 0),
        SR: Number(process.env.MARKET_MIN_SR || 0),
        SSR: Number(process.env.MARKET_MIN_SSR || 0),
        UR: Number(process.env.MARKET_MIN_UR || 0),
      };
      if (!item || typeof item !== "object" || typeof item.id !== "string" || !["N","R","SR","SSR","UR"].includes(rarity)) {
        return send(res, 400, { error: "出品アイテムの情報が正しくありません。" });
      }
      if (rarityMap[rarity] <= 0) return send(res, 503, { error: "レア度ごとの最低価格がまだ設定されていません。" });
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > 999999 || !Number.isSafeInteger(price) || price < rarityMap[rarity]) {
        return send(res, 400, { error: "数量または価格が正しくありません。レア度ごとの最低価格を確認してね。" });
      }
      const fee = Number(process.env.MARKET_LISTING_FEE_GOLD);
      if (!Number.isSafeInteger(fee) || fee < 0) {
        return send(res, 503, { error: "マーケット出品手数料の設定がまだ完了していません。" });
      }
      const result = await db("rpc/market_create_listing", {}, {
        method: "POST",
        body: {
          p_user_id: session.sub,
          p_seller_name: session.username,
          p_item_id: item.id,
          p_item_data: item,
          p_rarity: rarity,
          p_quantity: quantity,
          p_unit_price: price,
          p_listing_fee: fee,
        },
      });
      return send(res, 201, { listing: result });
    }

    if (action === "buy") {
      const listingId = String(body.listingId || "");
      const quantity = Math.floor(Number(body.quantity));
      if (!listingId || !Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
        return send(res, 400, { error: "購入数は1〜99個にしてね。" });
      }
      const result = await db("rpc/market_buy_listing", {}, {
        method: "POST",
        body: { p_buyer_id: session.sub, p_listing_id: listingId, p_quantity: quantity },
      });
      return send(res, 200, { purchase: result });
    }

    if (action === "cancel") {
      const result = await db("rpc/market_cancel_listing", {}, {
        method: "POST",
        body: { p_user_id: session.sub, p_listing_id: String(body.listingId || "") },
      });
      return send(res, 200, { cancelled: result });
    }

    if (action === "claim") {
      const result = await db("rpc/market_claim_payouts", {}, {
        method: "POST",
        body: { p_user_id: session.sub },
      });
      return send(res, 200, { claimed: result });
    }

    return send(res, 400, { error: "指定された操作には対応していません。" });
  } catch (error) {
    const message = String(error?.message || "");
    if (error?.status === 400) return send(res, 400, { error: "取引条件を確認してね。所持GOLDや出品状態が原因かもしれません。" });
    if (error?.code === "23505") return send(res, 409, { error: "同じ出品がすでに登録されています。" });
    return handleError(res, error);
  }
};
