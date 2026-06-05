import React from "react";
import { Link as RrLink } from "react-router-dom";

export default function Link({ href, children, ...props }: any) {
  // If the link is an external or anchor link, use standard <a> tag
  if (href.startsWith("http") || href.startsWith("#")) {
    return (
      <a href={href} {...props}>
        {children}
      </a>
    );
  }

  return (
    <RrLink to={href} {...props}>
      {children}
    </RrLink>
  );
}
