import { cookies } from "next/headers";
import { verifySessionCookie, SESSION_COOKIE } from "@/lib/session";
import LogoutButton from "./LogoutButton";

// Renders nothing on /login (no session yet) — proxy.ts already gates every
// other route, so a session is present there.
export default async function UserBar() {
  const cookieStore = await cookies();
  const session = verifySessionCookie(cookieStore.get(SESSION_COOKIE)?.value);
  if (!session) return null;

  return (
    <div className="flex items-center justify-end gap-3 border-b border-neutral-200 bg-white px-6 py-2 text-sm text-neutral-600">
      <span>
        <span className="font-medium text-neutral-800">{session.username}</span>
        {session.role === "admin" ? " (관리자)" : ""}님으로 로그인 중
      </span>
      <LogoutButton />
    </div>
  );
}
