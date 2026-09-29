import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";

const handler = NextAuth(authOptions);

export async function GET(req: Request, props: { params: Promise<{ nextauth: string[] }> }) {
  return handler(req, { params: await props.params } as any);
}

export async function POST(req: Request, props: { params: Promise<{ nextauth: string[] }> }) {
  return handler(req, { params: await props.params } as any);
}