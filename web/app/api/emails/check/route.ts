import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { corsPreflightResponse, withCors } from "@/lib/cors";

// Handle CORS preflight
export async function OPTIONS() {
  return corsPreflightResponse();
}

// POST: Bulk-check open status for specific email IDs (used by extension polling)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { emailIds } = body;

    if (!emailIds || !Array.isArray(emailIds) || emailIds.length === 0) {
      return withCors(
        NextResponse.json(
          { error: "Missing or invalid emailIds array" },
          { status: 400 }
        )
      );
    }

    // Limit to 100 IDs per request to prevent abuse
    const ids = emailIds.slice(0, 100);

    const emails = await prisma.email.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        recipient: true,
        subject: true,
        openCount: true,
        status: true,
        openEvents: {
          orderBy: { timestamp: "desc" },
          take: 1,
          select: {
            timestamp: true,
          },
        },
      },
    });

    // Format response as a map { id: { ...data } }
    const result: Record<
      string,
      {
        recipient: string;
        subject: string;
        openCount: number;
        status: string;
        lastOpened: Date | null;
      }
    > = {};

    for (const email of emails) {
      result[email.id] = {
        recipient: email.recipient,
        subject: email.subject,
        openCount: email.openCount,
        status: email.status,
        lastOpened: email.openEvents[0]?.timestamp || null,
      };
    }

    return withCors(NextResponse.json(result));
  } catch (error) {
    console.error("[Trackio] Check emails error:", error);
    return withCors(
      NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      )
    );
  }
}
