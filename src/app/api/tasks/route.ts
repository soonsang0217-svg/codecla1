import { NextRequest, NextResponse } from "next/server";
import { requireGoogleClient, handleApiError } from "@/lib/apiAuth";
import { listTasks, createTask, type TaskInput } from "@/lib/googleTasks";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireGoogleClient();
    const showCompleted = request.nextUrl.searchParams.get("showCompleted") === "true";
    const tasks = await listTasks(auth, showCompleted);
    return NextResponse.json({ tasks });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireGoogleClient();
    const body = (await request.json()) as TaskInput;

    if (!body.title) {
      return NextResponse.json({ error: "title is required" }, { status: 400 });
    }

    const task = await createTask(auth, body);
    return NextResponse.json({ task }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
