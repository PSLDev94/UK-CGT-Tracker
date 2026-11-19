import { CURRENT_SCOPE_DECLARATION } from "../src/domain/cgt/types";
import { expect } from "vitest";
import { query, type Database } from "../src/server/database";
import type { Identity } from "../src/server/identity";
import { recordReviewedOpeningPool } from "../src/server/reviewed-opening-pools";
import type { Workspace } from "../src/server/workspace";

export async function qualifyReviewedOpeningPool({
  operator,
  app,
  workspace,
  user,
  portfolioId,
  accountId,
}: {
  operator: Database;
  app: Database;
  workspace: Workspace;
  user: Identity;
  portfolioId: string;
  accountId: string;
}) {
  const securityId = "US0378331005";
  const header =
    "Transaction ID,Trade date,Type,ISIN,Quantity,Consideration,Fees,Currency,GBP per unit,Asset type";
  const row = (id: string, date: string, side: string, amount: number) =>
    [
      id,
      date,
      side,
      securityId,
      100,
      amount,
      0,
      "GBP",
      1,
      "ORDINARY_SHARE",
    ].join(",");
  const calculate = () =>
    workspace.calculate(user, {
      portfolioId,
      taxYear: "2024-25",
      historyThrough: "2025-05-05",
      personalScopeConfirmed: true, scopeDeclaration: CURRENT_SCOPE_DECLARATION,
      confirmedAccountIds: [accountId],
    });
  async function save(...rows: string[]) {
    const draft = await workspace.prepareImport(user, {
      accountId,
      csv: [header, ...rows].join("\n"),
      format: "canonical-v1",
    });
    expect(
      (
        await workspace.commitImport(
          user,
          draft.draftId,
          draft.revision,
          draft.reviewVersion,
        )
      ).outcome,
    ).toBe("committed");
    return draft.draftId;
  }
  const getRevision = async () =>
    (await workspace.overview(user)).portfolio.revision;
  const original = await save(
    row("old1", "2003-05-01", "BUY", 100),
    row("old2", "2005-07-01", "BUY", 900),
    row("old3", "2007-06-01", "SELL", 1000),
    row("recent", "2024-06-01", "SELL", 1000),
    "other,2007-04-01,BUY,GB0008706128,1,10,0,GBP,1,ORDINARY_SHARE",
  );
  const blocked = await calculate();
  expect(blocked.result.status).toBe("blocked");
  const position = {
    ownerId: user.ownerId,
    portfolioId,
    expectedRevision: await getRevision(),
    securityId,
    asOf: "2008-04-05",
    quantity: "100",
    costGBP: "100",
    caseReference: "REVIEW-1",
    sourceReference: "BASIS-1",
  };
  await expect(
    recordReviewedOpeningPool(app, position, true),
  ).rejects.toThrow();
  await expect(
    recordReviewedOpeningPool(
      operator,
      { ...position, ownerId: "unrelated" },
      true,
    ),
  ).rejects.toThrow("do not match");
  expect(await recordReviewedOpeningPool(operator, position)).toMatchObject({
    outcome: "preview",
    revision: position.expectedRevision,
  });
  const applied = await recordReviewedOpeningPool(operator, position, true);
  expect(applied).toEqual({
    outcome: "recorded",
    revision: position.expectedRevision + 1,
  });
  expect(
    await recordReviewedOpeningPool(operator, position, true),
  ).toMatchObject({ outcome: "already_recorded", revision: applied.revision });
  await expect(
    recordReviewedOpeningPool(operator, { ...position, costGBP: "200" }, true),
  ).rejects.toThrow("different evidence");
  await expect(
    workspace.reportSnapshot(user, blocked.runId),
  ).rejects.toMatchObject({ status: 404 });
  const reviewed = await calculate();
  expect(reviewed.result.status).toBe("complete");
  expect(reviewed.result.summary?.netGainGBP).toBe("900.00");
  expect(reviewed.result.pools).toEqual([
    { securityId: "GB0008706128", quantity: "1", costGBP: "10" },
  ]);
  expect(
    (await workspace.reportSnapshot(user, reviewed.runId)).result
      .reviewedOpeningPools,
  ).toEqual([
    {
      securityId,
      asOf: position.asOf,
      quantity: "100",
      costGBP: "100",
      caseReference: "REVIEW-1",
      sourceReference: "BASIS-1",
    },
  ]);
  expect((await workspace.importDetail(user, original, 1)).records.length).toBe(
    5,
  );
  await save(row("late", "2004-02-01", "BUY", 50));
  await expect(calculate()).rejects.toMatchObject({
    code: "BASIS_REVIEW_REQUIRED",
  });
  await expect(
    workspace.reportSnapshot(user, reviewed.runId),
  ).rejects.toMatchObject({ status: 404 });
  const second = {
    ...position,
    costGBP: "150",
    quantity: "200",
    caseReference: "REVIEW-2",
    sourceReference: "BASIS-2",
    expectedRevision: await getRevision(),
  };
  await recordReviewedOpeningPool(operator, second, true);
  expect((await calculate()).result.summary?.netGainGBP).toBe("925.00");
  expect(
    await query(
      operator,
      "SELECT 1 FROM cgt.reviewed_opening_pools WHERE portfolio_id=$1",
      [portfolioId],
    ),
  ).toHaveLength(2);
  await save(
    "next-year,2025-08-01,SELL,US0378331005,1,10,0,GBP,1,ORDINARY_SHARE",
  );
  const laterYear = () =>
    workspace.calculate(user, {
      portfolioId,
      taxYear: "2025-26",
      historyThrough: "2026-05-05",
      personalScopeConfirmed: true, scopeDeclaration: CURRENT_SCOPE_DECLARATION,
      confirmedAccountIds: [accountId],
    });
  const nextBasis = {
    ...second,
    asOf: "2025-04-05",
    quantity: "20",
    costGBP: "60",
    caseReference: "LATER-1",
    expectedRevision: await getRevision(),
  };
  await recordReviewedOpeningPool(operator, nextBasis, true);
  expect((await calculate()).result.summary?.netGainGBP).toBe("925.00");
  const withLater = await laterYear();
  expect(withLater.result.summary?.netGainGBP).toBe("7.00");
  const moved = {
    ...nextBasis,
    asOf: "2025-06-01",
    caseReference: "LATER-2",
    supersedesCaseReference: "LATER-1",
    expectedRevision: await getRevision(),
  };
  await recordReviewedOpeningPool(operator, moved, true);
  await expect(
    workspace.reportSnapshot(user, withLater.runId),
  ).rejects.toMatchObject({ status: 404 });
  expect((await laterYear()).result.summary?.netGainGBP).toBe("9.25");
  const withdrawal = {
    decision: "withdraw" as const,
    ownerId: user.ownerId,
    portfolioId,
    securityId,
    caseReference: "CLOSED-1",
    sourceReference: "LETTER-1",
    supersedesCaseReference: "LATER-2",
    expectedRevision: await getRevision(),
  };
  expect(
    (await recordReviewedOpeningPool(operator, withdrawal, true)).outcome,
  ).toBe("withdrawn");
  expect(
    (await recordReviewedOpeningPool(operator, withdrawal, true)).outcome,
  ).toBe("already_recorded");
  expect(
    (await laterYear()).result.reviewedOpeningPools?.[0]?.caseReference,
  ).toBe("REVIEW-2");
  // A challenged opening is withdrawn even if the original receipt set has changed.
  await save(row("new-backfill", "2004-04-01", "BUY", 1));
  await expect(calculate()).rejects.toMatchObject({
    code: "BASIS_REVIEW_REQUIRED",
  });
  await recordReviewedOpeningPool(
    operator,
    {
      ...withdrawal,
      caseReference: "CLOSED-2",
      supersedesCaseReference: "REVIEW-2",
      expectedRevision: await getRevision(),
    },
    true,
  );
  expect((await calculate()).result.status).toBe("blocked");
  await save(
    row("boundary-sale", "2019-01-10", "SELL", 100),
    row("boundary-buy", "2019-02-09", "BUY", 100),
  );
  await expect(
    recordReviewedOpeningPool(
      operator,
      {
        ...second,
        asOf: "2019-01-15",
        caseReference: "REVIEW-3",
        expectedRevision: await getRevision(),
      },
      true,
    ),
  ).rejects.toThrow("across this cutoff");
}
