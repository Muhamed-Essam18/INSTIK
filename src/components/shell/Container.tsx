import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  className?: string;
  as?: "div" | "main";
  id?: string;
  tabIndex?: number;
};

/** The one shared page width and side padding, used by header, main and footer. */
export function Container({ children, className = "", as: Tag = "div", ...rest }: Props) {
  return (
    <Tag className={`mx-auto w-full max-w-[1360px] px-4 md:px-8 ${className}`} {...rest}>
      {children}
    </Tag>
  );
}
