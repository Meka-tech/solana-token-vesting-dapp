import { Keypair, PublicKey } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import {
  BanksClient,
  Clock,
  ProgramTestContext,
  startAnchor
} from "solana-bankrun";
import IDL from "../target/idl/tokenvesting.json";
import { Tokenvesting } from "@/../anchor/target/types/tokenvesting";
import { SYSTEM_PROGRAM_ID } from "@coral-xyz/anchor/dist/cjs/native/system";
import { BankrunProvider } from "anchor-bankrun";
import { createMint, mintTo } from "spl-token-bankrun";
import NodeWallet from "@coral-xyz/anchor/dist/cjs/nodewallet";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { BN } from "@coral-xyz/anchor";
import { resolve } from "path";

describe("Vesting Smart Contract Tests", () => {
  let beneficiary: Keypair;
  let context: ProgramTestContext;
  let provider: BankrunProvider;
  let program: anchor.Program<Tokenvesting>;
  let banksClient: BanksClient;
  let employer: Keypair;
  let mint: PublicKey;
  let beneficiaryProvider: BankrunProvider;
  let program2: anchor.Program<Tokenvesting>;
  let vestingAccountKey: PublicKey;
  let treasuryTokenAccount: PublicKey;
  let employeeAccount: PublicKey;

  let companyName = "Company Name";

  beforeAll(async () => {
    beneficiary = new anchor.web3.Keypair();

    context = await startAnchor(
      "",
      [{ name: "tokenvesting", programId: new PublicKey(IDL.address) }],
      [
        {
          address: beneficiary.publicKey,
          info: {
            lamports: 1_000_000_000,
            data: Buffer.alloc(0),
            owner: SYSTEM_PROGRAM_ID,
            executable: false
          }
        }
      ]
    );

    provider = new BankrunProvider(context);

    anchor.setProvider(provider);

    program = new anchor.Program<Tokenvesting>(IDL as Tokenvesting, provider);

    banksClient = context.banksClient;

    employer = provider.wallet.payer;

    //@ts-expect-error - Type error in spl-token-bankrun dependency
    mint = await createMint(banksClient, employer, employer.publicKey, null, 2);

    beneficiaryProvider = new BankrunProvider(context);
    beneficiaryProvider.wallet = new NodeWallet(beneficiary);

    program2 = new anchor.Program<Tokenvesting>(
      IDL as Tokenvesting,
      beneficiaryProvider
    );

    [vestingAccountKey] = PublicKey.findProgramAddressSync(
      [Buffer.from(companyName)],
      program.programId
    );

    [treasuryTokenAccount] = PublicKey.findProgramAddressSync(
      [Buffer.from("vesting_treasury"), Buffer.from(companyName)],
      program.programId
    );

    [employeeAccount] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("employee_vesting"),
        beneficiary.publicKey.toBuffer(),
        vestingAccountKey.toBuffer()
      ],
      program.programId
    );
  });

  it("Should create a vesting account", async () => {
    const tx = await program.methods
      .createVestingAccount(companyName)
      .accounts({
        signer: employer.publicKey,
        mint: mint,
        tokenProgram: TOKEN_PROGRAM_ID
      })
      .rpc({ commitment: "confirmed" });

    const vestingAccountData = await program.account.vestingAccount.fetch(
      vestingAccountKey,
      "confirmed"
    );

    console.log("Vesting account data", vestingAccountData, null, 2);
    console.log("Create Vesting Account", tx);
  });

  it("Should fund the treasury token account", async () => {
    const amount = 10_000 * 10 ** 9;

    const mintTx = await mintTo(
      //@ts-expect-error - Type error in spl-token-bankrun dependency
      banksClient,
      employer,
      mint,
      treasuryTokenAccount,
      employer,
      amount
    );

    console.log("minted to treasury", mintTx);
  });

  it("Should create an employee vesting account", async () => {
    const tx = await program.methods
      .createEmployeeAccount(new BN(0), new BN(100), new BN(0), new BN(100))
      .accounts({
        beneficiary: beneficiary.publicKey,
        vestingAccount: vestingAccountKey
      })
      .rpc({ commitment: "confirmed", skipPreflight: true });

    console.log("Create employee account txn", tx);
    console.log("create employee adress", employeeAccount.toBase58());
  });

  it("Should claim employee vested tokens", async () => {
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const currentClock = await banksClient.getClock();
    context.setClock(
      new Clock(
        currentClock.slot,
        currentClock.epochStartTimestamp,
        currentClock.epoch,
        currentClock.leaderScheduleEpoch,
        1000n
      )
    );

    const tx = await program2.methods
      .claimTokens(companyName)
      .accounts({ tokenProgram: TOKEN_PROGRAM_ID })
      .rpc({ commitment: "confirmed" });

    console.log("Claimed tokens", tx);
  });
});
