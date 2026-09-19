/**
 * API: Assistant captures
 * GET  — List brain-dump captures
 * POST — Quick-capture a raw note into the inbox
 */

import { NextResponse } from "next/server";
import { sanitizeErrorMessage } from "@omniroute/open-sse/utils/error";
import { requireManagementAuth } from "@/lib/api/requireManagementAuth";
import { validateBody, isValidationFailure } from "@/shared/validation/helpers";
import { createCaptureSchema } from "@/shared/validation/schemas/assistant";
import { createCapture, listCaptures } from "@/lib/db/assistant";

export async function GET(request: Request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const captures =
      status === "inbox" || status === "triaged" || status === "dismissed"
        ? listCaptures({ status })
        : listCaptures();
    return NextResponse.json({ captures });
  } catch (error) {
    return NextResponse.json(
      { error: sanitizeErrorMessage(error) || "Failed to list captures" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  try {
    const rawBody = await request.json();
    const validation = validateBody(createCaptureSchema, rawBody);
    if (isValidationFailure(validation)) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const capture = createCapture(validation.data.rawText);
    return NextResponse.json({ capture }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: sanitizeErrorMessage(error) || "Failed to create capture" },
      { status: 500 }
    );
  }
}
