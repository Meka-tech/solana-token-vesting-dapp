"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { WalletButton } from "../solana/solana-provider";
import { AppHero, ellipsify } from "../ui/ui-layout";
import { ExplorerLink } from "../cluster/cluster-ui";
import { useVestingProgram } from "./vesting-data-access";
import { TokenvestingCreate, TokenvestingList } from "./vesting-ui";

export default function TokenvestingFeature() {
  const { publicKey } = useWallet();
  const { programId } = useVestingProgram();

  return publicKey ? (
    <div>
      <AppHero
        title="Token Vesting"
        subtitle={"Create a new vesting account below. "}
      >
        <p className="mb-6">
          <ExplorerLink
            path={`account/${programId}`}
            label={ellipsify(programId.toString())}
          />
        </p>
        <TokenvestingCreate />
      </AppHero>
      <TokenvestingList />
    </div>
  ) : (
    <div className="max-w-4xl mx-auto">
      <div className="hero py-[64px]">
        <div className="hero-content text-center">
          <WalletButton />
        </div>
      </div>
    </div>
  );
}
