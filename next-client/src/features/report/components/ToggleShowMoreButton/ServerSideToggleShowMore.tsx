import { ToggleShowMoreComponentProps } from "tttc-common/components";

export default function ServerSideToggleShowMoreButton({
  children,
  subtopic,
  className,
}: ToggleShowMoreComponentProps) {
  const showMoreOnclick = (subtopicId: string) => {
    return `document.getElementById('${subtopicId}').classList.toggle('showmore');`;
  };

  return (
    <button
      className={className}
      data-onclick={showMoreOnclick(subtopic.subtopicId!)}
    >
      {children}
    </button>
  );
}
