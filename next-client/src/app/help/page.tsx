import { Col } from "@/components/layout";
import React from "react";

export default function TranscriptionPage() {
  return (
    <Col className="p-8 max-w-[832px] m-auto">
      <ContentGroupContainer>
        <ContentGroup>
          <h2>Transcriptions</h2>
          <h3>Transcribing Recordings into Text for Reports</h3>
          <p>
            Transcribing audio or video recordings can be made much easier with
            modern AI tools – you no longer need to manually type out interviews
            or meetings. Below, we discuss user-friendly methods to convert
            lengthy recordings into transcripts (e.g. text files) for use in
            Talk to the City. These recommendations offer mainstream solutions
            that are easy to use, but are not an endorsement of any specific
            product over another.
          </p>
        </ContentGroup>
        <ContentGroup>
          <h3>Online Transcription Services (Cloud-Based)</h3>
          <p>
            One of the easiest routes is to use a cloud service where you upload
            your audio/video and receive a transcript. These services handle the
            heavy processing on their servers, so you do not need to acquire
            special hardware or software, but you should review their privacy
            policies carefully if your data is sensitive.
          </p>
          <p>
            <span className="font-bold">Otter.ai:</span> A widely-used AI
            transcription service geared towards meetings and interviews. Otter
            can transcribe in real-time (or from recordings) and has an AI
            meeting assistant that can join Zoom/Teams calls to capture
            everything. It offers features like speaker identification and
            keyword search. The free plan has monthly limits so lengthy files
            may require a paid plan for full transcription.{" "}
          </p>
          <p>
            <span className="font-bold">Rev:</span> Rev is known for human
            transcription, but also offers a fast AI-based transcription option.
            Rev provides an online editor to review and correct the transcript
            and you can download the result as text. Pricing is pay-as-you-go or
            via subscription for high volumes
          </p>
          <p>
            <span className="font-bold">Happy Scribe:</span> Happy Scribe is
            another user-friendly platform that provides a web-based editor
            where you can play back the recording and edit the transcript. The
            multi-language support might be helpful if your recordings are not
            in English. The service offers a free trial (limited minutes) and
            tiered monthly plans.
          </p>
        </ContentGroup>
        <ContentGroup>
          <h3>User-Friendly Transcription Software (Desktop Apps)</h3>
          <p>
            If you prefer not to upload files to the cloud (for privacy or cost
            reasons), there are desktop applications that transcribe audio
            locally on your computer. These range from professional editing
            suites to simple drag-and-drop transcription tools. Some notable
            examples are:
          </p>
          <p>
            <span className="font-bold">Descript:</span> Descript is a powerful
            audio/video editing application that uses transcripts as the basis
            for editing. It will automatically transcribe your recording and
            show the text on screen, letting you edit the audio by editing the
            text.
          </p>
          <p>
            <span className="font-bold">OpenAI Whisper (via GUI Apps):</span>{" "}
            OpenAI's Whisper is an open-source speech recognition model that
            delivers accurate transcriptions (on par with top cloud services)
            and supports 90+ languages. While Whisper was originally a Python
            library (not very accessible to non-programmers), there are now many
            easy-to-use applications built on Whisper. For example, Whisper
            Desktop is a simple Windows program that you can install by
            downloading a single ZIP, no coding required. On Mac, apps like
            Whisper Transcription (available on the App Store) provide a
            drag-and-drop interface to transcribe files locally. Using Whisper
            locally has several advantages: it is completely free and offline,
            so your audio never leaves your machine and there are no length or
            usage fees. The main consideration is that running the Whisper model
            is computationally intensive, a modern PC with a decent CPU/GPU is
            recommended, and very long files might take a while to process.{" "}
          </p>
        </ContentGroup>
        <ContentGroup>
          <h3>Built-in or Free Transcription Methods</h3>
          <p>
            If your recordings come from common platforms or if you have zero
            budget, there are a few other methods to get transcripts with
            minimal effort:
          </p>
          <p>
            <span className="font-bold">
              Meeting Platform Transcripts (Zoom/Teams):
            </span>{" "}
            Many video conferencing tools now offer automatic transcription. For
            instance, Zoom can generate a transcript for recorded meetings if
            you enable “audio transcription” in cloud recordings. After the
            meeting, you can download the transcript as a text file. This is
            very convenient for meetings, as it labels speakers by name (if
            identified) and you get the text alongside the recording. Microsoft
            Teams and Google Meet have similar live caption or transcript
            features. If your long recording is actually a meeting saved on one
            of these platforms, check their transcript options – you might be
            able to export a ready-made .txt without using any additional
            software.
          </p>
          <p>
            <span className="font-bold">YouTube Automatic Captions:</span> An
            unconventional trick for transcribing is to use YouTube’s caption
            generator. By uploading your audio or video (you can keep it
            unlisted/private), YouTube will automatically generate subtitles for
            it after a short processing time. You can then go into the YouTube
            Studio’s subtitle editor to copy the transcript text or download the
            captions. This method leverages Google’s speech recognition for
            free. The main drawbacks are that very long videos may need to be
            split into segments, and accuracy can decline if the audio quality
            is poor or the content includes highly specialized vocabulary. Also,
            the auto-captions sometimes lack punctuation and have formatting
            broken into subtitle timestamps. Therefore you will likely need to
            do some editing but for a completely free solution, it is a viable
            option.
          </p>
        </ContentGroup>
        <ContentGroup>
          <h3>Converting Transcripts to CSV</h3>
          <p>
            No matter which method you use, the end goal is to get a CSV file
            that you can upload into Talk to the City. Most tools will let you
            download the transcript as a plain text file (.txt) or copy it to
            your clipboard. This is often the easiest way to then import into a
            spreadsheet like Google Sheets or Excel, where you can split or
            format it into CSV as needed (for instance, one column for names,
            one for comments, following our sample format).
          </p>
        </ContentGroup>
      </ContentGroupContainer>
    </Col>
  );
}

const ContentGroup = ({ children }: React.PropsWithChildren) => (
  <Col gap={3}>{children}</Col>
);

const ContentGroupContainer = ({ children }: React.PropsWithChildren) => (
  <Col gap={6}>{children}</Col>
);
