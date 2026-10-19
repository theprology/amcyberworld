import type { AnchorHTMLAttributes, ReactNode } from 'react';

type StaticLinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  href: string;
  children: ReactNode;
};

export default function StaticLink({ href, children, ...properties }: StaticLinkProps) {
  return <a href={href} {...properties}>{children}</a>;
}
