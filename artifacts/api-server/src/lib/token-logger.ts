import { db } from "@workspace/db";
import { tokenUsageTable } from "@workspace/db";

const INPUT_COST_PER_TOKEN = 0.000003;
const OUTPUT_COST_PER_TOKEN = 0.000015;

export async function logTokenUsage({
  companyId,
  jobProcessId,
  candidateId,
  tokensInput,
  tokensOutput,
}: {
  companyId: string;
  jobProcessId?: string;
  candidateId?: string;
  tokensInput: number;
  tokensOutput: number;
}): Promise<void> {
  const costUsd =
    tokensInput * INPUT_COST_PER_TOKEN + tokensOutput * OUTPUT_COST_PER_TOKEN;

  await db.insert(tokenUsageTable).values({
    companyId,
    jobProcessId: jobProcessId ?? null,
    candidateId: candidateId ?? null,
    tokensInput,
    tokensOutput,
    costUsd,
  });
}
