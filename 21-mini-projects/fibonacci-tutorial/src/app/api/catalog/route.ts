import { catalog } from "@/entities/tutorial";

export function GET(): Response {
  return Response.json(catalog);
}
