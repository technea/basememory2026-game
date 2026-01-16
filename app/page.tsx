"use client";

import { useEffect } from "react";
import { Wallet } from "@coinbase/onchainkit/wallet";
import { useMiniKit } from "@coinbase/onchainkit/minikit";
import BaseMemoryGame from "./components/memorygame";
import styles from "./page.module.css";

export default function Home() {
  const { setMiniAppReady, isMiniAppReady } = useMiniKit();

  useEffect(() => {
    if (!isMiniAppReady) {
      setMiniAppReady();
    }
  }, [setMiniAppReady, isMiniAppReady]);

  return (
    <div className={styles.container}>
      {/* Optional small header */}
      <header className={styles.headerWrapper}>
        <Wallet />
      </header>

      {/* 🔥 MAIN APP */}
      <BaseMemoryGame />
    </div>
  );
}
