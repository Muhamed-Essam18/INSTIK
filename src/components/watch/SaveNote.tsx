/** A quiet note shown when a choice could not be saved to the account. The choice itself stays on screen. */
export function SaveNote({ show }: { show: boolean }) {
  return (
    <p role="status" className={show ? "m-0 text-caption text-slate" : "sr-only"}>
      {show ? "Couldn't save that just now. We'll try again on your next change." : ""}
    </p>
  );
}
