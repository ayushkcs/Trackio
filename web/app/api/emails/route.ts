import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { corsPreflightResponse, withCors } from "@/lib/cors";

// Handle CORS preflight
export async function OPTIONS() {
  return corsPreflightResponse();
}

// POST: Register a new tracked email (called by extension)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { recipient, subject, senderEmail } = body;

    if (!recipient || !subject || !senderEmail) {
      return withCors(
        NextResponse.json(
          { error: "Missing required fields: recipient, subject, senderEmail" },
          { status: 400 }
        )
      );
    }

    // Try to find the user by their email to link the tracked email
    let userId: string | null = null;
    const user = await prisma.user.findUnique({
      where: { email: senderEmail },
    });
    if (user) {
      userId = user.id;
    }

    const email = await prisma.email.create({
      data: {
        recipient,
        subject,
        senderEmail,
        userId,
      },
    });

    return withCors(
      NextResponse.json({
        id: email.id,
        trackingUrl: `${
          process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
        }/api/track/${email.id}`,
      })
    );
  } catch (error) {
    console.error("[Trackio] Create email error:", error);
    return withCors(
      NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      )
    );
  }
}

// HEAD: Quick health check for extension popup
export async function HEAD() {
  return withCors(new NextResponse(null, { status: 200 }));
}

// GET: Fetch tracked emails for the dashboard (requires auth)
export async function GET() {
  const session = await auth();

  if (!session?.user?.email) {
    return withCors(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    );
  }

  try {
    const emails = await prisma.email.findMany({
      where: {
        senderEmail: session.user.email,
      },
      include: {
        openEvents: {
          orderBy: { timestamp: "desc" },
          take: 1,
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Format the response
    const formattedEmails = emails.map((email) => ({
      id: email.id,
      recipient: email.recipient,
      subject: email.subject,
      status: email.status,
      openCount: email.openCount,
      lastOpened: email.openEvents[0]?.timestamp || null,
      createdAt: email.createdAt,
    }));

    return withCors(NextResponse.json(formattedEmails));
  } catch (error) {
    console.error("[Trackio] Fetch emails error:", error);
    return withCors(
      NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      )
    );
  }
}
