// A stand-in for R2's S3 API: path-style bucket/key, signed requests only, byte ranges.
import { createServer } from "node:http";
import { createHash } from "node:crypto";

export async function fakeR2() {
  const objects = new Map(), requests = [];
  const server = createServer((req, res) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c)).on("end", () => {
      const body = Buffer.concat(chunks), key = decodeURIComponent(req.url.split("/").slice(2).join("/"));
      requests.push({ method: req.method, key, range: req.headers.range });
      const auth = req.headers.authorization || "";
      if (!/^AWS4-HMAC-SHA256 Credential=test-key\/\d{8}\/auto\/s3\/aws4_request, SignedHeaders=\S+, Signature=[0-9a-f]{64}$/.test(auth) || !req.headers["x-amz-date"]) {
        res.writeHead(403).end("unsigned");
        return;
      }
      if (req.method === "PUT") {
        if (req.headers["x-amz-content-sha256"] !== createHash("sha256").update(body).digest("hex")) return res.writeHead(400).end("hash mismatch");
        objects.set(key, body);
        return res.writeHead(200).end();
      }
      const stored = objects.get(key);
      if (req.method === "DELETE") {
        objects.delete(key);
        return res.writeHead(204).end();
      }
      if (!stored) return res.writeHead(404).end();
      const range = /^bytes=(\d+)-(\d+)$/.exec(req.headers.range || "");
      if (range) {
        const part = stored.subarray(Number(range[1]), Number(range[2]) + 1);
        return res.writeHead(206, { "Content-Range": `bytes ${range[1]}-${range[2]}/${stored.length}` }).end(part);
      }
      res.writeHead(200).end(stored);
    });
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return {
    objects, requests,
    endpoint: `http://127.0.0.1:${server.address().port}`,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}
