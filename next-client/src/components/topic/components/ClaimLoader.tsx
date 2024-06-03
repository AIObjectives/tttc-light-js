"use client";

import Claim from "@src/components/claim/Claim";
import { Button } from "@src/components/elements";
import { useState } from "react";
import * as schema from "tttc-common/schema";

function ClaimLoader({
  claims,
  pagination,
  i,
}: {
  claims: schema.Claim[];
  pagination: number;
  i;
}) {
  const [showMore, setShowMore] = useState(false);
  const moreClaims = claims.slice(0, pagination);
  const evenMoreClaims = claims.slice(pagination);
  if (!showMore && claims.length > 0)
    return (
      <div className="pl-8">
        <Button variant={"outline"} onClick={() => setShowMore(true)}>
          {claims.length} more claim{claims.length > 0 ? "s" : ""}
        </Button>
      </div>
    );
  else
    return (
      <>
        {moreClaims.map((claim, j) => (
          <Claim
            claimNum={i + j + 1}
            title={claim.title}
            quotes={claim.quotes}
          />
        ))}
        {claims.length > 0 ? (
          <ClaimLoader
            claims={evenMoreClaims}
            pagination={pagination}
            i={i + pagination}
          />
        ) : null}
      </>
    );
}

export default ClaimLoader;
