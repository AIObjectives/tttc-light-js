import React from "react";
import { Card, CardContent, Separator } from "../elements";
import Icons from "@src/assets/icons";
import CopyLinkButton from "../copyLinkButton/CopyLinkButton";

/**
 * Notes:
 * TODO: Icon size seems off somehow?
 */

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
    <div className="flex flex-col gap-y-3">
      <QuoteHeader title={`Claim#${claimNum} ${title}`} />
      <Card>
        <CardContent className="p-0">
          {quotes.map((quote, i) => (
            <>
              <Quote quote={quote} />
              {i === quotes.length - 1 ? null : <Separator />}
            </>
          ))}
        </CardContent>
      </Card>
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

function Quote({ quote }: { quote: string }) {
  return (
    <div className="flex flex-row gap-x-3 p-4">
      <div className="min-w-4">
        <Icons.Quote className="fill-foreground h-4 w-4" />
      </div>
      <p className="flex-grow">{quote}</p>
      <div className="h-full self-center ">
        <Icons.ChevronRight
          className="text-muted-foreground  self-center"
          size={24}
        />
      </div>
    </div>
  );
}

export default Claim;
