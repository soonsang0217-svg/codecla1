import { google, tasks_v1 } from "googleapis";
import type { OAuth2Client } from "google-auth-library";

const TASKLIST_ID = "@default";

export type Task = tasks_v1.Schema$Task;

export interface TaskInput {
  title: string;
  notes?: string;
  due?: string; // RFC3339 date
}

function client(auth: OAuth2Client) {
  return google.tasks({ version: "v1", auth });
}

export async function listTasks(auth: OAuth2Client, showCompleted = false): Promise<Task[]> {
  const { data } = await client(auth).tasks.list({
    tasklist: TASKLIST_ID,
    showCompleted,
    showHidden: showCompleted,
    maxResults: 100,
  });
  return data.items ?? [];
}

export async function createTask(auth: OAuth2Client, input: TaskInput): Promise<Task> {
  const { data } = await client(auth).tasks.insert({
    tasklist: TASKLIST_ID,
    requestBody: {
      title: input.title,
      notes: input.notes,
      due: input.due,
    },
  });
  return data;
}

export async function updateTask(
  auth: OAuth2Client,
  taskId: string,
  input: Partial<TaskInput> & { completed?: boolean }
): Promise<Task> {
  const { data } = await client(auth).tasks.patch({
    tasklist: TASKLIST_ID,
    task: taskId,
    requestBody: {
      ...(input.title !== undefined && { title: input.title }),
      ...(input.notes !== undefined && { notes: input.notes }),
      ...(input.due !== undefined && { due: input.due }),
      ...(input.completed !== undefined && {
        status: input.completed ? "completed" : "needsAction",
        completed: input.completed ? new Date().toISOString() : null,
      }),
    },
  });
  return data;
}

export async function deleteTask(auth: OAuth2Client, taskId: string): Promise<void> {
  await client(auth).tasks.delete({ tasklist: TASKLIST_ID, task: taskId });
}
