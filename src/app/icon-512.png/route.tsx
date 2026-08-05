import { renderAppIcon } from "@/lib/iconResponse";

export async function GET() {
  return renderAppIcon(512);
}
