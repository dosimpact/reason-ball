import { NextResponse } from "next/server";
import { getVendor } from "@/entities/vendor/server";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const vendor = getVendor(id);
  return vendor
    ? NextResponse.json(vendor, {
        headers: { "Cache-Control": "public, max-age=3600" },
      })
    : NextResponse.json({ error: "업체를 찾을 수 없습니다." }, { status: 404 });
}
