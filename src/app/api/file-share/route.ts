import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    // Fetch files I uploaded
    const myShares = await prisma.fileShare.findMany({
      where: {
        uploaderId: userId,
      },
      include: {
        sharedWith: {
          select: { id: true, name: true, email: true },
        },
        sharedWithDepts: {
          select: { id: true, name: true },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { departmentId: true } });

    // Fetch files shared with me
    const sharedWithMe = await prisma.fileShare.findMany({
      where: {
        AND: [
          {
            OR: [
              { expiresAt: null },
              { expiresAt: { gt: new Date() } }
            ]
          },
          {
            OR: [
              { sharedWith: { some: { id: userId } } },
              ...(user?.departmentId ? [{ sharedWithDepts: { some: { id: user.departmentId } } }] : [])
            ]
          }
        ]
      },
      include: {
        uploader: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json({
      myShares,
      sharedWithMe,
    });
  } catch (error: any) {
    console.error("[File Share GET Error]", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
