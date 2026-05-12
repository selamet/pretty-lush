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

  const record = await store.get(`p:${id}`);
  if (!record) return res.status(404).json({ error: "not found or expired" });

  res.setHeader("Cache-Control", "no-store");
  return res.status(200).json(record);
}
