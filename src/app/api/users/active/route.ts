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

    const users = await prisma.user.findMany({
      where: {
        role: { not: "SYSTEM_ADMIN" },
        status: "ACTIVE",
        NOT: {
          roleDefinition: {
            code: "SYSTEM_ADMIN"
          }
        }
      },
      select: {
        id: true,
        name: true,
        avatarUrl: true,
      },
      orderBy: {
        name: "asc",
      },
    });

    return NextResponse.json(users);
  } catch (error: any) {
    console.error("[Users GET Error]", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
