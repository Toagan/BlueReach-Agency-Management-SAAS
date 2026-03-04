import { cookies } from "next/headers";

const COOKIE_NAME = "x-view-as-owner";
const COOKIE_MAX_AGE = 8 * 60 * 60; // 8 hours

export async function setImpersonation(ownerId: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, ownerId, {
    httpOnly: true,
    path: "/admin",
    maxAge: COOKIE_MAX_AGE,
    sameSite: "lax",
  });
}

export async function clearImpersonation(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function getImpersonatedOwnerId(): Promise<string | null> {
  const cookieStore = await cookies();
  const cookie = cookieStore.get(COOKIE_NAME);
  return cookie?.value || null;
}
