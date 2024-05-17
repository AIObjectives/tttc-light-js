import React from "react";
import { Card, CardContent } from "../elements";
import Icons from "@src/assets/icons";
import CopyLinkButton from "../copyLinkButton/CopyLinkButton";

function Claim({
  claimNum,
  title,
  quotes,
}: {
  claimNum: number;
  title: string;
  quotes: string[];
}) {
  return (
    <div className="flex flex-col gap-y-5">
      <QuoteHeader title={`Claim#${claimNum} ${title}`} />
      <div>
        {quotes.map((quote) => (
          <QuoteCard quote={quote} />
        ))}
      </div>
    </div>
  );
}

function QuoteHeader({ title }: { title: string }) {
  return (
    <div className="flex flex-row justify-between">
      <h2 className="text-muted-foreground">
        <a id={`${title}`}>{title}</a>
      </h2>
      <CopyLinkButton anchor={title} />
    </div>
  );
}

function QuoteCard({ quote }: { quote: string }) {
  return (
    <Card>
      <CardContent className="flex flex-row gap-x-3 p-4">
        <Icons.Quote
          className="fill-foreground text-transparent rotate-180"
          size={16}
        />
        {quote}
        <Icons.ChevronRight
          className="text-muted-foreground  self-center"
          size={24}
        />
      </CardContent>
    </Card>
  );
}

export default Claim;
