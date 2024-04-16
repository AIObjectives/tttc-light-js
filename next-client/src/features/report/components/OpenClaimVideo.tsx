"use client";

import { SourceMap, Claim } from "tttc-common/schema";

function OpenClaimVideo({
  children,
  sourceMap,
  claim,
}: React.PropsWithChildren<{ sourceMap: SourceMap; claim: Claim }>) {
  const onClaimClick = (sourceMap: SourceMap, claim: Claim) => {
    return () => {
      // toggle opening claim
      document.getElementById(`${claim.claimId}`)?.classList.toggle("open");

      const { video, timestamp } = sourceMap[claim.commentId!];
      if (video) {
        const parts = video.split("/");
        const videoId = parts[parts.length - 1];
        let [hours, minutes, seconds] = timestamp!.split(":").map(Number);
        let totalSeconds = hours * 3600 + minutes * 60 + seconds;
        // note that we're only loading video when the user clicks on the claim
        // that's for performance reasons and to work around a vimeo bug...
        const src = `https://player.vimeo.com/video/${videoId}#t=${totalSeconds}s`;
        (
          document.getElementById(`video-${claim.claimId}`) as HTMLVideoElement
        ).src = src;
      }
    };
  };

  return (
    <span className="claim" onClick={onClaimClick(sourceMap, claim)}>
      {children}
    </span>
  );
}

export default OpenClaimVideo;
