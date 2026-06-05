"use client";
import React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { NotepadTextDashed } from "lucide-react";

interface FooterLink {
  label: string;
  href: string;
}

interface SocialLink {
  icon: React.ReactNode;
  href: string;
  label: string;
}

interface FooterProps {
  brandName?: string;
  brandDescription?: string;
  socialLinks?: SocialLink[];
  navLinks?: FooterLink[];
  creatorName?: string;
  creatorUrl?: string;
  brandIcon?: React.ReactNode;
  className?: string;
}

export const Footer = ({
  brandName = "YourBrand",
  brandDescription = "Your description here",
  socialLinks = [],
  navLinks = [],
  creatorName,
  creatorUrl,
  brandIcon,
  className,
}: FooterProps) => {
  return (
    <section className={cn("relative w-full mt-0 overflow-hidden", className)}>
      <footer className="border-t border-zinc-900 bg-black mt-10 relative">
        <div className="max-w-7xl flex flex-col justify-between mx-auto min-h-[25rem] sm:min-h-[30rem] md:min-h-[35rem] relative p-4 py-8">
          <div className="flex flex-col mb-8 sm:mb-12 md:mb-0 w-full">
            <div className="w-full flex flex-col items-center">
              <div className="space-y-2 flex flex-col items-center flex-1">
                <div className="flex items-center gap-1">
                  <span className="text-3xl font-black tracking-tighter text-white">
                    {brandName}
                  </span>
                  <div className="w-2 h-2 bg-emerald-500 rounded-full mt-3"></div>
                </div>
                <p className="text-zinc-400 font-medium text-center w-full max-w-sm sm:w-96 px-4 sm:px-0 font-dm">
                  {brandDescription}
                </p>
              </div>

              {socialLinks.length > 0 && (
                <div className="flex mb-6 mt-4 gap-4">
                  {socialLinks.map((link, index) => (
                    <Link
                      key={index}
                      href={link.href}
                      className="text-zinc-500 hover:text-white transition-colors"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <div className="w-6 h-6 hover:scale-110 duration-300">
                        {link.icon}
                      </div>
                      <span className="sr-only">{link.label}</span>
                    </Link>
                  ))}
                </div>
              )}

              {navLinks.length > 0 && (
                <div className="flex flex-wrap justify-center gap-6 text-sm font-medium text-zinc-400 max-w-full px-4 font-dm">
                  {navLinks.map((link, index) => (
                    <Link
                      key={index}
                      className="hover:text-emerald-400 duration-300 hover:font-semibold"
                      href={link.href}
                    >
                      {link.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="mt-16 md:mt-20 flex flex-col gap-2 md:gap-1 items-center justify-center md:flex-row md:items-center md:justify-between px-4 md:px-0 font-dm">
            <p className="text-sm text-zinc-600 text-center md:text-left">
              ©{new Date().getFullYear()} {brandName}. All rights reserved.
            </p>
            {creatorName && creatorUrl && (
              <nav className="flex gap-4">
                <Link
                  href={creatorUrl}
                  target="_blank"
                  className="text-sm text-zinc-600 hover:text-zinc-300 transition-colors duration-300 hover:font-medium"
                >
                  Crafted by {creatorName}
                </Link>
              </nav>
            )}
          </div>
        </div>

        {/* Large background text - FIXED */}
        <div 
          className="bg-gradient-to-b from-zinc-700/80 via-zinc-800/40 to-transparent bg-clip-text text-transparent leading-none absolute left-1/2 -translate-x-1/2 bottom-32 md:bottom-28 font-black tracking-tighter pointer-events-none select-none text-center px-4 font-sans"
          style={{
            fontSize: 'clamp(3rem, 15vw, 12rem)',
            maxWidth: '100vw',
            zIndex: 0
          }}
        >
          {brandName.toUpperCase()}
        </div>

        {/* Bottom logo */}
        <div className="absolute hover:border-emerald-500/50 duration-400 drop-shadow-[0_0px_20px_rgba(0,0,0,0.5)] dark:drop-shadow-[0_0px_20px_rgba(255,255,255,0.1)] bottom-8 md:bottom-6 backdrop-blur-md rounded-3xl bg-black/40 left-1/2 border border-zinc-800 flex items-center justify-center p-3 -translate-x-1/2 z-10 transition-all">
          <div className="w-12 sm:w-16 md:w-20 h-12 sm:h-16 md:h-20 bg-gradient-to-br from-zinc-800 to-black rounded-2xl flex items-center justify-center shadow-inner border border-zinc-700/50">
            {brandIcon || (
              <NotepadTextDashed className="w-6 sm:w-8 md:w-10 h-6 sm:h-8 md:h-10 text-emerald-500 drop-shadow-lg" />
            )}
          </div>
        </div>

        {/* Bottom line */}
        <div className="absolute bottom-16 sm:bottom-18 backdrop-blur-sm h-px bg-gradient-to-r from-transparent via-zinc-800 to-transparent w-full left-1/2 -translate-x-1/2"></div>

        {/* Bottom shadow */}
        <div className="bg-gradient-to-t from-black via-black/90 to-transparent absolute bottom-0 w-full h-32 pointer-events-none z-0"></div>
      </footer>
    </section>
  );
};
