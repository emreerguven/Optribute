"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  dealerSlug: string;
};

export function LogoutButton({ dealerSlug }: Props) {
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  async function handleLogout() {
    setIsLoggingOut(true);

    await fetch(`/api/dealers/${dealerSlug}/admin/auth/logout`, {
      method: "POST"
    });

    router.push(`/${dealerSlug}/admin/login`);
    router.refresh();
  }

  return (
    <button type="button" className="button-secondary" onClick={handleLogout} disabled={isLoggingOut}>
      {isLoggingOut ? "Çıkış yapılıyor..." : "Çıkış yap"}
    </button>
  );
}
