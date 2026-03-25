import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

async function getAuthenticatedUserId(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  return (session as any)?.userId ?? null;
}

// Stub notification settings - will be expanded in a future task
const DEFAULT_SETTINGS = {
  newLiveNotification: true,
  streamingEndReminder: true,
  reminderHoursBefore: 1,
};

export async function GET() {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Stub: return default settings
  return NextResponse.json({
    userId,
    settings: DEFAULT_SETTINGS,
  });
}

export async function PUT(request: Request) {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();

  // Stub: echo back the received settings merged with defaults
  const settings = {
    ...DEFAULT_SETTINGS,
    ...body,
  };

  return NextResponse.json({
    userId,
    settings,
  });
}
