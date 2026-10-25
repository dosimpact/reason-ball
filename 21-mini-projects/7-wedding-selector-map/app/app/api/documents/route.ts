import { NextRequest, NextResponse } from "next/server";
import { readFile, realpath } from "node:fs/promises";
import path from "node:path";
export const runtime = "nodejs";
const types: Record<string, string> = {
  ".json": "application/json; charset=utf-8",
  ".zip": "application/zip",
  ".csv": "text/csv; charset=utf-8",
  ".docx":
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".xls": "application/vnd.ms-excel",
  ".pdf": "application/pdf",
  ".hwpx": "application/octet-stream",
  ".hwp": "application/x-hwp",
  ".txt": "text/plain; charset=utf-8",
  ".md": "text/plain; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
};
export async function GET(request: NextRequest) {
  const file = request.nextUrl.searchParams.get("path");
  if (!file)
    return NextResponse.json(
      { error: "파일 경로가 없습니다." },
      { status: 400 },
    );
  const root = path.resolve(process.cwd(), "database");
  const normalized = file.replace(/^database\//, "");
  const target = path.resolve(root, normalized);
  if (
    !target.startsWith(root + path.sep) ||
    !types[path.extname(target).toLowerCase()]
  )
    return new NextResponse("허용되지 않은 자료", { status: 403 });
  try {
    const resolved = await realpath(target);
    if (!resolved.startsWith(root + path.sep))
      return new NextResponse("허용되지 않은 자료", { status: 403 });
    const content = await readFile(resolved);
    return new NextResponse(content, {
      headers: {
        "Content-Type": types[path.extname(target).toLowerCase()],
        "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(path.basename(target))}`,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "자료 파일을 찾을 수 없습니다." },
      { status: 404 },
    );
  }
}
