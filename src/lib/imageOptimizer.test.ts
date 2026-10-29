import { readFile } from "node:fs/promises";
import { IncomingMessage, ServerResponse } from "node:http";
import { Socket } from "node:net";
import path from "node:path";
import { fetchInternalImage } from "next/dist/server/image-optimizer";
import { serveStatic } from "next/dist/server/serve-static";
import { expect, it } from "vitest";

// next@16.0.8への上流PR #98168のバックポートを検証する。
it("画像を要求したクライアントが切断しても共有の画像読込は完了する", async () => {
  const socket = new Socket();
  const req = new IncomingMessage(socket);
  req.method = "GET";
  const res = new ServerResponse(req);
  const imagePath = path.resolve("public/images/spots/Morioka_Nature_MoriokajousiKouen.jpg");
  const result = await fetchInternalImage("/images/spots/Morioka_Nature_MoriokajousiKouen.jpg", req, res, async (innerReq, innerRes) => {
    socket.destroy();
    await serveStatic(innerReq, innerRes, imagePath);
  });
  expect(result.buffer.equals(await readFile(imagePath))).toBe(true);
  expect(result.contentType).toBe("image/jpeg");
});
