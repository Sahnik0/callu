"use client";
import React from 'react';
import styled from 'styled-components';

interface StyledButtonProps {
  onClick?: () => void;
  text?: string;
}

const StyledButton = ({ onClick, text = "Apply to Join" }: StyledButtonProps) => {
  return (
    <StyledWrapper onClick={onClick}>
      <button className="button">
        <div className="icon">
          <span className="text-icon hide">Secure</span>
          <svg className="css-i6dzq1" strokeLinejoin="round" strokeLinecap="round" fill="none" strokeWidth={2} stroke="currentColor" height={24} width={24} viewBox="0 0 24 24">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
        </div>
        <span className="title">{text}</span>
        <div className="padding-left hide">
          <div className="padding-left-line">
            <span className="padding-left-text">Manual Review</span>
          </div>
        </div>
        <div className="padding-right hide">
          <div className="padding-right-line">
            <span className="padding-right-text">Encrypted Audit</span>
          </div>
        </div>
        <div className="background hide">
          <span className="background-text">Global Node</span>
        </div>
        <div className="border hide">
          <span className="border-text">Top 1% Talent</span>
        </div>
      </button>
    </StyledWrapper>
  );
}

const StyledWrapper = styled.div`
  /* Theme Variables */
  --primary-gradient-start: #27272a; /* Zinc 800 */
  --primary-gradient-end: #09090b;   /* Zinc 950 */
  --active-gradient-start: #09090b;
  --active-gradient-end: #27272a;
  --border-color: #3f3f46; /* Zinc 700 */
  --accent-color: #10b981; /* Emerald 500 */
  --text-color: white;
  --line-color: rgba(255, 255, 255, 0.8);

  display: inline-block;

  .button {
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    font-size: 14px;
    background-image: linear-gradient(var(--primary-gradient-start), var(--primary-gradient-end));
    color: var(--text-color);
    border: solid 2px var(--border-color);
    height: 50px;
    padding: 0px 32px;
    border-radius: 9999px; /* Pill shape matches theme */
    font-weight: 600;
    transition: all 0.3s ease;
    position: relative;
    box-shadow: 0 10px 20px -10px rgba(16, 185, 129, 0.1);
  }
  
  .button:hover {
    border-color: var(--accent-color);
    box-shadow: 0 0 20px -5px rgba(16, 185, 129, 0.3);
  }

  .button:not(:hover) .hide,
  .button:not(:hover) .icon::before,
  .button:not(:hover) .icon::after {
    opacity: 0;
    visibility: hidden;
    transform: scale(1.4);
  }
  .hide {
    transition: all 0.2s ease;
  }
  .button:active {
    background-image: linear-gradient(var(--active-gradient-start), var(--active-gradient-end));
    border-color: var(--accent-color);
    transform: scale(0.98);
  }
  .icon {
    position: relative;
  }
  .icon::before {
    content: "";
    position: absolute;
    left: 0;
    top: 0;
    width: 6px;
    height: 6px;
    transform: translate(-50%, -50%);
    background-color: var(--accent-color);
    border-radius: 100%;
  }
  .icon::after {
    content: "";
    position: absolute;
    right: 0;
    bottom: 0;
    transform: translate(-19%, -60%);
    width: 100px;
    height: 33px;
    background-color: transparent;
    border-radius: 12px 22px 2px 2px;
    border-right: solid 2px var(--line-color);
    border-top: solid 2px transparent;
  }
  .icon .text-icon {
    color: var(--line-color);
    position: absolute;
    font-size: 10px;
    font-family: monospace;
    left: -37px;
    top: -38px;
    text-transform: uppercase;
  }
  .icon svg {
    width: 20px;
    height: 20px;
    border: solid 2px transparent;
    display: flex;
    color: var(--text-color);
  }
  .button:hover .icon svg {
    border: solid 2px var(--line-color);
    border-radius: 4px;
    color: var(--accent-color);
  }
  .padding-left {
    position: absolute;
    width: 20px;
    height: 2px;
    background-color: var(--line-color);
    left: 0;
    top: 50%;
    transform: translateY(-50%);
  }
  .padding-left:before {
    content: "";
    width: 2px;
    height: 10px;
    background-color: var(--line-color);
    position: absolute;
    left: 0;
    top: 50%;
    transform: translateY(-50%);
  }
  .padding-left:after {
    content: "";
    width: 2px;
    height: 10px;
    background-color: var(--line-color);
    position: absolute;
    right: 0;
    top: 50%;
    transform: translateY(-50%);
  }
  .padding-left-line {
    position: absolute;
    width: 30px;
    height: 2px;
    background-color: var(--line-color);
    left: -24px;
    top: 11px;
    transform: rotate(-50deg);
  }
  .padding-left-line::before {
    content: "";
    position: absolute;
    left: 0;
    top: 0;
    width: 6px;
    height: 6px;
    transform: translate(-50%, -50%);
    background-color: var(--accent-color);
    border-radius: 100%;
  }
  .padding-left-text {
    color: var(--line-color);
    font-size: 10px;
    font-family: monospace;
    position: absolute;
    white-space: nowrap;
    transform: rotate(50deg);
    bottom: 30px;
    left: -80px;
    text-transform: uppercase;
  }

  .padding-right {
    position: absolute;
    width: 20px;
    height: 2px;
    background-color: var(--line-color);
    right: 0;
    top: 50%;
    transform: translateY(-50%);
  }
  .padding-right:before {
    content: "";
    width: 2px;
    height: 10px;
    background-color: var(--line-color);
    position: absolute;
    left: 0;
    top: 50%;
    transform: translateY(-50%);
  }
  .padding-right:after {
    content: "";
    width: 2px;
    height: 10px;
    background-color: var(--line-color);
    position: absolute;
    right: 0;
    top: 50%;
    transform: translateY(-50%);
  }
  .padding-right-line {
    position: absolute;
    width: 30px;
    height: 2px;
    background-color: var(--line-color);
    right: -24px;
    top: 11px;
    transform: rotate(50deg);
  }
  .padding-right-line::before {
    content: "";
    position: absolute;
    left: 30px;
    top: 0;
    width: 6px;
    height: 6px;
    transform: translate(-50%, -50%);
    background-color: var(--accent-color);
    border-radius: 100%;
  }
  .padding-right-text {
    color: var(--line-color);
    font-size: 10px;
    font-family: monospace;
    position: absolute;
    white-space: nowrap;
    transform: rotate(-50deg);
    bottom: 34px;
    left: 21px;
    text-transform: uppercase;
  }
  .background {
    position: absolute;
  }
  .background::before {
    content: "";
    position: absolute;
    right: 27px;
    bottom: -70px;
    width: 100px;
    height: 53px;
    background-color: transparent;
    border-radius: 0px 0px 22px 22px;
    border-right: solid 2px var(--line-color);
    border-bottom: solid 2px transparent;
  }
  .background::after {
    content: "";
    position: absolute;
    right: 25px;
    bottom: -20px;
    width: 6px;
    height: 6px;
    background-color: var(--accent-color);
    border-radius: 100%;
  }
  .background-text {
    position: absolute;
    color: var(--line-color);
    font-size: 10px;
    font-family: monospace;
    bottom: -70px;
    left: -115px;
    text-transform: uppercase;
  }
  .border {
    position: absolute;
    right: 0;
    top: 0;
  }
  .border:before {
    content: "";
    width: 15px;
    height: 15px;
    border: solid 2px var(--line-color);
    position: absolute;
    right: 0%;
    top: 0;
    transform: translate(50%, -50%);
    border-radius: 100%;
  }
  .border:after {
    content: "";
    width: 2px;
    height: 25px;
    background-color: var(--line-color);
    position: absolute;
    right: -10px;
    top: -15px;
    transform: translate(50%, -50%) rotate(60deg);
  }
  .border .border-text {
    position: absolute;
    color: var(--line-color);
    font-size: 10px;
    font-family: monospace;
    right: -112px;
    top: -30px;
    white-space: nowrap;
    text-transform: uppercase;
  }
`;

export default StyledButton;
