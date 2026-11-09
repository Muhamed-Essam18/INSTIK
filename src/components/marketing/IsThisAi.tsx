import { landing } from "@/lib/marketing/copy";

export function IsThisAi() {
  const { isThisAi } = landing;
  return (
    <div className="flex min-w-0 flex-[1_1_380px] flex-col gap-4 py-2">
      <h2 className="font-display text-[32px] leading-10 font-extrabold">{isThisAi.title}</h2>
      <p className="text-body-lg">{isThisAi.body}</p>
    </div>
  );
}
