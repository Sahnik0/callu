"use client";
import React from 'react';
import styled from 'styled-components';

interface MemberButtonProps {
  onClick?: () => void;
  text?: string;
}

const MemberButton = ({ onClick, text = "Sign In" }: MemberButtonProps) => {
  return (
    <StyledWrapper onClick={onClick}>
      {text}
    </StyledWrapper>
  );
};

const StyledWrapper = styled.button`
  background: #191919;
  color: #e3e3e3;
  font-size: 14px;
  font-weight: 500;
  padding: 6px 14px;
  border: 1px solid #373737;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease;

  &:hover {
    background: #252525;
    border-color: #555555;
    color: #ffffff;
  }
`;

export default MemberButton;