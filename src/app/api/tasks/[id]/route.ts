import { NextRequest, NextResponse } from "next/server";
import { requireGoogleClient, handleApiError } from "@/lib/apiAuth";
import { updateTask, deleteTask, type TaskInput } from "@/lib/googleTasks";

export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/tasks/[id]">) {
  try {
    const { id } = await ctx.params;
    const auth = await requireGoogleClient();
    const body = (await request.json()) as Partial<TaskInput> & { completed?: boolean };
    const task = await updateTask(auth, id, body);
    return NextResponse.json({ task });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(_request: NextRequest, ctx: RouteContext<"/api/tasks/[id]">) {
  try {
    const { id } = await ctx.params;
    const auth = await requireGoogleClient();
    await deleteTask(auth, id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
