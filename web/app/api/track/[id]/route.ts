import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// 1×1 transparent GIF pixel (smallest valid GIF)
const TRANSPARENT_GIF = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64"
);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    // Check if this email exists
    const email = await prisma.email.findUnique({ where: { id } });

    if (email) {
      const ipAddress =
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        request.headers.get("x-real-ip") ||
        "unknown";
      const userAgent = request.headers.get("user-agent") || "unknown";

      // Increment open count and create open event in a transaction
      await prisma.$transaction([
        prisma.email.update({
          where: { id },
          data: {
            openCount: { increment: 1 },
            status: "opened",
          },
        }),
        prisma.openEvent.create({
          data: {
            emailId: id,
            ipAddress,
            userAgent,
          },
        }),
      ]);
    }
  } catch (error) {
    // Still return the pixel even if DB fails
    console.error("[Trackio] Track error:", error);
  }

  // Always return the tracking pixel with permissive CORS
  return new NextResponse(TRANSPARENT_GIF, {
    status: 200,
    headers: {
      "Content-Type": "image/gif",
      "Content-Length": String(TRANSPARENT_GIF.length),
      "Cache-Control":
        "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
      Pragma: "no-cache",
      Expires: "0",
      "X-Content-Type-Options": "nosniff",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
