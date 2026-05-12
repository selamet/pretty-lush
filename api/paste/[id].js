import { getStore } from "../_store.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { id } = req.query;
  if (!id || typeof id !== "string" || !/^[A-Za-z0-9]{4,16}$/.test(id))
    return res.status(400).json({ error: "invalid id" });

  let store;
  try {
    ({ store } = await getStore());
  } catch (e) {
    return res.status(503).json({
      error: e.message,
      code: e.code || "STORE_UNAVAILABLE",
    });
  }

  const key = `p:${id}`;
  const record = await store.get(key);
  if (!record) return res.status(404).json({ error: "not found or expired" });

  if (record.burnAfterRead) {
    // Fire-and-forget delete. We still return the record so the requester
    // can decrypt; the next reader will see a 404.
    try {
      await store.del(key);
    } catch {
      // ignore — the TTL will sweep it up eventually
    }
  }

  res.setHeader("Cache-Control", "no-store");
  return res.status(200).json(record);
}
