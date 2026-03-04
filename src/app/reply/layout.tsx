import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Reply to Lead",
  robots: { index: false, follow: false },
};

export default function ReplyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
