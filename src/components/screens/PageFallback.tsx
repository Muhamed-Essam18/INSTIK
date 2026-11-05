/** Static placeholder shown while a page reads its route params; keeps the page height steady. */
export function PageFallback() {
  return <div aria-busy="true" className="min-h-[60vh]" />;
}
