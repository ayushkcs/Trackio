import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { corsPreflightResponse, withCors } from "@/lib/cors";

/**
 * POST /api/track/[id]/self-view
 *
 * Called by the Chrome extension when it detects that the SENDER
 * is viewing their own sent email (Sent folder or thread view).
 *
 * Gmail's image proxy will have already fetched the tracking pixel,
 * creating an OpenEvent.  This endpoint marks the most-recent
 * un-marked OpenEvent as a self-open and decrements openCount so
 * the dashboard shows only real recipient opens.
 *
 * Body: { senderToken: string }
 */

export async function OPTIONS() {
  return corsPreflightResponse();
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const body = await request.json();
    const { senderToken } = body;

    if (!senderToken) {
      return withCors(
        NextResponse.json(
          { error: "Missing senderToken" },
          { status: 400 }
        )
      );
    }

    // Fetch the email and validate the token
    const email = await prisma.email.findUnique({ where: { id } });

    if (!email) {
      return withCors(
        NextResponse.json({ error: "Email not found" }, { status: 404 })
      );
    }

    if (email.senderToken !== senderToken) {
      return withCors(
        NextResponse.json({ error: "Invalid senderToken" }, { status: 403 })
      );
    }

    // Find the most recent OpenEvent that has NOT been marked as self-open
    const unmarkedEvent = await prisma.openEvent.findFirst({
      where: { emailId: id, isSelfOpen: false },
      orderBy: { timestamp: "desc" },
    });

    if (!unmarkedEvent) {
      // No un-marked event to compensate — nothing to do
      return withCors(
        NextResponse.json({ success: true, compensated: false })
      );
    }

    // Mark the event as a self-open and decrement the email's open count
    await prisma.$transaction([
      prisma.openEvent.update({
        where: { id: unmarkedEvent.id },
        data: { isSelfOpen: true },
      }),
      prisma.email.update({
        where: { id },
        data: {
          openCount: { decrement: 1 },
          // If this was the last real open, revert status to "sent"
          ...(email.openCount <= 1 ? { status: "sent" } : {}),
        },
      }),
    ]);

    console.log(
      `[Trackio] Self-view compensated for email ${id} (event ${unmarkedEvent.id})`
    );

    return withCors(
      NextResponse.json({ success: true, compensated: true })
    );
  } catch (error) {
    console.error("[Trackio] Self-view error:", error);
    return withCors(
      NextResponse.json({ error: "Internal server error" }, { status: 500 })
    );
  }
}
