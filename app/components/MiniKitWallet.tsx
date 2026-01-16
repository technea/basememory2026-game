"use client";

import { useEffect } from "react";
import Image from "next/image";
import { Wallet } from "@coinbase/onchainkit/wallet";
import { useMiniKit } from "@coinbase/onchainkit/minikit";

export default function MiniKitWallet() {
  const { setMiniAppReady, isMiniAppReady } = useMiniKit();

  useEffect(() => {
    if (!isMiniAppReady) {
      setMiniAppReady();
    }
  }, [setMiniAppReady, isMiniAppReady]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-cyan-900 p-8">
      <header className="absolute top-4 right-4">
        <Wallet />
      </header>

      <div className="flex flex-col items-center justify-center min-h-[80vh] text-center">
        <div className="glass-effect p-12 rounded-3xl max-w-4xl w-full">
          <Image
            priority
            src="/sphere.svg"
            alt="Sphere"
            width={200}
            height={200}
            className="mx-auto mb-8 animate-float"
          />

          <h1 className="text-5xl font-bold text-white mb-6">
            MiniKit <span className="text-cyan-400">+ Base Protocol</span>
          </h1>

          <p className="text-xl text-gray-300 mb-10">
            Wallet integration for the Base Memory Game. Connect your wallet to track progress on-chain.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-12">
            <div className="feature-card">
              <div className="text-4xl mb-4">💳</div>
              <h3 className="text-xl font-bold mb-2">Wallet Connect</h3>
              <p className="text-gray-400">Connect your wallet to save game progress</p>
            </div>

            <div className="feature-card">
              <div className="text-4xl mb-4">🎮</div>
              <h3 className="text-xl font-bold mb-2">On-chain Stats</h3>
              <p className="text-gray-400">Track your scores and achievements on Base</p>
            </div>

            <div className="feature-card">
              <div className="text-4xl mb-4">🏆</div>
              <h3 className="text-xl font-bold mb-2">NFT Rewards</h3>
              <p className="text-gray-400">Earn NFTs for completing game levels</p>
            </div>
          </div>

          <div className="mt-12 pt-8 border-t border-white/10">
            <h2 className="text-2xl font-bold mb-6 text-cyan-300">Explore Components</h2>
            <div className="flex flex-wrap justify-center gap-4">
              {[
                {
                  name: "Transaction",
                  url: "https://docs.base.org/onchainkit/transaction/transaction",
                  icon: "⚡"
                },
                {
                  name: "Swap",
                  url: "https://docs.base.org/onchainkit/swap/swap",
                  icon: "🔄"
                },
                {
                  name: "Checkout",
                  url: "https://docs.base.org/onchainkit/checkout/checkout",
                  icon: "🛒"
                },
                {
                  name: "Wallet",
                  url: "https://docs.base.org/onchainkit/wallet/wallet",
                  icon: "👛"
                },
                {
                  name: "Identity",
                  url: "https://docs.base.org/onchainkit/identity/identity",
                  icon: "🆔"
                },
              ].map((component) => (
                <a
                  key={component.name}
                  target="_blank"
                  rel="noreferrer"
                  href={component.url}
                  className="component-link group"
                >
                  <span className="text-2xl mr-2">{component.icon}</span>
                  <span>{component.name}</span>
                  <span className="ml-2 opacity-0 group-hover:opacity-100 transition-opacity">→</span>
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .glass-effect {
          background: rgba(255, 255, 255, 0.05);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.1);
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
        }

        .feature-card {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.05);
          padding: 2rem;
          border-radius: 1.5rem;
          transition: all 0.3s ease;
        }

        .feature-card:hover {
          background: rgba(255, 255, 255, 0.08);
          transform: translateY(-5px);
          border-color: rgba(59, 130, 246, 0.3);
        }

        .component-link {
          display: flex;
          align-items: center;
          padding: 1rem 1.5rem;
          background: rgba(255, 255, 255, 0.05);
          border-radius: 1rem;
          color: white;
          text-decoration: none;
          transition: all 0.3s ease;
          border: 1px solid transparent;
        }

        .component-link:hover {
          background: rgba(59, 130, 246, 0.2);
          border-color: rgba(59, 130, 246, 0.5);
          transform: translateY(-2px);
        }

        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-20px); }
        }

        .animate-float {
          animation: float 6s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
