import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getTodayRange } from "@/lib/attendance-helper";
import { sseEmitter } from "@/lib/sse";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id) {
    // Return 200 with auth_error to gracefully close client connection
    // and prevent EventSource from infinite 401 reconnection loops.
    return new Response("event: auth_error\ndata: 401\n\n", {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
      },
    });
  }

  const userId = session.user.id;
  const responseStream = new TransformStream();
  const writer = responseStream.writable.getWriter();
  const encoder = new TextEncoder();
  let isClosed = false;
  let onNotify: () => void;

  const cleanup = () => {
    isClosed = true;
    if (onNotify) {
      sseEmitter.off(`notify:${userId}`, onNotify);
    }
    writer.close().catch(() => {});
  };

  const sendPayload = async () => {
    if (isClosed) {
      cleanup();
      return;
    }
    try {
      const { start, end } = getTodayRange();
      const tenantId = session.user.tenantId;
      const [notifications, user, config, todaysLog] = await Promise.all([
        prisma.notification.findMany({
          where: {
            userId,
            ...(tenantId ? { tenantId } : {})
          },
          orderBy: { createdAt: "desc" },
          take: 10,
        }),
        prisma.user.findUnique({
          where: { id: userId },
          include: { location: true }
        }),
        tenantId ? prisma.systemConfig.findUnique({ where: { tenantId } }) : null,
        prisma.attendance.findFirst({
          where: {
            userId: userId,
            ...(tenantId ? { tenantId } : {}),
            date: { gte: start, lte: end }
          }
        })
      ]);

      const startTime = user?.location?.startTime || config?.defaultOfficeStartTime || "09:00";
      const endTime = user?.location?.endTime || config?.defaultOfficeEndTime || "18:00";

      const payload = JSON.stringify({
        type: "update",
        data: notifications,
        attendance: {
          startTime,
          endTime,
          hasPunchedIn: !!todaysLog,
          hasPunchedOut: !!todaysLog?.punchOut
        }
      });

      await writer.write(encoder.encode(`data: ${payload}\n\n`));
    } catch (err) {
      cleanup();
    }
  };

  const startStreaming = async () => {
    try {
      await writer.write(encoder.encode(`retry: 5000\ndata: ${JSON.stringify({ type: 'connected' })}\n\n`));
    } catch (e) {
      isClosed = true;
      return;
    }

    // Keepalive ping to prevent IIS/Nginx timeouts without polling DB
    const intervalId = setInterval(async () => {
      if (isClosed || req.signal.aborted) {
        clearInterval(intervalId);
        cleanup();
        return;
      }
      try {
        await writer.write(encoder.encode(`: keepalive\n\n`));
      } catch (e) {
        clearInterval(intervalId);
        cleanup();
      }
    }, 30000);

    // Listen for Push Events
    onNotify = () => sendPayload();
    sseEmitter.on(`notify:${userId}`, onNotify);

    // Initial send
    sendPayload();

    req.signal.addEventListener("abort", () => {
      clearInterval(intervalId);
      cleanup();
    });
  };

  startStreaming();

  return new Response(responseStream.readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
