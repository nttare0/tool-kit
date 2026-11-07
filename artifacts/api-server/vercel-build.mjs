import { cp, rm, mkdir, writeFile } from "node:fs/promises";

const destination = new URL("./public/", import.meta.url);
await rm(destination, { recursive: true, force: true });
await cp(new URL("../toolstack/dist/public/", import.meta.url), destination, {
  recursive: true,
});

// Official Supabase Studio certificate URL; public CA material, not a secret.
// See supabase/supabase apps/studio/hooks/custom-content/custom-content.json.
if (process.env.DATABASE_URL && /\.supabase\.(com|co)$/.test(new URL(process.env.DATABASE_URL).hostname)) {
  const response = await fetch("https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt", {
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error("Could not download the official Supabase CA certificate");
  const certificate = await response.text();
  if (!certificate.includes("-----BEGIN CERTIFICATE-----")) throw new Error("Invalid Supabase CA certificate download");
  const certs = new URL("./dist/certs/", import.meta.url);
  await mkdir(certs, {recursive:true});
  await writeFile(new URL("supabase-ca.crt", certs), certificate);
}
