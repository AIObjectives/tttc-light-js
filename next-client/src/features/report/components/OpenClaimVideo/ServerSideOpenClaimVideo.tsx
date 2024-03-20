
import { Claim, SourceMap } from "tttc-common/schema";
import { OpenClaimVideoProps } from "tttc-common/components";

export default function ServerSideOpenClaimVideo({children, sourceMap, claim}:OpenClaimVideoProps) {
    const onClaimClick = (sourceMap: SourceMap, claim: Claim) => {
        let callback = `document.getElementById('${claim.claimId}').classList.toggle('open');`;
        const { video, timestamp } = sourceMap[claim.commentId!];
        if (video) {
            const parts = video.split("/");
            const videoId = parts[parts.length - 1];
            let [hours, minutes, seconds] = timestamp!.split(":").map(Number);
            let totalSeconds = hours * 3600 + minutes * 60 + seconds;
            // note that we're only loading video when the user clicks on the claim
            // that's for performance reasons and to work around a vimeo bug...
            const src = `https://player.vimeo.com/video/${videoId}#t=${totalSeconds}s`;
            callback += `document.getElementById('video-${claim.claimId}').src = '${src}';`;
        }
        return callback;
        
    };

      return (
        <span className="claim" 
        data-onclick={onClaimClick(sourceMap, claim)}
        >
            {children}
        </span>
      )
}